import "server-only";
import {
  questionsTargetForDuration,
  type InterviewSession,
} from "@/domain/interview/types";
import type { InterviewReview } from "@/domain/interview/interview-feedback";
import { seedOpeningQuestion } from "@/domain/interview/interview-seed";
import { AIProviderError, AIStructuredError } from "@/infrastructure/ai/errors";
import {
  generateNextSimulationQuestion,
  reviewSimulation,
  INTERVIEWER_PROMPT_VERSION,
  type Exchange,
} from "@/infrastructure/ai/roles/interviewer";
import { LocalAudioStorage } from "@/infrastructure/audio/local-audio-storage";
import { getSpeechProvider } from "@/infrastructure/speech/provider";
import { interviewRepository } from "@/infrastructure/db/repositories/interview-repository";
import { practiceRepository } from "@/infrastructure/db/repositories/practice-repository";
import { ids } from "@/lib/ids";
import { logger } from "@/lib/logger";

/**
 * Application service for FULL interview simulation (§31, §32).
 *
 * The defining rule: while the interview is active, the AI is ONLY an
 * interviewer - it asks the next (adaptive) question and returns NO feedback,
 * score, or hint. The full review is produced solely at the end (§32). The app
 * owns the state machine (question count, when to wrap, completion).
 */

const audioStorage = new LocalAudioStorage();

export async function startSimulation(input: {
  categories: string[];
  interviewType: string;
  durationMinutes: number;
}): Promise<{ session: InterviewSession; question: string; questionsTarget: number }> {
  const questionsTarget = questionsTargetForDuration(input.durationMinutes);
  let question = seedOpeningQuestion(input.categories);
  try {
    question = await generateNextSimulationQuestion({
      categories: input.categories,
      interviewType: input.interviewType,
      history: [],
      askedCount: 0,
      targetCount: questionsTarget,
    });
  } catch (e) {
    logger.warn("simulation_opening_fallback_to_seed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const session = interviewRepository.createSession({
    mode: "simulation",
    categories: input.categories,
    technologies: [],
    interviewType: input.interviewType,
    durationMinutes: input.durationMinutes,
    questionsTarget,
    pendingQuestion: question,
    pendingKind: "opening",
  });
  return { session, question, questionsTarget };
}

export type SubmitSimulationResult =
  | {
      ok: true;
      audioUrl: string;
      done: boolean;
      nextQuestion: string | null;
      answeredCount: number;
      targetCount: number;
    }
  | {
      ok: false;
      audioUrl: string;
      error: "no_pending_question" | "transcription_failed";
      message: string;
    };

export async function submitSimulationAnswer(input: {
  sessionId: string;
  audio: Buffer;
  mimeType: string;
  durationMs?: number;
  clientTranscript?: string;
}): Promise<SubmitSimulationResult> {
  const session = interviewRepository.getSession(input.sessionId);
  if (!session) throw new Error(`Simulation not found: ${input.sessionId}`);
  const question = session.pendingQuestion;
  const targetCount =
    session.questionsTarget ??
    questionsTargetForDuration(session.durationMinutes ?? 20);
  if (!question) {
    return {
      ok: false,
      audioUrl: "",
      error: "no_pending_question",
      message: "There's no active question to answer.",
    };
  }

  // Persist audio first (§8, §77).
  const audioId = ids.recording();
  const stored = await audioStorage.save(audioId, input.audio, input.mimeType);
  practiceRepository.saveAudioRecording({
    id: audioId,
    relativePath: stored.relativePath,
    mimeType: stored.mimeType,
    bytes: stored.bytes,
    durationMs: input.durationMs,
  });
  const audioUrl = `/api/audio/${audioId}`;

  // Transcript: browser preferred, else server transcription.
  let transcript = input.clientTranscript?.trim() ?? "";
  if (!transcript) {
    try {
      const r = await getSpeechProvider().transcribe(input.audio, input.mimeType);
      transcript = r.text.trim();
    } catch (e) {
      logger.error("simulation_transcription_failed", {
        sessionId: input.sessionId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  if (!transcript) {
    return {
      ok: false,
      audioUrl,
      error: "transcription_failed",
      message:
        "I couldn't understand enough of the recording. Try speaking a little closer to the microphone, then answer again.",
    };
  }

  const transcriptId = practiceRepository.saveTranscript({
    audioRecordingId: audioId,
    text: transcript,
    source: "interview",
  });

  const answeredBefore = interviewRepository
    .listTurns(input.sessionId)
    .filter((t) => t.turn.answer).length;

  // Store the answered turn - NO feedback during a simulation (§32).
  interviewRepository.createTurn({
    sessionId: input.sessionId,
    kind: answeredBefore === 0 ? "opening" : "followup",
    question,
    answer: transcript,
    audioRecordingId: audioId,
    transcriptId,
    promptVersion: INTERVIEWER_PROMPT_VERSION,
  });
  const answeredCount = answeredBefore + 1;

  // Reached the target - wrap up (the app decides, not the AI).
  if (answeredCount >= targetCount) {
    interviewRepository.setPending(input.sessionId, null, null);
    return {
      ok: true,
      audioUrl,
      done: true,
      nextQuestion: null,
      answeredCount,
      targetCount,
    };
  }

  // Otherwise ask the next adaptive question (still no feedback).
  const history: Exchange[] = interviewRepository
    .listTurns(input.sessionId)
    .filter((t) => t.turn.answer)
    .map((t) => ({ question: t.turn.question, answer: t.turn.answer as string }));

  let nextQuestion: string;
  try {
    nextQuestion = await generateNextSimulationQuestion({
      categories: session.categories,
      interviewType: session.interviewType ?? "mixed",
      history,
      askedCount: answeredCount,
      targetCount,
      sessionId: input.sessionId,
    });
  } catch (e) {
    logger.warn("simulation_next_question_fallback", {
      sessionId: input.sessionId,
      error: e instanceof Error ? e.message : String(e),
    });
    nextQuestion =
      "Tell me about another recent decision you made and the trade-off you accepted.";
  }

  interviewRepository.setPending(input.sessionId, nextQuestion, "followup");
  return {
    ok: true,
    audioUrl,
    done: false,
    nextQuestion,
    answeredCount,
    targetCount,
  };
}

/** End the simulation and produce the full review (§32). */
export async function finishSimulation(
  sessionId: string,
): Promise<{ review: InterviewReview | null; message?: string }> {
  const session = interviewRepository.getSession(sessionId);
  if (!session) throw new Error(`Simulation not found: ${sessionId}`);

  const exchanges: Exchange[] = interviewRepository
    .listTurns(sessionId)
    .filter((t) => t.turn.answer)
    .map((t) => ({ question: t.turn.question, answer: t.turn.answer as string }));

  interviewRepository.setPending(sessionId, null, null);

  if (exchanges.length === 0) {
    interviewRepository.setStatus(sessionId, "completed");
    return { review: null, message: "No answers were recorded in this session." };
  }

  try {
    const review = await reviewSimulation({
      categories: session.categories,
      interviewType: session.interviewType ?? "mixed",
      exchanges,
      sessionId,
    });
    interviewRepository.setReview(sessionId, review);
    interviewRepository.setStatus(sessionId, "completed");
    return { review };
  } catch (e) {
    const isKnown =
      e instanceof AIStructuredError || e instanceof AIProviderError;
    logger.error("simulation_review_failed", {
      sessionId,
      error: e instanceof Error ? e.message : String(e),
    });
    // The interview is over regardless; complete it and let the UI degrade.
    interviewRepository.setStatus(sessionId, "completed");
    if (!isKnown) throw e;
    return {
      review: null,
      message:
        "The interview is saved, but I couldn't generate the full review just now. You can review your transcript above.",
    };
  }
}

export function abandonSimulation(sessionId: string) {
  interviewRepository.setStatus(sessionId, "abandoned");
}

export interface SimulationState {
  session: InterviewSession;
  exchanges: {
    sequence: number;
    question: string;
    answer: string | null;
    audioUrl: string | null;
  }[];
  currentQuestion: string | null;
  answeredCount: number;
  targetCount: number;
  review: InterviewReview | null;
}

export function getSimulationState(sessionId: string): SimulationState | null {
  const session = interviewRepository.getSession(sessionId);
  if (!session) return null;
  const turns = interviewRepository.listTurns(sessionId);
  const answered = turns.filter((t) => t.turn.answer);
  return {
    session,
    exchanges: turns.map((t) => ({
      sequence: t.turn.sequence,
      question: t.turn.question,
      answer: t.turn.answer ?? null,
      audioUrl: t.turn.audioRecordingId
        ? `/api/audio/${t.turn.audioRecordingId}`
        : null,
    })),
    currentQuestion: session.pendingQuestion ?? null,
    answeredCount: answered.length,
    targetCount:
      session.questionsTarget ??
      questionsTargetForDuration(session.durationMinutes ?? 20),
    review: interviewRepository.getReview(sessionId),
  };
}

export function getActiveSimulation(): InterviewSession | null {
  return interviewRepository.getActiveSession("simulation");
}
