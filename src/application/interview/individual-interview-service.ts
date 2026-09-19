import "server-only";
import type { InterviewSession, TurnKind } from "@/domain/interview/types";
import type { InterviewFeedback } from "@/domain/interview/interview-feedback";
import { seedOpeningQuestion } from "@/domain/interview/interview-seed";
import { AIProviderError, AIStructuredError } from "@/infrastructure/ai/errors";
import {
  generateOpeningQuestion,
  evaluateInterviewAnswer,
  INTERVIEWER_PROMPT_VERSION,
} from "@/infrastructure/ai/roles/interviewer";
import { LocalAudioStorage } from "@/infrastructure/audio/local-audio-storage";
import type { StoredAudio } from "@/infrastructure/audio/types";
import { getSpeechProvider } from "@/infrastructure/speech/provider";
import { db } from "@/infrastructure/db/client";
import { audioRecordings, transcripts } from "@/infrastructure/db/schema";
import {
  interviewRepository,
  type TurnWithFeedback,
} from "@/infrastructure/db/repositories/interview-repository";
import { ids } from "@/lib/ids";
import { logger } from "@/lib/logger";
import {
  buildMemorySummary,
  extractFromInterviewIndividual,
} from "@/application/memory/memory-service";

/**
 * Application service for INDIVIDUAL interview practice (§30, §33, §34).
 *
 * The app owns the flow: it holds the current pending question, decides retry
 * vs follow-up, and stores turns. The interviewer AI only asks and evaluates.
 * Follow-ups are generated from the candidate's actual answer (§33).
 */

const audioStorage = new LocalAudioStorage();

export async function startIndividualInterview(input: {
  categories: string[];
  technologies: string[];
}): Promise<{ session: InterviewSession; question: string }> {
  const seed = seedOpeningQuestion(input.categories);
  let question = seed;
  try {
    question = await generateOpeningQuestion({
      categories: input.categories,
      technologies: input.technologies,
      seed,
    });
  } catch (e) {
    logger.warn("interview_opening_fallback_to_seed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const session = interviewRepository.createSession({
    mode: "individual",
    categories: input.categories,
    technologies: input.technologies,
    pendingQuestion: question,
    pendingKind: "opening",
  });
  return { session, question };
}

/** Set the next question to answer: the follow-up, or a retry of the current one. */
export function setNextQuestion(
  sessionId: string,
  question: string,
  kind: TurnKind,
) {
  interviewRepository.setPending(sessionId, question, kind);
}

export type SubmitInterviewResult =
  | {
      ok: true;
      audioUrl: string;
      transcript: string;
      feedback: InterviewFeedback;
    }
  | {
      ok: false;
      audioUrl: string;
      transcript?: string;
      error: "no_pending_question" | "transcription_failed" | "ai_failed";
      message: string;
    };

export async function submitInterviewAnswer(input: {
  sessionId: string;
  audio: Buffer;
  mimeType: string;
  durationMs?: number;
  clientTranscript?: string;
}): Promise<SubmitInterviewResult> {
  const session = interviewRepository.getSession(input.sessionId);
  if (!session) throw new Error(`Interview not found: ${input.sessionId}`);

  const question = session.pendingQuestion;
  const kind = (session.pendingKind ?? "opening") as TurnKind;
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
  const audioUrl = `/api/audio/${audioId}`;
  saveAudioRow(audioId, stored);

  // Transcript: browser transcript preferred, else server transcription.
  let transcript = input.clientTranscript?.trim() ?? "";
  if (!transcript) {
    try {
      const r = await getSpeechProvider().transcribe(input.audio, input.mimeType);
      transcript = r.text.trim();
    } catch (e) {
      logger.error("interview_transcription_failed", {
        sessionId: input.sessionId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  if (!transcript) {
    interviewRepository.createTurn({
      sessionId: input.sessionId,
      kind,
      question,
      audioRecordingId: audioId,
    });
    return {
      ok: false,
      audioUrl,
      error: "transcription_failed",
      message:
        "I couldn't understand enough of the recording. Try speaking a little closer to the microphone, then answer again.",
    };
  }

  const transcriptId = saveTranscriptRow(audioId, transcript);

  const previousAnswer =
    kind === "retry" ? findLastAnswerFor(input.sessionId, question) : undefined;

  try {
    const feedback = await evaluateInterviewAnswer({
      question,
      answer: transcript,
      categories: session.categories,
      previousAnswer,
      relevantMemory: buildMemorySummary([
        "interview_pattern",
        "communication_pattern",
      ]),
      sessionId: input.sessionId,
    });

    interviewRepository.createTurn({
      sessionId: input.sessionId,
      kind,
      question,
      answer: transcript,
      audioRecordingId: audioId,
      transcriptId,
      feedback,
      promptVersion: INTERVIEWER_PROMPT_VERSION,
    });

    // Default next question is the adaptive follow-up.
    interviewRepository.setPending(
      input.sessionId,
      feedback.followUpQuestion,
      "followup",
    );

    return { ok: true, audioUrl, transcript, feedback };
  } catch (e) {
    const isKnown =
      e instanceof AIStructuredError || e instanceof AIProviderError;
    logger.error("interview_evaluation_failed", {
      sessionId: input.sessionId,
      error: e instanceof Error ? e.message : String(e),
    });
    interviewRepository.createTurn({
      sessionId: input.sessionId,
      kind,
      question,
      answer: transcript,
      audioRecordingId: audioId,
      transcriptId,
    });
    if (!isKnown) throw e;
    return {
      ok: false,
      audioUrl,
      transcript,
      error: "ai_failed",
      message:
        "Something went wrong while reviewing your answer. Your recording and transcript were saved - you can try again.",
    };
  }
}

export function completeIndividualInterview(sessionId: string) {
  interviewRepository.setStatus(sessionId, "completed");
  extractFromInterviewIndividual(sessionId);
}

export function abandonIndividualInterview(sessionId: string) {
  interviewRepository.setStatus(sessionId, "abandoned");
}

export interface IndividualInterviewState {
  session: InterviewSession;
  turns: {
    sequence: number;
    kind: TurnKind;
    question: string;
    answer: string | null;
    audioUrl: string | null;
    feedback: InterviewFeedback | null;
  }[];
  currentQuestion: string | null;
  currentKind: TurnKind;
}

export function getIndividualInterviewState(
  sessionId: string,
): IndividualInterviewState | null {
  const session = interviewRepository.getSession(sessionId);
  if (!session) return null;
  const turns = interviewRepository.listTurns(sessionId);
  return {
    session,
    turns: turns.map((t: TurnWithFeedback) => ({
      sequence: t.turn.sequence,
      kind: t.turn.kind,
      question: t.turn.question,
      answer: t.turn.answer ?? null,
      audioUrl: t.turn.audioRecordingId
        ? `/api/audio/${t.turn.audioRecordingId}`
        : null,
      feedback: t.feedback,
    })),
    currentQuestion: session.pendingQuestion ?? null,
    currentKind: (session.pendingKind ?? "opening") as TurnKind,
  };
}

export function getActiveIndividualInterview(): InterviewSession | null {
  return interviewRepository.getActiveSession("individual");
}

function findLastAnswerFor(
  sessionId: string,
  question: string,
): string | undefined {
  const turns = interviewRepository.listTurns(sessionId);
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i].turn;
    if (t.question === question && t.answer) return t.answer;
  }
  return undefined;
}

// --- small persistence helpers ---

function saveAudioRow(id: string, stored: StoredAudio) {
  db.insert(audioRecordings)
    .values({
      id,
      relativePath: stored.relativePath,
      mimeType: stored.mimeType,
      bytes: stored.bytes,
    })
    .run();
}

function saveTranscriptRow(audioRecordingId: string, text: string): string {
  const id = ids.transcript();
  db.insert(transcripts)
    .values({ id, audioRecordingId, text, source: "interview" })
    .run();
  return id;
}
