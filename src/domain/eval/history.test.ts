import { describe, expect, it } from "vitest";
import { collapseContext, diffLines } from "./diff";
import { buildTimeline } from "./history";
import { diffSnapshots, makeSnapshot } from "./prompt-snapshot";
import { summarize } from "./report";
import type { CaseOutcome, RunRecord } from "./types";

function outcome(id: string, pass: boolean): CaseOutcome {
  return { id, input: "", pass, checks: [] };
}

function run(
  id: string,
  finishedAt: string,
  version: string,
  promptText: string,
  results: Record<string, boolean>,
  model = "m1",
): RunRecord {
  const outcomes = Object.entries(results).map(([k, v]) => outcome(k, v));
  return {
    id,
    role: "vietnamese-coach",
    promptVersion: version,
    model,
    startedAt: finishedAt,
    finishedAt,
    aborted: false,
    prompt: makeSnapshot([{ title: "System", text: promptText }]),
    note: "",
    report: summarize("vietnamese-coach", version, outcomes),
    outcomes,
  };
}

describe("diffLines", () => {
  it("marks added, removed and unchanged lines", () => {
    expect(diffLines("a\nb\nc", "a\nx\nc")).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "add", text: "x" },
      { kind: "same", text: "c" },
    ]);
  });

  it("treats empty input as all added or all removed", () => {
    expect(diffLines("", "a").map((l) => l.kind)).toEqual(["add"]);
    expect(diffLines("a", "").map((l) => l.kind)).toEqual(["del"]);
  });

  it("collapses long unchanged stretches around the change", () => {
    const before = Array.from({ length: 12 }, (_, i) => `l${i}`).join("\n");
    const after = before.replace("l6", "CHANGED");
    const rows = collapseContext(diffLines(before, after), 1);
    expect(rows.some((r) => r.kind === "gap")).toBe(true);
    expect(rows.filter((r) => r.kind === "add")).toHaveLength(1);
    expect(rows.length).toBeLessThan(12);
  });
});

describe("snapshots", () => {
  it("hashes identical text identically and differing text differently", () => {
    const a = makeSnapshot([{ title: "t", text: "x" }]);
    expect(makeSnapshot([{ title: "t", text: "x" }]).hash).toBe(a.hash);
    expect(makeSnapshot([{ title: "t", text: "y" }]).hash).not.toBe(a.hash);
  });

  it("diffs per section and reports which changed", () => {
    const before = makeSnapshot([
      { title: "A", text: "same" },
      { title: "B", text: "old" },
    ]);
    const after = makeSnapshot([
      { title: "A", text: "same" },
      { title: "B", text: "new" },
    ]);
    const diff = diffSnapshots(before, after);
    expect(diff.find((d) => d.title === "A")?.changed).toBe(false);
    expect(diff.find((d) => d.title === "B")?.changed).toBe(true);
  });
});

describe("buildTimeline", () => {
  const r1 = run("r1", "2026-10-01T00:00:00Z", "v1.0", "rules", { a: true, b: false, c: false });
  const r2 = run("r2", "2026-10-02T00:00:00Z", "v1.0", "rules edited", { a: true, b: true, c: false });
  const r3 = run("r3", "2026-10-03T00:00:00Z", "v1.1", "rules edited again", { a: false, b: true, c: true }, "m2");

  it("computes deltas, regressions and fixes against the previous run", () => {
    const { entries } = buildTimeline([r3, r1, r2], "r2");
    expect(entries.map((e) => e.run.id)).toEqual(["r1", "r2", "r3"]);
    expect(entries[0].deltaVsPrevious).toBeNull();
    expect(entries[1].vsPrevious?.fixes).toEqual(["b"]);
    expect(entries[2].vsPrevious?.regressions).toEqual(["a"]);
    expect(entries[2].vsPrevious?.fixes).toEqual(["c"]);
    expect(entries[1].isBaseline).toBe(true);
    expect(entries[0].isBaseline).toBe(false);
  });

  it("flags a prompt edit that did not bump the version", () => {
    const { entries } = buildTimeline([r1, r2, r3], null);
    expect(entries[1].promptChanged).toBe(true);
    expect(entries[1].changedWithoutBump).toBe(true);
    expect(entries[2].versionChanged).toBe(true);
    expect(entries[2].changedWithoutBump).toBe(false);
    expect(entries[2].modelChanged).toBe(true);
  });

  it("builds a case by run matrix with gaps for unmeasured cases", () => {
    const late = run("r4", "2026-10-04T00:00:00Z", "v1.1", "x", { a: true, d: true });
    const { matrix, entries } = buildTimeline([r1, late], null);
    expect(matrix.find((m) => m.caseId === "a")?.cells).toEqual([true, true]);
    expect(matrix.find((m) => m.caseId === "b")?.cells).toEqual([false, null]);
    expect(matrix.find((m) => m.caseId === "d")?.cells).toEqual([null, true]);
    expect(entries[1].caseSetChanged).toBe(true);
  });
});
