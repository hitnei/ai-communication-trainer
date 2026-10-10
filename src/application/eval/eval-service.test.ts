import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderError } from "@/infrastructure/ai/errors";
import { recordUsage } from "@/infrastructure/ai/usage";
import { vietnameseCases } from "@/domain/eval/vietnamese-cases";
import type { RoleReport, RunRecord } from "@/domain/eval/types";

const N = vietnameseCases.length;

const state = vi.hoisted(() => ({
  provider: null as unknown,
  history: new Map<string, RunRecord[]>(),
  legacy: new Map<string, unknown>(),
  baseline: new Map<string, RoleReport>(),
}));

const envState = vi.hoisted(() => ({
  GEMINI_MODEL: "test-model",
  EVAL_RPM: 6000,
  LOG_LEVEL: "error",
  EVAL_MAX_USD: 1,
  EVAL_PRICE_INPUT_PER_M: 1,
  EVAL_PRICE_OUTPUT_PER_M: 10,
}));

vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/infrastructure/ai/provider", () => ({
  getAIProvider: () => state.provider,
}));
vi.mock("@/infrastructure/eval/eval-store", () => ({
  evalStore: {
    readHistory: (role: string) => state.history.get(role) ?? [],
    writeHistory: (role: string, runs: RunRecord[]) => state.history.set(role, runs),
    readLegacyLatest: (role: string) => state.legacy.get(role) ?? null,
    readBaseline: (role: string) => state.baseline.get(role) ?? null,
    writeBaseline: (r: RoleReport) => state.baseline.set(r.role, r),
  },
}));

import {
  EvalGuardError,
  getEvalHistory,
  getEvalOverview,
  probeFailingCases,
  runEval,
  setBaselineFromLatest,
  updateRunNote,
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

function fakeProvider(
  name: string,
  onCall?: () => void,
  usage: { promptTokens: number; outputTokens: number; thoughtsTokens: number } = {
    promptTokens: 1_000,
    outputTokens: 500,
    thoughtsTokens: 1_500,
  },
) {
  return {
    name,
    generateText: async () => "",
    generateStructured: async (
      params: { schemaName?: string; schema: { parse: (v: unknown) => unknown } },
    ) => {
      onCall?.();
      recordUsage(usage);
      const canned = CANNED[params.schemaName as keyof typeof CANNED];
      return params.schema.parse(canned);
    },
  };
}

beforeEach(() => {
  envState.EVAL_MAX_USD = 1;
  state.history.clear();
  state.legacy.clear();
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
    expect(state.history.get("vietnamese-coach")).toEqual([record]);
    expect(record.id).toBeTruthy();
    expect(record.prompt.sections.length).toBeGreaterThan(2);
    expect(record.prompt.hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("measures token usage and cost for the run", async () => {
    const record = await runEval("vietnamese-coach", true);
    expect(record.usage).toEqual({
      calls: N,
      promptTokens: N * 1_000,
      outputTokens: N * 500,
      thoughtsTokens: N * 1_500,
    });
    // per call: 1k in at $1/M + 2k out (thinking included) at $10/M
    expect(record.costUsd).toBeCloseTo(N * 0.021);
  });

  it("stops at the per-run spend cap instead of finishing", async () => {
    envState.EVAL_MAX_USD = 0.05;
    let calls = 0;
    state.provider = fakeProvider("gemini", () => calls++);
    const record = await runEval("vietnamese-coach", true);
    expect(record.abortReason).toBe("budget");
    expect(record.aborted).toBe(true);
    expect(calls).toBeLessThan(N);
    expect(calls).toBeLessThanOrEqual(5);
    expect(record.report.errors).toBe(N - calls);
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
    expect(record.abortReason).toBe("quota");
    expect(calls).toBeLessThanOrEqual(2);
    expect(record.report.errors).toBe(record.outcomes.length);
  });
});

describe("baseline, history and overview", () => {
  it("refuses a baseline from an incomplete run, accepts a complete one", async () => {
    await expect(setBaselineFromLatest("english-coach")).rejects.toThrow(/No run/);

    const record = await runEval("english-coach", true);
    expect(record.report.errors).toBe(0);
    const report = await setBaselineFromLatest("english-coach");
    expect(report.runId).toBe(record.id);
    expect(state.baseline.get("english-coach")).toEqual(report);

    state.history.set("english-coach", [
      { ...record, report: { ...record.report, errors: 1 } },
    ]);
    await expect(setBaselineFromLatest("english-coach")).rejects.toThrow(
      /infrastructure/,
    );
  });

  it("keeps every run in history instead of overwriting", async () => {
    await runEval("vietnamese-coach", true);
    await runEval("vietnamese-coach", true);
    const [vi] = (await getEvalHistory()).filter((h) => h.role === "vietnamese-coach");
    expect(vi.runs).toHaveLength(2);
    expect(vi.runs[0].id).not.toBe(vi.runs[1].id);
    expect(vi.currentVersion).toMatch(/^vietnamese-coach@/);
  });

  it("builds an overview with comparison against the baseline", async () => {
    await runEval("vietnamese-coach", true);
    await setBaselineFromLatest("vietnamese-coach");
    const overview = await getEvalOverview();
    const vi = overview.roles.find((r) => r.role === "vietnamese-coach");
    expect(overview.canRun).toBe(true);
    expect(overview.roles).toHaveLength(2);
    expect(vi?.caseCount).toBe(N);
    expect(vi?.comparison?.verdict).toBe("same");
    expect(vi?.promptChangedSinceLastRun).toBe(false);
    expect(overview.roles.find((r) => r.role === "english-coach")?.latest).toBeNull();
  });

  it("bases the estimate on the last measured run", async () => {
    const before = (await getEvalOverview()).roles.find((r) => r.role === "vietnamese-coach");
    expect(before?.estimate.basis).toBe("assumed");

    await runEval("vietnamese-coach", true);
    const after = (await getEvalOverview()).roles.find((r) => r.role === "vietnamese-coach");
    expect(after?.estimate.basis).toBe("measured");
    expect(after?.estimate.lowUsd).toBeCloseTo(N * 0.021);
    expect(after?.maxUsd).toBe(1);
  });

  it("flags a prompt that changed since the last run", async () => {
    const record = await runEval("english-coach", true);
    state.history.set("english-coach", [
      { ...record, prompt: { ...record.prompt, hash: "00000000" } },
    ]);
    const overview = await getEvalOverview();
    expect(
      overview.roles.find((r) => r.role === "english-coach")?.promptChangedSinceLastRun,
    ).toBe(true);
  });

  it("seeds history from a pre-history latest file and marks its baseline", async () => {
    const first = await runEval("english-coach", true);
    const legacy: Partial<RunRecord> = { ...first };
    delete legacy.id;
    delete legacy.prompt;
    delete legacy.note;
    state.history.clear();
    state.legacy.set("english-coach", legacy);
    state.baseline.set("english-coach", { ...first.report, runId: undefined });

    const [en] = (await getEvalHistory()).filter((h) => h.role === "english-coach");
    expect(en.runs).toHaveLength(1);
    expect(en.runs[0].backfilled).toBe(true);
    expect(en.runs[0].id).toMatch(/^legacy-/);
    expect(en.baselineRunId).toBe(en.runs[0].id);
  });

  it("saves a note on a run and rejects an unknown run", async () => {
    const record = await runEval("vietnamese-coach", true);
    const updated = await updateRunNote("vietnamese-coach", record.id, "added code list");
    expect(updated.note).toBe("added code list");
    expect(state.history.get("vietnamese-coach")?.[0].note).toBe("added code list");
    await expect(updateRunNote("vietnamese-coach", "nope", "x")).rejects.toThrow(
      /not found/,
    );
  });
});

describe("probeFailingCases", () => {
  it("refuses without confirmation, on the mock provider, or with no run", async () => {
    await expect(probeFailingCases("vietnamese-coach", false)).rejects.toThrow(/confirmation/);
    state.provider = fakeProvider("mock");
    await expect(probeFailingCases("vietnamese-coach", true)).rejects.toThrow(/live Gemini/);
    state.provider = fakeProvider("gemini");
    await expect(probeFailingCases("vietnamese-coach", true)).rejects.toThrow(/No run/);
  });

  it("re-runs every failing case three times and keeps the attempts", async () => {
    const first = await runEval("vietnamese-coach", true);
    const failing = first.outcomes.filter((o) => !o.pass && !o.error);
    expect(failing.length).toBeGreaterThan(0);

    let calls = 0;
    state.provider = fakeProvider("gemini", () => calls++);
    const updated = await probeFailingCases("vietnamese-coach", true);

    expect(calls).toBe(failing.length * 3);
    expect(updated.probes).toHaveLength(failing.length);
    expect(updated.probes?.every((p) => p.attempts.length === 3)).toBe(true);
    expect(updated.report).toEqual(first.report);
    expect(updated.probeUsage?.calls).toBe(failing.length * 3);
    expect(updated.probeCostUsd).toBeCloseTo(failing.length * 3 * 0.021);
    expect(state.history.get("vietnamese-coach")?.[0].probes).toHaveLength(failing.length);
  });

  it("accumulates probe cost across repeated probes", async () => {
    await runEval("english-coach", true);
    const once = await probeFailingCases("english-coach", true);
    const twice = await probeFailingCases("english-coach", true);
    expect(twice.probeCostUsd).toBeCloseTo((once.probeCostUsd ?? 0) * 2);
    expect(twice.probes).toHaveLength(once.probes?.length ?? 0);
  });

  it("refuses when the prompt changed since the run", async () => {
    const record = await runEval("english-coach", true);
    state.history.set("english-coach", [
      { ...record, prompt: { ...record.prompt, hash: "00000000" } },
    ]);
    await expect(probeFailingCases("english-coach", true)).rejects.toThrow(/prompt changed/);
  });

  it("refuses when the last run has no failing cases", async () => {
    const record = await runEval("english-coach", true);
    state.history.set("english-coach", [
      {
        ...record,
        outcomes: record.outcomes.map((o) => ({ ...o, pass: true })),
      },
    ]);
    await expect(probeFailingCases("english-coach", true)).rejects.toThrow(/no failing/);
  });

  it("stops on a 429 and records the skipped attempts as errors", async () => {
    await runEval("vietnamese-coach", true);
    state.provider = {
      name: "gemini",
      generateText: async () => "",
      generateStructured: async () => {
        throw new AIProviderError("x", new Error('{"error":{"code":429}}'));
      },
    };
    const updated = await probeFailingCases("vietnamese-coach", true);
    const attempts = updated.probes?.flatMap((p) => p.attempts) ?? [];
    expect(attempts.every((a) => !a.pass && a.error)).toBe(true);
    expect(attempts.some((a) => /skipped/.test(a.error ?? ""))).toBe(true);
  });
});
