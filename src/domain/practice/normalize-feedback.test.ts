import { describe, expect, it } from "vitest";
import {
  COMMUNICATION_CODES,
  ENGLISH_CODES,
  THINKING_CODES,
} from "@/domain/feedback/taxonomy";
import type { EnglishCoachFeedback } from "./english-feedback";
import {
  normalizeEnglishFeedback,
  normalizeVietnameseFeedback,
} from "./normalize-feedback";
import type { VietnameseCoachFeedback } from "./vietnamese-feedback";

const viBase: VietnameseCoachFeedback = {
  summary: "s",
  strengths: [],
  issues: [],
  reflectionQuestions: [],
  suggestions: [],
  improvedVersion: null,
  nextAction: "retry",
};

const enBase: EnglishCoachFeedback = {
  summary: "s",
  strengths: [],
  issues: [],
  topFocusAreas: [],
  improvedVersion: null,
  comparison: null,
};

describe("normalizeVietnameseFeedback", () => {
  it("derives the category from the code for every taxonomy code", () => {
    for (const code of THINKING_CODES) {
      const fb = { ...viBase, issues: [{ category: "communication" as const, code, title: "t", detail: "d" }] };
      expect(normalizeVietnameseFeedback(fb).feedback.issues[0].category).toBe("thinking");
    }
    for (const code of COMMUNICATION_CODES) {
      const fb = { ...viBase, issues: [{ category: "thinking" as const, code, title: "t", detail: "d" }] };
      expect(normalizeVietnameseFeedback(fb).feedback.issues[0].category).toBe("communication");
    }
  });

  it("fixes the measured mix-up and counts it", () => {
    const fb = {
      ...viBase,
      issues: [
        { category: "thinking" as const, code: "incomplete" as const, title: "t", detail: "d" },
        { category: "communication" as const, code: "too_long" as const, title: "t", detail: "d" },
      ],
    };
    const { feedback, corrected } = normalizeVietnameseFeedback(fb);
    expect(corrected).toBe(1);
    expect(feedback.issues.map((i) => i.category)).toEqual(["communication", "communication"]);
  });

  it("returns the same object when nothing needs correcting and leaves the rest alone", () => {
    const fb = {
      ...viBase,
      improvedVersion: "x",
      issues: [{ category: "thinking" as const, code: "weak_logic" as const, title: "t", detail: "d" }],
    };
    const result = normalizeVietnameseFeedback(fb);
    expect(result.feedback).toBe(fb);
    expect(result.corrected).toBe(0);
  });
});

describe("normalizeEnglishFeedback", () => {
  const issue = (code: (typeof ENGLISH_CODES | typeof THINKING_CODES | typeof COMMUNICATION_CODES)[number], category: "content" | "english") => ({
    category,
    code,
    title: "t",
    detail: "d",
    evidence: null,
    naturalness: null,
  });

  it("files english codes under english and the rest under content", () => {
    const fb = {
      ...enBase,
      issues: [
        ...ENGLISH_CODES.map((c) => issue(c, "content")),
        ...[...THINKING_CODES, ...COMMUNICATION_CODES].map((c) => issue(c, "english")),
      ],
    };
    const { feedback, corrected } = normalizeEnglishFeedback(fb);
    expect(corrected).toBe(fb.issues.length);
    for (const i of feedback.issues) {
      expect(i.category).toBe((ENGLISH_CODES as readonly string[]).includes(i.code) ? "english" : "content");
    }
  });

  it("keeps correct issues untouched", () => {
    const fb = { ...enBase, issues: [issue("grammar", "english")] };
    expect(normalizeEnglishFeedback(fb).feedback).toBe(fb);
  });
});
