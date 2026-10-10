import "server-only";
import { randomUUID } from "node:crypto";
import { coachingPolicyForAttempt } from "@/domain/practice/coaching-stage";
import {
  PROBE_REPEATS,
  estimateCost,
  usageCostUsd,
  type CostEstimate,
  type Prices,
} from "@/domain/eval/cost";
import {
  evaluateEnglish,
  evaluateVietnamese,
  observeEnglish,
  observeVietnamese,
} from "@/domain/eval/checks";
import { englishCases } from "@/domain/eval/english-cases";
import { vietnameseCases } from "@/domain/eval/vietnamese-cases";
import { makeSnapshot } from "@/domain/eval/prompt-snapshot";
import {
  compare,
  errorOutcome,
  summarize,
  toOutcome,
  type Comparison,
} from "@/domain/eval/report";
import {
  EVAL_ROLES,
  type AbortReason,
  type CaseOutcome,
  type CaseProbe,
  type ProbeAttempt,
  type CheckResult,
  type EvalRole,
  type ObservedFeedback,
  type PromptSection,
  type PromptSnapshot,
  type RoleReport,
  type RunRecord,
  type TokenUsage,
} from "@/domain/eval/types";
import { getAIProvider } from "@/infrastructure/ai/provider";
import {
  ENGLISH_COACH_PROMPT_VERSION,
  runEnglishCoach,
} from "@/infrastructure/ai/roles/english-coach";
import {
  VIETNAMESE_COACH_PROMPT_VERSION,
  runVietnameseCoach,
} from "@/infrastructure/ai/roles/vietnamese-coach";
import type { AIProvider } from "@/infrastructure/ai/types";
import { emptyUsage, withUsageMeter } from "@/infrastructure/ai/usage";
import { evalStore } from "@/infrastructure/eval/eval-store";
import { env } from "@/lib/env";
import { createPacer, mapWithConcurrency } from "./pacing";

const CONCURRENCY = 2;
const QUOTA_ERROR = /\b429\b|RESOURCE_EXHAUSTED/;

function currentPrices(): Prices {
  return {
    inputPerMillion: env.EVAL_PRICE_INPUT_PER_M,
    outputPerMillion: env.EVAL_PRICE_OUTPUT_PER_M,
  };
}

export class EvalGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvalGuardError";
  }
}

interface EvalCase {
  id: string;
  input: string;
  run: (provider: AIProvider) => Promise<{
    checks: CheckResult[];
    observed: ObservedFeedback;
  }>;
}

interface RoleDefinition {
  promptVersion: string;
  cases: EvalCase[];
}

function definitionFor(role: EvalRole): RoleDefinition {
  if (role === "vietnamese-coach") {
    return {
      promptVersion: VIETNAMESE_COACH_PROMPT_VERSION,
      cases: vietnameseCases.map((c) => ({
        id: c.id,
        input: c.answer,
        run: async (provider) => {
          const fb = await runVietnameseCoach(
            {
              prompt: c.prompt,
              answer: c.answer,
              previousAnswer: c.previousAnswer,
              attemptNumber: c.attemptNumber,
              policy: coachingPolicyForAttempt(c.attemptNumber),
            },
            provider,
          );
          return {
            checks: evaluateVietnamese(c, fb),
            observed: observeVietnamese(fb),
          };
        },
      })),
    };
  }
  return {
    promptVersion: ENGLISH_COACH_PROMPT_VERSION,
    cases: englishCases.map((c) => ({
      id: c.id,
      input: c.transcript,
      run: async (provider) => {
        const fb = await runEnglishCoach(
          {
            prompt: c.prompt,
            transcript: c.transcript,
            previousTranscript: c.previousTranscript,
            allowImprovedVersion: c.allowImprovedVersion,
          },
          provider,
        );
        return {
          checks: evaluateEnglish(c, fb),
          observed: observeEnglish(fb),
        };
      },
    })),
  };
}

class PromptCaptured extends Error {
  constructor(
    readonly system: string,
    readonly prompt: string,
  ) {
    super("prompt captured");
  }
}

const capturingProvider: AIProvider = {
  name: "capture",
  generateText: async () => "",
  generateStructured: async (params) => {
    throw new PromptCaptured(params.system ?? "", params.prompt);
  },
};

async function renderPrompt(
  run: (provider: AIProvider) => Promise<unknown>,
): Promise<PromptCaptured> {
  try {
    await run(capturingProvider);
  } catch (error) {
    if (error instanceof PromptCaptured) return error;
    throw error;
  }
  throw new Error("Prompt was not captured.");
}

const PLACEHOLDERS = {
  prompt: "{{QUESTION}}",
  answer: "{{ANSWER}}",
  previous: "{{PREVIOUS_ANSWER}}",
};

/** Renders the real prompt with placeholder inputs. Makes no API call. */
async function capturePromptSnapshot(role: EvalRole): Promise<PromptSnapshot> {
  const variants: { label: string; captured: PromptCaptured }[] = [];
  if (role === "vietnamese-coach") {
    for (const attempt of [1, 2, 3]) {
      variants.push({
        label: `Task, attempt ${attempt}`,
        captured: await renderPrompt((provider) =>
          runVietnameseCoach(
            {
              prompt: PLACEHOLDERS.prompt,
              answer: PLACEHOLDERS.answer,
              previousAnswer: attempt > 1 ? PLACEHOLDERS.previous : undefined,
              attemptNumber: attempt,
              policy: coachingPolicyForAttempt(attempt),
            },
            provider,
          ),
        ),
      });
    }
  } else {
    for (const withPrevious of [false, true]) {
      variants.push({
        label: withPrevious
          ? "Task, improved version allowed, previous attempt"
          : "Task, improved version withheld, first attempt",
        captured: await renderPrompt((provider) =>
          runEnglishCoach(
            {
              prompt: PLACEHOLDERS.prompt,
              transcript: PLACEHOLDERS.answer,
              previousTranscript: withPrevious ? PLACEHOLDERS.previous : undefined,
              allowImprovedVersion: withPrevious,
            },
            provider,
          ),
        ),
      });
    }
  }

  const split = (prompt: string) => {
    const at = prompt.indexOf("\n\n# Output\n");
    return at < 0
      ? { task: prompt, output: "" }
      : { task: prompt.slice(0, at), output: prompt.slice(at + "\n\n# Output\n".length) };
  };
  const first = variants[0].captured;
  const sections: PromptSection[] = [
    { title: "System (global rules + role rules)", text: first.system },
    { title: "Output contract", text: split(first.prompt).output },
    ...variants.map((v) => ({ title: v.label, text: split(v.captured.prompt).task })),
  ];
  return makeSnapshot(sections);
}

function byTime(a: RunRecord, b: RunRecord): number {
  return a.finishedAt.localeCompare(b.finishedAt);
}

async function loadHistory(role: EvalRole): Promise<RunRecord[]> {
  const stored = evalStore.readHistory(role);
  if (stored.length > 0) return [...stored].sort(byTime);

  const legacy = evalStore.readLegacyLatest(role);
  if (!legacy) return [];

  const seeded: RunRecord = {
    ...legacy,
    id: `legacy-${legacy.finishedAt}`,
    prompt: await capturePromptSnapshot(role),
    note: "",
    backfilled: true,
  };
  evalStore.writeHistory(role, [seeded]);

  const baseline = evalStore.readBaseline(role);
  if (
    baseline &&
    !baseline.runId &&
    baseline.promptVersion === seeded.promptVersion &&
    JSON.stringify(baseline.cases) === JSON.stringify(seeded.report.cases)
  ) {
    evalStore.writeBaseline({ ...baseline, runId: seeded.id });
  }
  return [seeded];
}

function failingIdsOf(run: RunRecord | null): string[] {
  return run ? run.outcomes.filter((o) => !o.pass && !o.error).map((o) => o.id) : [];
}

function assertDevOnly(): void {
  if (process.env.NODE_ENV === "production") {
    throw new EvalGuardError("The eval harness is disabled in production.");
  }
}

export interface EvalRoleOverview {
  role: EvalRole;
  promptVersion: string;
  caseCount: number;
  estimate: CostEstimate;
  /** Hard stop for one run, in USD. */
  maxUsd: number;
  failingCaseCount: number;
  probeEstimate: CostEstimate;
  latest: RunRecord | null;
  baseline: RoleReport | null;
  comparison: Comparison | null;
  /** The prompt in code differs from the one the latest run measured. */
  promptChangedSinceLastRun: boolean;
}

export interface EvalOverview {
  provider: string;
  model: string;
  canRun: boolean;
  roles: EvalRoleOverview[];
}

export async function getEvalOverview(): Promise<EvalOverview> {
  assertDevOnly();
  const provider = getAIProvider();
  const roles = await Promise.all(
    EVAL_ROLES.map(async (role): Promise<EvalRoleOverview> => {
      const def = definitionFor(role);
      const history = await loadHistory(role);
      const latest = history.at(-1) ?? null;
      const baseline = evalStore.readBaseline(role);
      const current = latest ? await capturePromptSnapshot(role) : null;
      const measured = [...history].reverse().find((r) => r.usage?.calls)?.usage ?? null;
      return {
        role,
        promptVersion: def.promptVersion,
        caseCount: def.cases.length,
        estimate: estimateCost(def.cases.length, measured, currentPrices()),
        maxUsd: env.EVAL_MAX_USD,
        failingCaseCount: failingIdsOf(latest).length,
        probeEstimate: estimateCost(
          failingIdsOf(latest).length * PROBE_REPEATS,
          measured,
          currentPrices(),
        ),
        latest,
        baseline,
        comparison: latest ? compare(latest.report, baseline) : null,
        promptChangedSinceLastRun:
          latest !== null && current !== null && current.hash !== latest.prompt.hash,
      };
    }),
  );
  return {
    provider: provider.name,
    model: env.GEMINI_MODEL,
    canRun: provider.name === "gemini",
    roles,
  };
}

export interface EvalHistoryRole {
  role: EvalRole;
  runs: RunRecord[];
  baselineRunId: string | null;
  currentPrompt: PromptSnapshot;
  currentVersion: string;
}

export async function getEvalHistory(): Promise<EvalHistoryRole[]> {
  assertDevOnly();
  return Promise.all(
    EVAL_ROLES.map(async (role) => ({
      role,
      runs: await loadHistory(role),
      baselineRunId: evalStore.readBaseline(role)?.runId ?? null,
      currentPrompt: await capturePromptSnapshot(role),
      currentVersion: definitionFor(role).promptVersion,
    })),
  );
}

const inFlight = new Set<EvalRole>();

function requireLiveProvider(confirmed: boolean): AIProvider {
  assertDevOnly();
  if (!confirmed) {
    throw new EvalGuardError("Cost confirmation required before calling the API.");
  }
  const provider = getAIProvider();
  if (provider.name !== "gemini") {
    throw new EvalGuardError(
      "Eval needs the live Gemini provider (set GEMINI_API_KEY). The mock returns canned output and measures nothing.",
    );
  }
  return provider;
}

/**
 * Calls the live provider once per case. `confirmed` must be true: the caller is
 * responsible for showing the cost estimate and getting an explicit yes first.
 */
export async function runEval(
  role: EvalRole,
  confirmed: boolean,
): Promise<RunRecord> {
  const provider = requireLiveProvider(confirmed);
  if (inFlight.has(role)) {
    throw new EvalGuardError(`An eval for ${role} is already running.`);
  }

  inFlight.add(role);
  try {
    const def = definitionFor(role);
    const prompt = await capturePromptSnapshot(role);
    const history = await loadHistory(role);
    const pace = createPacer(env.EVAL_RPM);
    const prices = currentPrices();
    const meter = emptyUsage();
    const startedAt = new Date().toISOString();
    let abortReason: AbortReason | undefined;

    const outcomes: CaseOutcome[] = await withUsageMeter(meter, () =>
      mapWithConcurrency(def.cases, CONCURRENCY, async (c) => {
        if (abortReason === "quota") {
          return errorOutcome(c.id, c.input, "skipped: Gemini quota exhausted");
        }
        if (abortReason === "budget" || usageCostUsd(meter, prices) >= env.EVAL_MAX_USD) {
          abortReason = "budget";
          return errorOutcome(
            c.id,
            c.input,
            `skipped: spend reached the $${env.EVAL_MAX_USD} cap for one run`,
          );
        }
        try {
          await pace();
          const { checks, observed } = await c.run(provider);
          return toOutcome(c.id, c.input, checks, observed);
        } catch (error) {
          const outcome = errorOutcome(c.id, c.input, error);
          if (QUOTA_ERROR.test(outcome.error ?? "")) abortReason = "quota";
          return outcome;
        }
      }),
    );

    const record: RunRecord = {
      id: randomUUID(),
      role,
      promptVersion: def.promptVersion,
      model: env.GEMINI_MODEL,
      startedAt,
      finishedAt: new Date().toISOString(),
      aborted: abortReason !== undefined,
      abortReason,
      usage: meter,
      costUsd: usageCostUsd(meter, prices),
      prompt,
      note: "",
      report: summarize(role, def.promptVersion, outcomes),
      outcomes,
    };
    evalStore.writeHistory(role, [...history, record]);
    return record;
  } finally {
    inFlight.delete(role);
  }
}

function addUsage(a: TokenUsage | undefined, b: TokenUsage): TokenUsage {
  return {
    calls: (a?.calls ?? 0) + b.calls,
    promptTokens: (a?.promptTokens ?? 0) + b.promptTokens,
    outputTokens: (a?.outputTokens ?? 0) + b.outputTokens,
    thoughtsTokens: (a?.thoughtsTokens ?? 0) + b.thoughtsTokens,
  };
}

/**
 * Re-runs every failing case of the latest run PROBE_REPEATS times on the same
 * prompt, so a one-off flip can be told apart from a repeatable weakness.
 */
export async function probeFailingCases(
  role: EvalRole,
  confirmed: boolean,
): Promise<RunRecord> {
  const provider = requireLiveProvider(confirmed);
  if (inFlight.has(role)) {
    throw new EvalGuardError(`An eval for ${role} is already running.`);
  }

  inFlight.add(role);
  try {
    const history = await loadHistory(role);
    const run = history.at(-1);
    if (!run) throw new EvalGuardError("No run to probe yet.");
    const prompt = await capturePromptSnapshot(role);
    if (prompt.hash !== run.prompt.hash) {
      throw new EvalGuardError(
        "The prompt changed since the last run. Run the eval again first so stability is measured on the same text.",
      );
    }
    const failing = failingIdsOf(run);
    if (failing.length === 0) {
      throw new EvalGuardError("The last run has no failing cases to probe.");
    }

    const cases = new Map(definitionFor(role).cases.map((c) => [c.id, c]));
    const tasks = failing.flatMap((id) =>
      Array.from({ length: PROBE_REPEATS }, () => id),
    );
    const pace = createPacer(env.EVAL_RPM);
    const prices = currentPrices();
    const meter = emptyUsage();
    let abortReason: AbortReason | undefined;

    const results = await withUsageMeter(meter, () =>
      mapWithConcurrency(tasks, CONCURRENCY, async (id) => {
        const attempt = async (): Promise<ProbeAttempt> => {
          if (abortReason === "quota") return { pass: false, failures: [], error: "skipped: quota exhausted" };
          if (abortReason === "budget" || usageCostUsd(meter, prices) >= env.EVAL_MAX_USD) {
            abortReason = "budget";
            return { pass: false, failures: [], error: "skipped: spend cap reached" };
          }
          try {
            await pace();
            const { checks, observed } = await cases.get(id)!.run(provider);
            return { pass: checks.every((c) => c.pass), failures: checks.filter((c) => !c.pass), observed };
          } catch (error) {
            const message = errorOutcome(id, "", error).error ?? "error";
            if (QUOTA_ERROR.test(message)) abortReason = "quota";
            return { pass: false, failures: [], error: message };
          }
        };
        return { id, attempt: await attempt() };
      }),
    );

    const ranAt = new Date().toISOString();
    const fresh: CaseProbe[] = failing.map((caseId) => ({
      caseId,
      ranAt,
      attempts: results.filter((r) => r.id === caseId).map((r) => r.attempt),
    }));
    const kept = (run.probes ?? []).filter((p) => !failing.includes(p.caseId));
    const updated: RunRecord = {
      ...run,
      probes: [...kept, ...fresh],
      probeUsage: addUsage(run.probeUsage, meter),
      probeCostUsd: (run.probeCostUsd ?? 0) + usageCostUsd(meter, prices),
    };
    evalStore.writeHistory(role, history.map((r) => (r.id === run.id ? updated : r)));
    return updated;
  } finally {
    inFlight.delete(role);
  }
}

export async function setBaselineFromLatest(role: EvalRole): Promise<RoleReport> {
  assertDevOnly();
  const latest = (await loadHistory(role)).at(-1);
  if (!latest) throw new EvalGuardError("No run to use as a baseline yet.");
  if (latest.report.errors > 0) {
    throw new EvalGuardError(
      "The latest run had infrastructure errors; a partial run cannot be a baseline.",
    );
  }
  const report: RoleReport = { ...latest.report, runId: latest.id };
  evalStore.writeBaseline(report);
  return report;
}

const MAX_NOTE_LENGTH = 2_000;

export async function updateRunNote(
  role: EvalRole,
  runId: string,
  note: string,
): Promise<RunRecord> {
  assertDevOnly();
  const history = await loadHistory(role);
  const target = history.find((r) => r.id === runId);
  if (!target) throw new EvalGuardError("Run not found.");
  const updated: RunRecord = { ...target, note: note.slice(0, MAX_NOTE_LENGTH) };
  evalStore.writeHistory(
    role,
    history.map((r) => (r.id === runId ? updated : r)),
  );
  return updated;
}
