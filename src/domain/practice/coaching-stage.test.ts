import { describe, it, expect } from "vitest";
import {
  coachingPolicyForAttempt,
  enforceCoachingPolicy,
} from "./coaching-stage";

describe("coaching stage policy (Phase 1 acceptance criteria)", () => {
  it("attempt 1 cannot reveal a full rewrite", () => {
    const p = coachingPolicyForAttempt(1);
    expect(p.stage).toBe("diagnose");
    expect(p.canRevealImprovedVersion).toBe(false);
    expect(p.canGiveDirection).toBe(false);
  });

  it("attempt 2 cannot reveal a full rewrite", () => {
    const p = coachingPolicyForAttempt(2);
    expect(p.stage).toBe("guide");
    expect(p.canRevealImprovedVersion).toBe(false);
    expect(p.canGiveDirection).toBe(true);
  });

  it("attempt 3+ may reveal an improved version", () => {
    for (const n of [3, 4, 10]) {
      const p = coachingPolicyForAttempt(n);
      expect(p.stage).toBe("improve");
      expect(p.canRevealImprovedVersion).toBe(true);
    }
  });

  it("enforcement strips an improved version before attempt 3", () => {
    const feedback = { improvedVersion: "một câu trả lời hoàn chỉnh" };
    const stripped = enforceCoachingPolicy(
      feedback,
      coachingPolicyForAttempt(1),
    );
    expect(stripped.improvedVersion).toBeNull();

    const strippedGuide = enforceCoachingPolicy(
      { ...feedback },
      coachingPolicyForAttempt(2),
    );
    expect(strippedGuide.improvedVersion).toBeNull();
  });

  it("enforcement keeps an improved version at attempt 3+", () => {
    const feedback = { improvedVersion: "một câu trả lời hoàn chỉnh" };
    const kept = enforceCoachingPolicy(feedback, coachingPolicyForAttempt(3));
    expect(kept.improvedVersion).toBe("một câu trả lời hoàn chỉnh");
  });
});
