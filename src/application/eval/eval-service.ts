import "server-only";
import { randomUUID } from "node:crypto";
import { coachingPolicyForAttempt } from "@/domain/practice/coaching-stage";
import { estimateCost, type CostEstimate } from "@/domain/eval/cost";
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
  type CaseOutcome,
  type CheckResult,
  type EvalRole,
  type ObservedFeedback,
  type PromptSection,
  type PromptSnapshot,
  type RoleReport,
  type RunRecord,
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
import { evalStore } from "@/infrastructure/eval/eval-store";
import { env } from "@/lib/env";
import { createPacer, mapWithConcurrency } from "./pacing";

const CONCURRENCY = 2;
const QUOTA_ERROR = /\b429\b|RESOURCE_EXHAUSTED/;

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
      return {
        role,
        promptVersion: def.promptVersion,
        caseCount: def.cases.length,
        estimate: estimateCost(def.cases.length),
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

/**
 * Calls the live provider once per case. `confirmed` must be true: the caller is
 * responsible for showing the cost estimate and getting an explicit yes first.
 */
export async function runEval(
  role: EvalRole,
  confirmed: boolean,
): Promise<RunRecord> {
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
  if (inFlight.has(role)) {
    throw new EvalGuardError(`An eval for ${role} is already running.`);
  }

  inFlight.add(role);
  try {
    const def = definitionFor(role);
    const prompt = await capturePromptSnapshot(role);
    const history = await loadHistory(role);
    const pace = createPacer(env.EVAL_RPM);
    const startedAt = new Date().toISOString();
    let quotaExhausted = false;

    const outcomes: CaseOutcome[] = await mapWithConcurrency(
      def.cases,
      CONCURRENCY,
      async (c) => {
        if (quotaExhausted) {
          return errorOutcome(c.id, c.input, "skipped: Gemini quota exhausted");
        }
        try {
          await pace();
          const { checks, observed } = await c.run(provider);
          return toOutcome(c.id, c.input, checks, observed);
        } catch (error) {
          const outcome = errorOutcome(c.id, c.input, error);
          if (QUOTA_ERROR.test(outcome.error ?? "")) quotaExhausted = true;
          return outcome;
        }
      },
    );

    const record: RunRecord = {
      id: randomUUID(),
      role,
      promptVersion: def.promptVersion,
      model: env.GEMINI_MODEL,
      startedAt,
      finishedAt: new Date().toISOString(),
      aborted: quotaExhausted,
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
