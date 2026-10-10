import { describe, expect, it } from "vitest";
import type { EnglishCoachFeedback } from "@/domain/practice/english-feedback";
import type { VietnameseCoachFeedback } from "@/domain/practice/vietnamese-feedback";
import {
  evaluateEnglish,
  evaluateVietnamese,
  voiceOverlap,
  vietnameseRatio,
  type EnglishCase,
  type VietnameseCase,
} from "./checks";
import { englishCases } from "./english-cases";
import { compare, isRegression, summarize, toOutcome } from "./report";
import { estimateCost, usageCostUsd } from "./cost";
import { vietnameseCases } from "./vietnamese-cases";

const obs = { summary: "", issues: [], improvedVersion: null };

const failed = (results: { name: string; pass: boolean }[]) =>
  results.filter((r) => !r.pass).map((r) => r.name);

const viCase: VietnameseCase = {
  id: "t",
  prompt: "p",
  answer: "Màn hình danh sách bị chậm vì gọi API tuần tự.",
  attemptNumber: 1,
  expect: { anyCode: ["main_point_late"] },
};

const goodVi: VietnameseCoachFeedback = {
  summary: "Ý chính của bạn xuất hiện hơi muộn so với phần bối cảnh.",
  strengths: [],
  issues: [
    {
      category: "communication",
      code: "main_point_late",
      title: "Ý chính muộn",
      detail: "Bạn kể bối cảnh quá lâu trước khi nói vấn đề.",
    },
  ],
  reflectionQuestions: ["Nếu chỉ nói một câu, bạn sẽ nói gì?"],
  suggestions: [],
  improvedVersion: null,
  nextAction: "retry",
};

const enCase: EnglishCase = {
  id: "t",
  prompt: "p",
  transcript: "You know what my mean, the list was slow.",
  allowImprovedVersion: false,
  expect: { mustFlag: ["you know what my mean"] },
};

const goodEn: EnglishCoachFeedback = {
  summary: "Clear point, one phrase to fix.",
  strengths: [],
  issues: [
    {
      category: "english",
      code: "grammar",
      title: "Wrong pronoun",
      detail: "Say 'I mean'.",
      evidence: "You know what my mean",
      naturalness: "incorrect",
    },
  ],
  topFocusAreas: ["Fix the phrase"],
  improvedVersion: null,
  comparison: null,
};

describe("evaluateVietnamese", () => {
  it("passes a well-behaved diagnose response", () => {
    expect(failed(evaluateVietnamese(viCase, goodVi))).toEqual([]);
  });

  it("catches a rewrite leaked before attempt 3", () => {
    const leaked = { ...goodVi, improvedVersion: "Một bản viết lại đầy đủ." };
    expect(failed(evaluateVietnamese(viCase, leaked))).toContain(
      "no_rewrite_before_attempt_3",
    );
  });

  it("catches thinking/communication mix-ups", () => {
    const mixed: VietnameseCoachFeedback = {
      ...goodVi,
      issues: [{ ...goodVi.issues[0], category: "thinking" }],
    };
    expect(failed(evaluateVietnamese(viCase, mixed))).toContain(
      "category_matches_code",
    );
  });

  it("catches an English response from the Vietnamese coach", () => {
    const english = {
      ...goodVi,
      summary: "Your main point comes late.",
      issues: [{ ...goodVi.issues[0], detail: "You describe context first." }],
      reflectionQuestions: ["What would you say in one sentence?"],
    };
    expect(failed(evaluateVietnamese(viCase, english))).toContain(
      "responds_in_vietnamese",
    );
  });

  it("requires a voice-preserving rewrite at attempt 3+", () => {
    const c = { ...viCase, attemptNumber: 3 };
    const faithful = {
      ...goodVi,
      improvedVersion: "Màn hình danh sách bị chậm vì gọi API tuần tự, nên em gộp lại.",
    };
    const foreign = { ...goodVi, improvedVersion: "Hoàn toàn khác biệt nội dung gốc luôn." };
    expect(failed(evaluateVietnamese(c, faithful))).toEqual([]);
    expect(failed(evaluateVietnamese(c, foreign))).toContain("keeps_user_voice");
    expect(failed(evaluateVietnamese(c, goodVi))).toContain("has_improved_version");
  });

  it("catches a missed diagnosis", () => {
    const wrong: VietnameseCoachFeedback = {
      ...goodVi,
      issues: [{ ...goodVi.issues[0], code: "too_long" }],
    };
    expect(failed(evaluateVietnamese(viCase, wrong))).toContain(
      "diagnoses_expected_problem",
    );
  });
});

describe("evaluateEnglish", () => {
  it("passes a well-behaved response", () => {
    expect(failed(evaluateEnglish(enCase, goodEn))).toEqual([]);
  });

  it("catches a fabricated evidence quote", () => {
    const fake: EnglishCoachFeedback = {
      ...goodEn,
      issues: [{ ...goodEn.issues[0], evidence: "something never said" }],
    };
    expect(failed(evaluateEnglish(enCase, fake))).toContain("evidence_is_real_quote");
  });

  it("accepts an ellipsis-joined quote of the transcript", () => {
    const quoted: EnglishCoachFeedback = {
      ...goodEn,
      issues: [{ ...goodEn.issues[0], evidence: "You know... the list was slow" }],
    };
    expect(failed(evaluateEnglish(enCase, quoted))).not.toContain(
      "evidence_is_real_quote",
    );
  });

  it("catches over-correcting a natural phrase", () => {
    const c: EnglishCase = {
      ...enCase,
      transcript: "Yeah, exactly, that was the plan.",
      expect: { mustNotFlag: ["yeah, exactly"] },
    };
    const overcorrected: EnglishCoachFeedback = {
      ...goodEn,
      issues: [
        { ...goodEn.issues[0], code: "unnatural_phrase", evidence: "Yeah, exactly" },
      ],
    };
    expect(failed(evaluateEnglish(c, overcorrected))).toContain(
      'leaves "yeah, exactly" alone',
    );
    expect(failed(evaluateEnglish(c, { ...goodEn, issues: [] }))).toEqual([]);
  });

  it("catches a rewrite when not allowed and a missing comparison", () => {
    const withHistory = { ...enCase, previousTranscript: "It was slow." };
    const bad = { ...goodEn, improvedVersion: "A rewrite." };
    const names = failed(evaluateEnglish(withHistory, bad));
    expect(names).toContain("no_rewrite_when_not_allowed");
    expect(names).toContain("comparison_matches_history");
  });
});

describe("hard-case expectations", () => {
  const base: VietnameseCase = {
    id: "t",
    prompt: "p",
    answer: "một hai ba bốn năm sáu bảy tám chín mười",
    attemptNumber: 3,
    expect: {},
  };

  it("rejects an issue in a forbidden category", () => {
    const c: VietnameseCase = { ...base, attemptNumber: 1, expect: { noCategory: ["thinking"] } };
    const bad: VietnameseCoachFeedback = {
      ...goodVi,
      issues: [{ ...goodVi.issues[0], category: "thinking", code: "weak_logic" }],
    };
    expect(failed(evaluateVietnamese(c, bad))).toContain("no_thinking_issues");
    expect(failed(evaluateVietnamese(c, goodVi))).not.toContain("no_thinking_issues");
  });

  it("applies a stricter voice-overlap floor", () => {
    const c: VietnameseCase = { ...base, expect: { minVoiceOverlap: 0.9 } };
    const edited = { ...goodVi, improvedVersion: "một hai ba bốn năm sáu bảy tám xyz abc" };
    expect(failed(evaluateVietnamese(c, edited))).toContain("keeps_user_voice");
    const loose: VietnameseCase = { ...base, expect: { minVoiceOverlap: 0.5 } };
    expect(failed(evaluateVietnamese(loose, edited))).not.toContain("keeps_user_voice");
  });

  it("requires a tighter rewrite when asked", () => {
    const c: VietnameseCase = { ...base, expect: { rewriteShorterThanInput: true, minVoiceOverlap: 0 } };
    const longer = { ...goodVi, improvedVersion: `${base.answer} thêm nữa` };
    const shorter = { ...goodVi, improvedVersion: "một hai ba" };
    expect(failed(evaluateVietnamese(c, longer))).toContain("rewrite_is_tighter");
    expect(failed(evaluateVietnamese(c, shorter))).not.toContain("rewrite_is_tighter");
  });

  it("applies a stricter voice floor to the English improved version", () => {
    const c: EnglishCase = {
      ...enCase,
      transcript: "the list was slow because of many calls",
      allowImprovedVersion: true,
      expect: { minVoiceOverlap: 0.9 },
    };
    const rewrite = { ...goodEn, improvedVersion: "the screen loaded slowly due to sequential requests" };
    expect(failed(evaluateEnglish(c, rewrite))).toContain("keeps_user_voice");
  });
});

describe("helpers", () => {
  it("measures voice overlap and Vietnamese ratio", () => {
    expect(voiceOverlap("a b c d", "a b c d e")).toBe(1);
    expect(voiceOverlap("a b c d", "x y z")).toBe(0);
    expect(vietnameseRatio("Ý chính xuất hiện muộn")).toBeGreaterThan(0.12);
    expect(vietnameseRatio("The main point comes late")).toBe(0);
  });

  it("compares a report with its baseline", () => {
    const base = summarize("r", "v1", [
      toOutcome("a", "", [{ name: "x", pass: true }], obs),
      toOutcome("b", "", [{ name: "x", pass: false }], obs),
    ]);
    const next = summarize("r", "v2", [
      toOutcome("a", "", [{ name: "x", pass: false }], obs),
      toOutcome("b", "", [{ name: "x", pass: true }], obs),
    ]);
    const worse = summarize("r", "v2", [
      toOutcome("a", "", [{ name: "x", pass: false }], obs),
      toOutcome("b", "", [{ name: "x", pass: false }], obs),
    ]);
    expect(compare(next, base)).toMatchObject({
      verdict: "same",
      regressions: ["a"],
      fixes: ["b"],
    });
    expect(compare(worse, base).verdict).toBe("worse");
    expect(compare(base, undefined).verdict).toBe("no_baseline");
  });

  it("does not count newly added cases against the pass-rate", () => {
    const base = summarize("r", "v1", [
      toOutcome("a", "", [{ name: "x", pass: true }], obs),
      toOutcome("b", "", [{ name: "x", pass: true }], obs),
    ]);
    const harder = summarize("r", "v1", [
      toOutcome("a", "", [{ name: "x", pass: true }], obs),
      toOutcome("b", "", [{ name: "x", pass: true }], obs),
      toOutcome("hard-1", "", [{ name: "x", pass: false }], obs),
      toOutcome("hard-2", "", [{ name: "x", pass: false }], obs),
    ]);
    const result = compare(harder, base);
    expect(harder.passRate).toBe(0.5);
    expect(result.delta).toBe(0);
    expect(result.verdict).toBe("same");
    expect(result.newCases).toEqual(["hard-1", "hard-2"]);
    expect(isRegression(result)).toBe(false);
  });

  it("reports cases removed since the baseline", () => {
    const base = summarize("r", "v1", [
      toOutcome("a", "", [{ name: "x", pass: true }], obs),
      toOutcome("gone", "", [{ name: "x", pass: true }], obs),
    ]);
    const next = summarize("r", "v1", [toOutcome("a", "", [{ name: "x", pass: true }], obs)]);
    expect(compare(next, base).removedCases).toEqual(["gone"]);
  });

  it("turns measured usage into cost and counts thinking as output", () => {
    const usage = { calls: 2, promptTokens: 2_000, outputTokens: 1_000, thoughtsTokens: 3_000 };
    const prices = { inputPerMillion: 1, outputPerMillion: 10 };
    expect(usageCostUsd(usage, prices)).toBeCloseTo(0.002 + 0.04);
  });

  it("estimates from measured usage when available, else from an assumption", () => {
    const prices = { inputPerMillion: 1.5, outputPerMillion: 9 };
    const measured = { calls: 12, promptTokens: 12_000, outputTokens: 9_600, thoughtsTokens: 24_000 };
    const real = estimateCost(24, measured, prices);
    expect(real.basis).toBe("measured");
    expect(real.lowUsd).toBeCloseTo(usageCostUsd(measured, prices) * 2);
    expect(real.highUsd).toBeGreaterThan(real.lowUsd);

    const guess = estimateCost(24, null, prices);
    expect(guess.basis).toBe("assumed");
    expect(guess.highUsd).toBeGreaterThan(guess.lowUsd);
  });

  it("keeps case ids unique and datasets large enough", () => {
    const ids = [...vietnameseCases, ...englishCases].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(vietnameseCases.length).toBeGreaterThanOrEqual(23);
    expect(englishCases.length).toBeGreaterThanOrEqual(23);
  });

  it("only expects phrases that really appear in the transcript", () => {
    const norm = (t: string) => (t.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []).join(" ");
    for (const c of englishCases) {
      const text = norm(`${c.transcript} ${c.previousTranscript ?? ""}`);
      for (const phrase of [...(c.expect.mustFlag ?? []), ...(c.expect.mustNotFlag ?? [])]) {
        expect(text, `${c.id}: "${phrase}" not in transcript`).toContain(norm(phrase));
      }
    }
  });

  it("keeps hard-case expectations in range", () => {
    for (const c of [...vietnameseCases, ...englishCases]) {
      const floor = c.expect.minVoiceOverlap;
      if (floor !== undefined) expect(floor).toBeGreaterThanOrEqual(0);
      if (floor !== undefined) expect(floor).toBeLessThanOrEqual(1);
    }
    for (const c of vietnameseCases.filter((x) => x.id.includes("injection"))) {
      expect(c.attemptNumber, `${c.id} must test the no-rewrite stages`).toBeLessThanOrEqual(2);
    }
  });
});
