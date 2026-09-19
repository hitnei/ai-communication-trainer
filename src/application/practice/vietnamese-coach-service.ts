import "server-only";
import {
  coachingPolicyForAttempt,
  enforceCoachingPolicy,
  type CoachingPolicy,
} from "@/domain/practice/coaching-stage";
import type {
  PracticeSession,
  VietnameseExerciseType,
} from "@/domain/practice/types";
import type { VietnameseCoachFeedback } from "@/domain/practice/vietnamese-feedback";
import { AIStructuredError, AIProviderError } from "@/infrastructure/ai/errors";
import {
  runVietnameseCoach,
  VIETNAMESE_COACH_PROMPT_VERSION,
} from "@/infrastructure/ai/roles/vietnamese-coach";
import {
  practiceRepository,
  type AttemptWithFeedback,
} from "@/infrastructure/db/repositories/practice-repository";
import { logger } from "@/lib/logger";
import {
  buildMemorySummary,
  extractFromVietnamese,
} from "@/application/memory/memory-service";

/**
 * Application service for the Vietnamese coaching loop.
 *
 * This layer OWNS the workflow (Rule 3): it decides the attempt number and the
 * coaching stage, enforces the "no full rewrite before attempt 3" rule, and
 * decides when a session completes. The AI role only supplies analysis.
 */

export interface StartSessionInput {
  exerciseType?: VietnameseExerciseType;
  prompt: string;
  goal: string;
}

export function startVietnameseSession(
  input: StartSessionInput,
): PracticeSession {
  return practiceRepository.createSession({
    mode: "vietnamese",
    goal: input.goal,
    exerciseType: input.exerciseType,
    prompt: input.prompt,
  });
}

export type SubmitAttemptResult =
  | {
      ok: true;
      attemptId: string;
      attemptNumber: number;
      policy: CoachingPolicy;
      feedback: VietnameseCoachFeedback;
    }
  | {
      ok: false;
      /** User work is always preserved even on failure (§65, §77). */
      attemptId: string;
      attemptNumber: number;
      error: "ai_failed";
      message: string;
    };

export async function submitVietnameseAttempt(input: {
  sessionId: string;
  answer: string;
}): Promise<SubmitAttemptResult> {
  const session = practiceRepository.getSession(input.sessionId);
  if (!session) throw new Error(`Session not found: ${input.sessionId}`);

  // Application decides the attempt number and stage - not the AI.
  const attemptNumber = practiceRepository.countAttempts(input.sessionId) + 1;
  const policy = coachingPolicyForAttempt(attemptNumber);

  // Persist the user's work FIRST so it survives any AI failure.
  const attempt = practiceRepository.createAttempt({
    sessionId: input.sessionId,
    attemptNumber,
    textAnswer: input.answer,
  });

  const previous = attemptNumber > 1
    ? findPreviousAnswer(input.sessionId, attemptNumber)
    : undefined;

  try {
    const raw = await runVietnameseCoach({
      exerciseType: session.exerciseType,
      prompt: session.prompt,
      answer: input.answer,
      attemptNumber,
      policy,
      previousAnswer: previous,
      relevantMemory: buildMemorySummary(["communication_pattern"]),
      sessionId: input.sessionId,
    });

    // Guardrail: enforce the stage rule regardless of what the model returned.
    const feedback = enforceCoachingPolicy(raw, policy);

    practiceRepository.saveFeedback({
      attemptId: attempt.id,
      role: "vietnamese-coach",
      promptVersion: VIETNAMESE_COACH_PROMPT_VERSION,
      stage: policy.stage,
      feedback,
    });

    return {
      ok: true,
      attemptId: attempt.id,
      attemptNumber,
      policy,
      feedback,
    };
  } catch (e) {
    const isKnown =
      e instanceof AIStructuredError || e instanceof AIProviderError;
    logger.error("vietnamese_attempt_failed", {
      sessionId: input.sessionId,
      attemptNumber,
      error: e instanceof Error ? e.message : String(e),
    });
    if (!isKnown) throw e;
    return {
      ok: false,
      attemptId: attempt.id,
      attemptNumber,
      error: "ai_failed",
      message:
        "Something went wrong while analyzing your answer. Your work has been saved locally.",
    };
  }
}

/** "I'm Satisfied" - user controls completion (§18). Then extract memory (§45). */
export function completeVietnameseSession(sessionId: string) {
  practiceRepository.setSessionStatus(sessionId, "completed");
  extractFromVietnamese(sessionId);
}

export function abandonVietnameseSession(sessionId: string) {
  practiceRepository.setSessionStatus(sessionId, "abandoned");
}

export interface SessionState {
  session: PracticeSession;
  attempts: AttemptWithFeedback<VietnameseCoachFeedback>[];
  nextPolicy: CoachingPolicy;
}

export function getSessionState(sessionId: string): SessionState | null {
  const session = practiceRepository.getSession(sessionId);
  if (!session) return null;
  const attempts =
    practiceRepository.listAttempts<VietnameseCoachFeedback>(sessionId);
  return {
    session,
    attempts,
    nextPolicy: coachingPolicyForAttempt(attempts.length + 1),
  };
}

/** Session recovery (§78): surface an unfinished session on next launch. */
export function getActiveVietnameseSession(): PracticeSession | null {
  return practiceRepository.getActiveSession("vietnamese");
}

function findPreviousAnswer(
  sessionId: string,
  attemptNumber: number,
): string | undefined {
  const attempts = practiceRepository.listAttempts(sessionId);
  const prev = attempts.find((a) => a.attempt.attemptNumber === attemptNumber - 1);
  return prev?.attempt.textAnswer ?? undefined;
}
