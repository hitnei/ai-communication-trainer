import type {
  CaseOutcome,
  CheckResult,
  ObservedFeedback,
  RoleReport,
} from "./types";

export type Verdict = "better" | "worse" | "same" | "no_baseline";

export interface Comparison {
  verdict: Verdict;
  delta: number;
  regressions: string[];
  fixes: string[];
}

const REGRESSION_TOLERANCE = 0.05;

export function toOutcome(
  id: string,
  input: string,
  checks: CheckResult[],
  observed: ObservedFeedback,
): CaseOutcome {
  return { id, input, checks, observed, pass: checks.every((c) => c.pass) };
}

export function errorOutcome(
  id: string,
  input: string,
  error: unknown,
): CaseOutcome {
  const cause = (error as { cause?: unknown } | null)?.cause;
  const detail =
    cause instanceof Error ? cause.message : cause ? String(cause) : "";
  const message = error instanceof Error ? error.message : String(error);
  return {
    id,
    input,
    checks: [],
    pass: false,
    error: detail ? `${message}: ${detail.slice(0, 400)}` : message,
  };
}

export function summarize(
  role: string,
  promptVersion: string,
  outcomes: CaseOutcome[],
): RoleReport {
  const completed = outcomes.filter((o) => !o.error);
  const passed = completed.filter((o) => o.pass).length;
  return {
    role,
    promptVersion,
    passRate: completed.length === 0 ? 0 : passed / completed.length,
    passed,
    total: completed.length,
    errors: outcomes.length - completed.length,
    cases: Object.fromEntries(completed.map((o) => [o.id, o.pass])),
  };
}

export function compare(
  report: RoleReport,
  baseline: RoleReport | null | undefined,
): Comparison {
  if (!baseline) {
    return { verdict: "no_baseline", delta: 0, regressions: [], fixes: [] };
  }
  const regressions: string[] = [];
  const fixes: string[] = [];
  for (const [id, pass] of Object.entries(report.cases)) {
    const before = baseline.cases[id];
    if (before === undefined) continue;
    if (before && !pass) regressions.push(id);
    if (!before && pass) fixes.push(id);
  }
  const delta = report.passRate - baseline.passRate;
  const verdict: Verdict = delta > 0 ? "better" : delta < 0 ? "worse" : "same";
  return { verdict, delta, regressions, fixes };
}

export function isRegression(c: Comparison): boolean {
  return c.verdict === "worse" && c.delta < -REGRESSION_TOLERANCE;
}
