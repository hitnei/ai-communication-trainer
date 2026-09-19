import "server-only";
import type {
  PracticeSession,
  VietnameseExerciseType,
} from "@/domain/practice/types";
import type {
  EnglishAttemptFeedback,
} from "@/domain/practice/english-feedback";
import { AIProviderError, AIStructuredError } from "@/infrastructure/ai/errors";
import {
  runEnglishCoach,
  ENGLISH_COACH_PROMPT_VERSION,
} from "@/infrastructure/ai/roles/english-coach";
import { runPronunciationCoach } from "@/infrastructure/ai/roles/pronunciation-coach";
import { LocalAudioStorage } from "@/infrastructure/audio/local-audio-storage";
import { getSpeechProvider } from "@/infrastructure/speech/provider";
import {
  practiceRepository,
  type AttemptWithFeedback,
} from "@/infrastructure/db/repositories/practice-repository";
import { profileRepository } from "@/infrastructure/db/repositories/profile-repository";
import { ids } from "@/lib/ids";
import { logger } from "@/lib/logger";
import {
  buildMemorySummary,
  extractFromEnglish,
} from "@/application/memory/memory-service";

/**
 * Application service for the English voice loop (§20-§28).
 *
 * The app owns the workflow: it assigns the attempt number, decides when an
 * improved version may appear (attempt 2+, §28), runs content and pronunciation
 * analysis in parallel (§95), and always preserves the user's audio + transcript
 * even when analysis fails (§77).
 */

const audioStorage = new LocalAudioStorage();

export interface StartEnglishSessionInput {
  exerciseType?: VietnameseExerciseType;
  prompt: string;
  goal: string;
}

export function startEnglishSession(
  input: StartEnglishSessionInput,
): PracticeSession {
  return practiceRepository.createSession({
    mode: "english",
    goal: input.goal,
    exerciseType: input.exerciseType,
    prompt: input.prompt,
  });
}

export type SubmitEnglishResult =
  | {
      ok: true;
      attemptId: string;
      attemptNumber: number;
      audioUrl: string;
      feedback: EnglishAttemptFeedback;
    }
  | {
      ok: false;
      attemptId: string;
      attemptNumber: number;
      audioUrl: string;
      transcript?: string;
      error: "transcription_failed" | "ai_failed";
      message: string;
    };

export async function submitEnglishAttempt(input: {
  sessionId: string;
  audio: Buffer;
  mimeType: string;
  durationMs?: number;
  /** Optional client-side (browser) transcript; preferred when present. */
  clientTranscript?: string;
}): Promise<SubmitEnglishResult> {
  const session = practiceRepository.getSession(input.sessionId);
  if (!session) throw new Error(`Session not found: ${input.sessionId}`);

  const attemptNumber = practiceRepository.countAttempts(input.sessionId) + 1;

  // Persist audio first so replay works no matter what happens next.
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

  // Obtain a transcript: browser transcript wins; else server transcription.
  let transcript = input.clientTranscript?.trim() ?? "";
  let transcriptSource = "browser";
  if (!transcript) {
    try {
      const result = await getSpeechProvider().transcribe(
        input.audio,
        input.mimeType,
      );
      transcript = result.text.trim();
      transcriptSource = getSpeechProvider().name;
    } catch (e) {
      logger.error("english_transcription_failed", {
        sessionId: input.sessionId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (!transcript) {
    const attempt = practiceRepository.createAttempt({
      sessionId: input.sessionId,
      attemptNumber,
      audioRecordingId: audioId,
    });
    return {
      ok: false,
      attemptId: attempt.id,
      attemptNumber,
      audioUrl,
      error: "transcription_failed",
      message:
        "I couldn't understand enough of the recording. Try speaking a little closer to the microphone, then record again.",
    };
  }

  const transcriptId = practiceRepository.saveTranscript({
    audioRecordingId: audioId,
    text: transcript,
    source: transcriptSource,
  });

  // Persist the attempt (with transcript) before analysis, so work survives.
  const attempt = practiceRepository.createAttempt({
    sessionId: input.sessionId,
    attemptNumber,
    textAnswer: transcript,
    audioRecordingId: audioId,
    transcriptId,
  });

  const previousTranscript = findPreviousTranscript(
    input.sessionId,
    attemptNumber,
  );
  const allowImprovedVersion = attemptNumber >= 2;

  try {
    // Content/English analysis is required; pronunciation is best-effort (§26).
    const [english, pronunciation] = await Promise.all([
      runEnglishCoach({
        exerciseType: session.exerciseType,
        prompt: session.prompt,
        transcript,
        previousTranscript,
        allowImprovedVersion,
        relevantMemory: buildMemorySummary([
          "communication_pattern",
          "english_pattern",
          "pronunciation_pattern",
        ]),
        sessionId: input.sessionId,
      }),
      runPronunciationCoach({
        audioBase64: input.audio.toString("base64"),
        mimeType: input.mimeType,
        transcript,
        sessionId: input.sessionId,
      }).catch((e) => {
        logger.warn("pronunciation_analysis_skipped", {
          sessionId: input.sessionId,
          error: e instanceof Error ? e.message : String(e),
        });
        return null;
      }),
    ]);

    // Guardrail (§28): never reveal an improved version before it's allowed,
    // regardless of what the model returned.
    if (!allowImprovedVersion) english.improvedVersion = null;

    const feedback: EnglishAttemptFeedback = {
      transcript,
      transcriptSource,
      english,
      pronunciation,
    };

    practiceRepository.saveFeedback({
      attemptId: attempt.id,
      role: "english-coach",
      promptVersion: ENGLISH_COACH_PROMPT_VERSION,
      stage: "english",
      feedback,
    });

    return { ok: true, attemptId: attempt.id, attemptNumber, audioUrl, feedback };
  } catch (e) {
    const isKnown =
      e instanceof AIStructuredError || e instanceof AIProviderError;
    logger.error("english_attempt_failed", {
      sessionId: input.sessionId,
      attemptNumber,
      error: e instanceof Error ? e.message : String(e),
    });
    if (!isKnown) throw e;
    return {
      ok: false,
      attemptId: attempt.id,
      attemptNumber,
      audioUrl,
      transcript,
      error: "ai_failed",
      message:
        "Something went wrong while analyzing your answer. Your recording and transcript were saved - you can try again.",
    };
  }
}

export function completeEnglishSession(sessionId: string) {
  practiceRepository.setSessionStatus(sessionId, "completed");
  extractFromEnglish(sessionId);
}

export function abandonEnglishSession(sessionId: string) {
  practiceRepository.setSessionStatus(sessionId, "abandoned");
}

export interface EnglishAttemptView {
  attemptNumber: number;
  transcript: string | null;
  audioUrl: string | null;
  feedback: EnglishAttemptFeedback | null;
}

export interface EnglishSessionState {
  session: PracticeSession;
  attempts: EnglishAttemptView[];
  transcriptMode: "live" | "after";
}

export function getEnglishSessionState(
  sessionId: string,
): EnglishSessionState | null {
  const session = practiceRepository.getSession(sessionId);
  if (!session) return null;
  const attempts =
    practiceRepository.listAttempts<EnglishAttemptFeedback>(sessionId);
  return {
    session,
    transcriptMode: profileRepository.getTranscriptMode(),
    attempts: attempts.map((a): EnglishAttemptView => ({
      attemptNumber: a.attempt.attemptNumber,
      transcript: a.attempt.textAnswer ?? null,
      audioUrl: a.attempt.audioRecordingId
        ? `/api/audio/${a.attempt.audioRecordingId}`
        : null,
      feedback: a.feedback?.feedback ?? null,
    })),
  };
}

export function getActiveEnglishSession(): PracticeSession | null {
  return practiceRepository.getActiveSession("english");
}

function findPreviousTranscript(
  sessionId: string,
  attemptNumber: number,
): string | undefined {
  const attempts: AttemptWithFeedback[] =
    practiceRepository.listAttempts(sessionId);
  const prev = attempts.find(
    (a) => a.attempt.attemptNumber === attemptNumber - 1,
  );
  return prev?.attempt.textAnswer ?? undefined;
}
