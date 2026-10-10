import { compare, type Comparison } from "./report";
import type { RoleReport, RunRecord } from "./types";

export interface TimelineEntry {
  run: RunRecord;
  index: number;
  isBaseline: boolean;
  /** Pass-rate change vs the previous run; null for the first run. */
  deltaVsPrevious: number | null;
  vsPrevious: Comparison | null;
  promptChanged: boolean;
  versionChanged: boolean;
  /** The prompt text differs from the previous run but the version string did not. */
  changedWithoutBump: boolean;
  modelChanged: boolean;
  caseSetChanged: boolean;
}

export interface MatrixRow {
  caseId: string;
  /** One cell per run, oldest first: true pass, false fail, null not measured. */
  cells: (boolean | null)[];
}

export interface Timeline {
  entries: TimelineEntry[];
  matrix: MatrixRow[];
}

function sameKeys(a: RoleReport, b: RoleReport): boolean {
  const ka = Object.keys(a.cases).sort().join("|");
  const kb = Object.keys(b.cases).sort().join("|");
  return ka === kb;
}

export function buildTimeline(
  runs: RunRecord[],
  baselineRunId: string | null,
): Timeline {
  const sorted = [...runs].sort((x, y) => x.finishedAt.localeCompare(y.finishedAt));

  const entries = sorted.map((run, index): TimelineEntry => {
    const prev = index > 0 ? sorted[index - 1] : null;
    const promptChanged = prev ? prev.prompt.hash !== run.prompt.hash : false;
    const versionChanged = prev ? prev.promptVersion !== run.promptVersion : false;
    return {
      run,
      index,
      isBaseline: run.id === baselineRunId,
      deltaVsPrevious: prev ? run.report.passRate - prev.report.passRate : null,
      vsPrevious: prev ? compare(run.report, prev.report) : null,
      promptChanged,
      versionChanged,
      changedWithoutBump: promptChanged && !versionChanged,
      modelChanged: prev ? prev.model !== run.model : false,
      caseSetChanged: prev ? !sameKeys(prev.report, run.report) : false,
    };
  });

  const caseIds: string[] = [];
  for (const run of sorted) {
    for (const outcome of run.outcomes) {
      if (!caseIds.includes(outcome.id)) caseIds.push(outcome.id);
    }
  }
  const matrix = caseIds.map((caseId): MatrixRow => ({
    caseId,
    cells: sorted.map((run) => {
      const pass = run.report.cases[caseId];
      return pass === undefined ? null : pass;
    }),
  }));

  return { entries, matrix };
}
