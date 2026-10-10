import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderError } from "@/infrastructure/ai/errors";
import type { RoleReport, RunRecord } from "@/domain/eval/types";

const state = vi.hoisted(() => ({
  provider: null as unknown,
  latest: new Map<string, unknown>(),
  baseline: new Map<string, unknown>(),
}));

vi.mock("@/lib/env", () => ({
  env: { GEMINI_MODEL: "test-model", EVAL_RPM: 6000, LOG_LEVEL: "error" },
}));
vi.mock("@/infrastructure/ai/provider", () => ({
  getAIProvider: () => state.provider,
}));
vi.mock("@/infrastructure/eval/eval-store", () => ({
  evalStore: {
    readLatest: (role: string) => state.latest.get(role) ?? null,
    writeLatest: (r: RunRecord) => state.latest.set(r.role, r),
    readBaseline: (role: string) => state.baseline.get(role) ?? null,
    writeBaseline: (r: RoleReport) => state.baseline.set(r.role, r),
  },
}));

import {
  EvalGuardError,
  getEvalOverview,
  runEval,
  setBaselineFromLatest,
} from "./eval-service";

const CANNED = {
  VietnameseCoachFeedback: {
    summary: "Ý chính của bạn xuất hiện hơi muộn so với phần bối cảnh.",
    issues: [
      {
        category: "communication",
        code: "main_point_late",
        title: "Ý chính muộn",
        detail: "Bạn kể bối cảnh quá lâu trước khi nói vấn đề.",
      },
    ],
    reflectionQuestions: ["Nếu chỉ nói một câu, bạn sẽ nói gì?"],
    suggestions: ["Nêu vấn đề trước."],
  },
  EnglishCoachFeedback: {
    summary: "Clear point, one phrase to fix.",
    issues: [],
    topFocusAreas: ["Trim the setup"],
  },
} as const;

function fakeProvider(name: string, onCall?: () => void) {
  return {
    name,
    generateText: async () => "",
    generateStructured: async (
      params: { schemaName?: string; schema: { parse: (v: unknown) => unknown } },
    ) => {
      onCall?.();
      const canned = CANNED[params.schemaName as keyof typeof CANNED];
      return params.schema.parse(canned);
    },
  };
}

beforeEach(() => {
  state.latest.clear();
  state.baseline.clear();
  state.provider = fakeProvider("gemini");
});

describe("runEval guards", () => {
  it("refuses to call the API without cost confirmation", async () => {
    let calls = 0;
    state.provider = fakeProvider("gemini", () => calls++);
    await expect(runEval("vietnamese-coach", false)).rejects.toThrow(EvalGuardError);
    expect(calls).toBe(0);
  });

  it("refuses to run against the mock provider", async () => {
    let calls = 0;
    state.provider = fakeProvider("mock", () => calls++);
    await expect(runEval("english-coach", true)).rejects.toThrow(/live Gemini/);
    expect(calls).toBe(0);
  });

  it("refuses a second concurrent run of the same role", async () => {
    const first = runEval("english-coach", true);
    await expect(runEval("english-coach", true)).rejects.toThrow(/already running/);
    await first;
  });
});

describe("runEval", () => {
  it("runs every case once, stores the record and reports pass-rate", async () => {
    let calls = 0;
    state.provider = fakeProvider("gemini", () => calls++);
    const record = await runEval("vietnamese-coach", true);
    expect(calls).toBe(record.outcomes.length);
    expect(record.report.errors).toBe(0);
    expect(record.report.total).toBe(record.outcomes.length);
    expect(record.model).toBe("test-model");
    expect(state.latest.get("vietnamese-coach")).toBe(record);
  });

  it("stops early and marks the run incomplete on a 429", async () => {
    let calls = 0;
    state.provider = {
      name: "gemini",
      generateText: async () => "",
      generateStructured: async () => {
        calls++;
        throw new AIProviderError(
          "Gemini structured request failed",
          new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'),
        );
      },
    };
    const record = await runEval("english-coach", true);
    expect(record.aborted).toBe(true);
    expect(calls).toBeLessThanOrEqual(2);
    expect(record.report.errors).toBe(record.outcomes.length);
  });
});

describe("baseline and overview", () => {
  it("refuses a baseline from an incomplete run, accepts a complete one", async () => {
    expect(() => setBaselineFromLatest("english-coach")).toThrow(/No run/);

    const record = await runEval("english-coach", true);
    expect(record.report.errors).toBe(0);
    const report = setBaselineFromLatest("english-coach");
    expect(state.baseline.get("english-coach")).toBe(report);

    state.latest.set("english-coach", {
      ...record,
      report: { ...record.report, errors: 1 },
    });
    expect(() => setBaselineFromLatest("english-coach")).toThrow(/infrastructure/);
  });

  it("builds an overview with comparison against the baseline", async () => {
    await runEval("vietnamese-coach", true);
    setBaselineFromLatest("vietnamese-coach");
    const overview = getEvalOverview();
    const vi = overview.roles.find((r) => r.role === "vietnamese-coach");
    expect(overview.canRun).toBe(true);
    expect(overview.roles).toHaveLength(2);
    expect(vi?.caseCount).toBe(12);
    expect(vi?.comparison?.verdict).toBe("same");
    expect(overview.roles.find((r) => r.role === "english-coach")?.latest).toBeNull();
  });
});
