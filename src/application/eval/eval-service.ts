import "server-only";
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
}

export interface EvalOverview {
  provider: string;
  model: string;
  canRun: boolean;
  roles: EvalRoleOverview[];
}

export function getEvalOverview(): EvalOverview {
  assertDevOnly();
  const provider = getAIProvider();
  return {
    provider: provider.name,
    model: env.GEMINI_MODEL,
    canRun: provider.name === "gemini",
    roles: EVAL_ROLES.map((role) => {
      const def = definitionFor(role);
      const latest = evalStore.readLatest(role);
      const baseline = evalStore.readBaseline(role);
      return {
        role,
        promptVersion: def.promptVersion,
        caseCount: def.cases.length,
        estimate: estimateCost(def.cases.length),
        latest,
        baseline,
        comparison: latest ? compare(latest.report, baseline) : null,
      };
    }),
  };
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
      role,
      promptVersion: def.promptVersion,
      model: env.GEMINI_MODEL,
      startedAt,
      finishedAt: new Date().toISOString(),
      aborted: quotaExhausted,
      report: summarize(role, def.promptVersion, outcomes),
      outcomes,
    };
    evalStore.writeLatest(record);
    return record;
  } finally {
    inFlight.delete(role);
  }
}

export function setBaselineFromLatest(role: EvalRole): RoleReport {
  assertDevOnly();
  const latest = evalStore.readLatest(role);
  if (!latest) throw new EvalGuardError("No run to use as a baseline yet.");
  if (latest.report.errors > 0) {
    throw new EvalGuardError(
      "The latest run had infrastructure errors; a partial run cannot be a baseline.",
    );
  }
  evalStore.writeBaseline(latest.report);
  return latest.report;
}
