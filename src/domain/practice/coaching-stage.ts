/**
 * Staged coaching rules - a CRITICAL business rule (§18, §69, §103).
 *
 * The APPLICATION controls the workflow; the AI only provides intelligence
 * (Rule 3). This pure module encodes what each attempt is *allowed* to reveal,
 * independent of anything the AI returns:
 *
 *   Attempt 1  → diagnosis + reflection questions.        NO full rewrite.
 *   Attempt 2  → direction + structure hints.             NO full rewrite.
 *   Attempt 3+ → improved version MAY be revealed.
 *
 * The user always controls completion ("I'm Satisfied" / "Keep Improving").
 */

export type CoachingStage = "diagnose" | "guide" | "improve";

export interface CoachingPolicy {
  stage: CoachingStage;
  /** May the improved/rewritten version be shown to the user this attempt? */
  canRevealImprovedVersion: boolean;
  /** May concrete structural hints/direction be given? */
  canGiveDirection: boolean;
  /** Short human label for UI. */
  label: string;
}

export function coachingPolicyForAttempt(attemptNumber: number): CoachingPolicy {
  if (attemptNumber <= 1) {
    return {
      stage: "diagnose",
      canRevealImprovedVersion: false,
      canGiveDirection: false,
      label: "Diagnose",
    };
  }
  if (attemptNumber === 2) {
    return {
      stage: "guide",
      canRevealImprovedVersion: false,
      canGiveDirection: true,
      label: "Guide",
    };
  }
  return {
    stage: "improve",
    canRevealImprovedVersion: true,
    canGiveDirection: true,
    label: "Improve",
  };
}

/**
 * Enforce the policy on any feedback object regardless of what the AI produced.
 * This is the guardrail that makes the acceptance criteria hold even if a model
 * ignores its instructions.
 */
export function enforceCoachingPolicy<
  T extends { improvedVersion?: string | null },
>(feedback: T, policy: CoachingPolicy): T {
  if (!policy.canRevealImprovedVersion && feedback.improvedVersion) {
    return { ...feedback, improvedVersion: null };
  }
  return feedback;
}
