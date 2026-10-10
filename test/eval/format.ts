import type { Comparison } from "@/domain/eval/report";
import type { RoleReport, RunRecord } from "@/domain/eval/types";

const LABEL: Record<Comparison["verdict"], string> = {
  better: "TỐT LÊN",
  worse: "TỆ ĐI",
  same: "KHÔNG ĐỔI",
  no_baseline: "CHƯA CÓ BASELINE (chạy EVAL_UPDATE_BASELINE=1 để ghi)",
};

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function formatRun(
  run: RunRecord,
  comparison: Comparison,
  baseline: RoleReport | null,
): string {
  const { report } = run;
  const lines = [
    "",
    `== ${report.role} (${report.promptVersion}) ==`,
    `pass-rate: ${report.passed}/${report.total} = ${pct(report.passRate)}`,
  ];
  if (report.errors > 0) {
    lines.push(`INCOMPLETE: ${report.errors} case lỗi hạ tầng, không tính vào pass-rate`);
  }
  for (const o of run.outcomes.filter((x) => !x.pass)) {
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
  lines.push(`VERDICT: ${LABEL[comparison.verdict]}`);
  return lines.join("\n");
}
