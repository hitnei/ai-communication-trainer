import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { EvalRole, RoleReport, RunRecord } from "@/domain/eval/types";

const DIR = path.resolve(process.cwd(), ".data", "eval");
const BASELINE_FILE = path.join(DIR, "baseline.json");

/** Shape of the single "latest" file written before run history existed. */
export type LegacyRun = Omit<RunRecord, "id" | "prompt" | "note">;

function historyFile(role: EvalRole): string {
  return path.join(DIR, `history-${role}.json`);
}

function legacyFile(role: EvalRole): string {
  return path.join(DIR, `latest-${role}.json`);
}

function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export const evalStore = {
  readHistory: (role: EvalRole): RunRecord[] =>
    readJson<RunRecord[]>(historyFile(role)) ?? [],
  writeHistory: (role: EvalRole, runs: RunRecord[]) =>
    writeJson(historyFile(role), runs),
  readLegacyLatest: (role: EvalRole) => readJson<LegacyRun>(legacyFile(role)),
  readBaseline: (role: EvalRole): RoleReport | null =>
    readJson<Record<string, RoleReport>>(BASELINE_FILE)?.[role] ?? null,
  writeBaseline: (report: RoleReport) => {
    const all = readJson<Record<string, RoleReport>>(BASELINE_FILE) ?? {};
    all[report.role] = report;
    writeJson(BASELINE_FILE, all);
  },
};
