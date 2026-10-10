import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderError } from "@/infrastructure/ai/errors";
import type { RoleReport, RunRecord } from "@/domain/eval/types";

const state = vi.hoisted(() => ({
  provider: null as unknown,
  history: new Map<string, RunRecord[]>(),
  legacy: new Map<string, unknown>(),
  baseline: new Map<string, RoleReport>(),
}));

vi.mock("@/lib/env", () => ({
  env: { GEMINI_MODEL: "test-model", EVAL_RPM: 6000, LOG_LEVEL: "error" },
}));
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
    expect(vi?.caseCount).toBe(12);
    expect(vi?.comparison?.verdict).toBe("same");
    expect(vi?.promptChangedSinceLastRun).toBe(false);
    expect(overview.roles.find((r) => r.role === "english-coach")?.latest).toBeNull();
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
