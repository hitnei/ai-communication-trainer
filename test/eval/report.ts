import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CheckResult } from "./checks";

export interface CaseOutcome {
  id: string;
  pass: boolean;
  checks: CheckResult[];
  error?: string;
}

export interface RoleReport {
  role: string;
  promptVersion: string;
  passRate: number;
  passed: number;
  total: number;
  errors: number;
  cases: Record<string, boolean>;
}

export type Verdict = "better" | "worse" | "same" | "no_baseline";

export interface Comparison {
  verdict: Verdict;
  delta: number;
  regressions: string[];
  fixes: string[];
}

const BASELINE_PATH = path.resolve(import.meta.dirname, "baseline.json");
const REGRESSION_TOLERANCE = 0.05;

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function toOutcome(id: string, checks: CheckResult[]): CaseOutcome {
  return { id, checks, pass: checks.every((c) => c.pass) };
}

export function errorOutcome(id: string, error: unknown): CaseOutcome {
  const cause = (error as { cause?: unknown } | null)?.cause;
  const detail =
    cause instanceof Error ? cause.message : cause ? String(cause) : "";
  const message = error instanceof Error ? error.message : String(error);
  return {
    id,
    checks: [],
    pass: false,
    error: detail ? `${message}: ${detail.slice(0, 400)}` : message,
  };
}

export function createPacer(requestsPerMinute: number): () => Promise<void> {
  const interval = 60_000 / requestsPerMinute;
  let nextSlot = 0;
  return async () => {
    const now = Date.now();
    const start = Math.max(now, nextSlot);
    nextSlot = start + interval;
    if (start > now) await new Promise((r) => setTimeout(r, start - now));
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
  baseline: RoleReport | undefined,
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
  const verdict: Verdict =
    delta > 0 ? "better" : delta < 0 ? "worse" : "same";
  return { verdict, delta, regressions, fixes };
}

export function isRegression(c: Comparison): boolean {
  return c.verdict === "worse" && c.delta < -REGRESSION_TOLERANCE;
}

export function readBaseline(): Record<string, RoleReport> {
  if (!existsSync(BASELINE_PATH)) return {};
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
}

export function writeBaseline(report: RoleReport): void {
  const all = readBaseline();
  all[report.role] = report;
  writeFileSync(BASELINE_PATH, `${JSON.stringify(all, null, 2)}\n`);
}

const VERDICT_LABEL: Record<Verdict, string> = {
  better: "TỐT LÊN",
  worse: "TỆ ĐI",
  same: "KHÔNG ĐỔI",
  no_baseline: "CHƯA CÓ BASELINE (chạy EVAL_UPDATE_BASELINE=1 để ghi)",
};

export function formatReport(
  report: RoleReport,
  outcomes: CaseOutcome[],
  comparison: Comparison,
  baseline: RoleReport | undefined,
): string {
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const lines = [
    "",
    `== ${report.role} (${report.promptVersion}) ==`,
    `pass-rate: ${report.passed}/${report.total} = ${pct(report.passRate)}`,
  ];
  if (report.errors > 0) {
    lines.push(`INCOMPLETE: ${report.errors} case lỗi hạ tầng, không tính vào pass-rate`);
  }
  for (const o of outcomes.filter((x) => !x.pass)) {
    lines.push(`  FAIL ${o.id}`);
    if (o.error) lines.push(`    error: ${o.error}`);
    for (const c of o.checks.filter((x) => !x.pass)) {
      lines.push(`    - ${c.name}${c.detail ? `: ${c.detail}` : ""}`);
    }
  }
  if (baseline) {
    const sign = comparison.delta >= 0 ? "+" : "";
    lines.push(
      `baseline ${baseline.promptVersion}: ${pct(baseline.passRate)} -> ${pct(report.passRate)} (${sign}${(comparison.delta * 100).toFixed(0)} điểm)`,
    );
    if (comparison.regressions.length > 0) {
      lines.push(`  regressions: ${comparison.regressions.join(", ")}`);
    }
    if (comparison.fixes.length > 0) {
      lines.push(`  fixed: ${comparison.fixes.join(", ")}`);
    }
  }
  lines.push(`VERDICT: ${VERDICT_LABEL[comparison.verdict]}`);
  return lines.join("\n");
}
