import { describe, expect, it } from "vitest";
import {
  COMMUNICATION_CODES,
  ENGLISH_CODES,
  THINKING_CODES,
} from "@/domain/feedback/taxonomy";
import { coachingPolicyForAttempt } from "@/domain/practice/coaching-stage";
import type { AIProvider } from "../types";
import { runEnglishCoach } from "./english-coach";
import { runVietnameseCoach } from "./vietnamese-coach";

function capture(): { provider: AIProvider; prompt: () => string } {
  let seen = "";
  const provider = {
    name: "capture",
    generateText: async () => "",
    generateStructured: async (p: { prompt: string }) => {
      seen = p.prompt;
      throw new Error("captured");
    },
  } as unknown as AIProvider;
  return { provider, prompt: () => seen };
}

describe("coach prompts list the allowed issue codes", () => {
  it("Vietnamese Coach names every thinking and communication code", async () => {
    const { provider, prompt } = capture();
    await runVietnameseCoach(
      { prompt: "q", answer: "a", attemptNumber: 1, policy: coachingPolicyForAttempt(1) },
      provider,
    ).catch(() => {});
    for (const code of [...THINKING_CODES, ...COMMUNICATION_CODES]) {
      expect(prompt()).toContain(code);
    }
    expect(prompt()).not.toContain("filler");
  });

  it("English Coach names every content and english code", async () => {
    const { provider, prompt } = capture();
    await runEnglishCoach(
      { prompt: "q", transcript: "t", allowImprovedVersion: false },
      provider,
    ).catch(() => {});
    for (const code of [...THINKING_CODES, ...COMMUNICATION_CODES, ...ENGLISH_CODES]) {
      expect(prompt()).toContain(code);
    }
  });
});
