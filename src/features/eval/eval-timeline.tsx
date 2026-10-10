"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Minus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { EvalHistoryRole } from "@/application/eval/eval-service";
import { billedOutputTokens } from "@/domain/eval/cost";
import { collapseContext } from "@/domain/eval/diff";
import { buildTimeline, type TimelineEntry } from "@/domain/eval/history";
import { diffSnapshots, type SectionDiff } from "@/domain/eval/prompt-snapshot";
import { EVAL_ROLE_LABELS, type RunRecord } from "@/domain/eval/types";
import { cn } from "@/lib/utils";
import { updateRunNoteAction } from "@/app/dev/eval/actions";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const usd = (n: number) => `$${n.toFixed(2)}`;
const pts = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n * 100)} pts`;

function Time({ iso }: { iso: string }) {
  return <span suppressHydrationWarning>{new Date(iso).toLocaleString()}</span>;
}

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null) return <Badge variant="muted">First run</Badge>;
  if (Math.abs(delta) < 0.005) {
    return (
      <Badge variant="muted">
        <Minus className="mr-1 size-3" /> No change
      </Badge>
    );
  }
  return delta > 0 ? (
    <Badge variant="success">
      <ArrowUp className="mr-1 size-3" /> {pts(delta)}
    </Badge>
  ) : (
    <Badge variant="destructive">
      <ArrowDown className="mr-1 size-3" /> {pts(delta)}
    </Badge>
  );
}

function PromptDiff({ diffs }: { diffs: SectionDiff[] }) {
  const changed = diffs.filter((d) => d.changed);
  if (changed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The prompt text is identical to the previous run.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {changed.map((section) => (
        <div key={section.title}>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {section.title}
          </p>
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-2 text-xs leading-5">
            {collapseContext(section.lines, 2).map((row, i) =>
              row.kind === "gap" ? (
                <div key={i} className="text-muted-foreground">
                  ... {row.hidden} unchanged lines
                </div>
              ) : (
                <div
                  key={i}
                  className={cn(
                    "whitespace-pre-wrap",
                    row.kind === "add" && "bg-success/10 text-success",
                    row.kind === "del" && "bg-destructive/10 text-destructive",
                  )}
                >
                  <span aria-hidden className="select-none pr-2">
                    {row.kind === "add" ? "+" : row.kind === "del" ? "-" : " "}
                  </span>
                  <span className="sr-only">
                    {row.kind === "add" ? "added: " : row.kind === "del" ? "removed: " : ""}
                  </span>
                  {row.text || " "}
                </div>
              ),
            )}
          </pre>
        </div>
      ))}
    </div>
  );
}

function PassRateChart({ entries }: { entries: TimelineEntry[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 230;
  const pad = { l: 40, r: 24, t: 28, b: 34 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const x = (i: number) =>
    entries.length === 1 ? pad.l + innerW / 2 : pad.l + (i * innerW) / (entries.length - 1);
  const y = (rate: number) => pad.t + innerH * (1 - rate);
  const path = entries
    .map((e, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(e.run.report.passRate)}`)
    .join(" ");
  const active = hover === null ? null : entries[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Pass-rate across ${entries.length} runs`}
      >
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(g)}
              y2={y(g)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={pad.l - 8}
              y={y(g) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {pct(g)}
            </text>
          </g>
        ))}

        {entries.map((e, i) =>
          e.versionChanged || i === 0 ? (
            <g key={`v-${e.run.id}`}>
              {i > 0 && (
                <line
                  x1={(x(i - 1) + x(i)) / 2}
                  x2={(x(i - 1) + x(i)) / 2}
                  y1={pad.t - 6}
                  y2={H - pad.b}
                  className="stroke-border"
                  strokeDasharray="4 4"
                />
              )}
              <text
                x={i === 0 ? x(i) : (x(i - 1) + x(i)) / 2 + 6}
                y={14}
                textAnchor={i === 0 ? "start" : "start"}
                className="fill-muted-foreground text-[11px]"
              >
                {e.run.promptVersion.replace(/^.*@/, "v")}
              </text>
            </g>
          ) : null,
        )}

        <path d={path} fill="none" className="stroke-primary" strokeWidth={2} />

        {entries.map((e, i) => (
          <g key={e.run.id}>
            <circle
              cx={x(i)}
              cy={y(e.run.report.passRate)}
              r={hover === i ? 7 : 5}
              className="fill-primary stroke-card"
              strokeWidth={2}
            />
            {e.isBaseline && (
              <text
                x={x(i)}
                y={H - pad.b + 28}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-medium"
              >
                baseline
              </text>
            )}
            <text
              x={x(i)}
              y={H - pad.b + 14}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              #{i + 1}
            </text>
          </g>
        ))}

        {[0, entries.length - 1]
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .map((i) => (
            <text
              key={`l-${i}`}
              x={x(i)}
              y={y(entries[i].run.report.passRate) - 12}
              textAnchor="middle"
              className="fill-foreground text-xs font-medium"
            >
              {pct(entries[i].run.report.passRate)}
            </text>
          ))}

        {entries.map((e, i) => (
          <rect
            key={`hit-${e.run.id}`}
            x={x(i) - innerW / Math.max(entries.length, 1) / 2}
            y={pad.t}
            width={innerW / Math.max(entries.length, 1)}
            height={innerH + 20}
            fill="transparent"
            tabIndex={0}
            role="img"
            aria-label={`Run ${i + 1}, ${e.run.promptVersion}, ${pct(e.run.report.passRate)} pass`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          />
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-56 -translate-x-1/2 rounded-md border bg-card p-3 text-xs shadow-md"
          style={{ left: `${Math.min(Math.max((x(hover!) / W) * 100, 18), 82)}%` }}
        >
          <p className="font-medium">
            Run #{hover! + 1} · {active.run.promptVersion}
          </p>
          <p className="text-muted-foreground">
            {active.run.report.passed}/{active.run.report.total} pass (
            {pct(active.run.report.passRate)})
          </p>
          {active.deltaVsPrevious !== null && (
            <p className="text-muted-foreground">{pts(active.deltaVsPrevious)} vs previous</p>
          )}
          <p className="text-muted-foreground">
            {active.promptChanged ? "Prompt text edited" : "Prompt unchanged"}
          </p>
        </div>
      )}
    </div>
  );
}

function VersionJourney({ entries }: { entries: TimelineEntry[] }) {
  const groups: { version: string; first: TimelineEntry; last: TimelineEntry; runs: number }[] = [];
  for (const entry of entries) {
    const current = groups.at(-1);
    if (current && current.version === entry.run.promptVersion) {
      current.last = entry;
      current.runs += 1;
    } else {
      groups.push({ version: entry.run.promptVersion, first: entry, last: entry, runs: 1 });
    }
  }
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {groups.map((g, i) => (
        <li key={`${g.version}-${i}`} className="flex items-center gap-2">
          {i > 0 && <ArrowRight className="size-4 text-muted-foreground" aria-label="then" />}
          <div className="rounded-lg border px-3 py-2">
            <p className="font-mono text-xs">{g.version}</p>
            <p className="text-sm font-semibold tabular-nums">
              {g.runs > 1 && `${pct(g.first.run.report.passRate)} → `}
              {pct(g.last.run.report.passRate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {g.runs} run{g.runs === 1 ? "" : "s"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RunCard({
  entry,
  previous,
  role,
  onNote,
  defaultOpen,
}: {
  entry: TimelineEntry;
  previous: RunRecord | null;
  role: string;
  onNote: (run: RunRecord) => void;
  defaultOpen: boolean;
}) {
  const { run } = entry;
  const [open, setOpen] = useState(defaultOpen);
  const [note, setNote] = useState(run.note);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const diffs = useMemo(() => diffSnapshots(previous?.prompt ?? null, run.prompt), [previous, run]);

  async function save() {
    setStatus("saving");
    const res = await updateRunNoteAction(role, run.id, note);
    if (res.ok) {
      onNote(res.value);
      setStatus("saved");
    } else {
      setStatus("error");
    }
  }

  return (
    <li className="rounded-lg border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 p-3 text-left"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span className="text-sm font-medium">Run #{entry.index + 1}</span>
        <Badge variant="muted" className="font-mono">
          {run.promptVersion}
        </Badge>
        <span className="text-lg font-semibold tabular-nums">{pct(run.report.passRate)}</span>
        <DeltaChip delta={entry.deltaVsPrevious} />
        {entry.isBaseline && <Badge variant="default">Baseline</Badge>}
        {entry.versionChanged && <Badge variant="secondary">Version bumped</Badge>}
        {entry.promptChanged && !entry.changedWithoutBump && (
          <Badge variant="secondary">Prompt edited</Badge>
        )}
        {entry.changedWithoutBump && (
          <Badge variant="warning">Prompt edited, version not bumped</Badge>
        )}
        {entry.modelChanged && <Badge variant="warning">Model changed</Badge>}
        {entry.caseSetChanged && <Badge variant="warning">Test cases changed</Badge>}
        {run.report.errors > 0 && <Badge variant="warning">Incomplete</Badge>}
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {run.costUsd !== undefined && <span>{usd(run.costUsd)}</span>}
          <Time iso={run.finishedAt} />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t p-4 text-sm">
          <p className="text-xs text-muted-foreground">
            {run.usage && run.costUsd !== undefined
              ? `Spent ${usd(run.costUsd)} on ${run.usage.calls} requests: ${run.usage.promptTokens.toLocaleString()} input tokens, ${billedOutputTokens(run.usage).toLocaleString()} output tokens of which ${run.usage.thoughtsTokens.toLocaleString()} were thinking.`
              : "Token usage was not measured for this run."}
            {run.abortReason === "budget" && " Stopped at the per-run spend cap."}
            {run.abortReason === "quota" && " Stopped early: quota exhausted."}
          </p>

          {run.probes && run.probes.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Stability of failing cases (re-run on the same prompt)
              </p>
              <ul className="space-y-0.5">
                {run.probes.map((p) => {
                  const passes = p.attempts.filter((a) => a.pass).length;
                  return (
                    <li key={p.caseId} className="flex items-center gap-2">
                      <span className="font-mono text-xs">{p.caseId}</span>
                      <Badge variant={passes === p.attempts.length ? "success" : passes === 0 ? "destructive" : "warning"}>
                        {passes === p.attempts.length ? "passes when re-run" : passes === 0 ? "fails every re-run" : "flaky"} {passes}/{p.attempts.length}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              What I changed and why
            </p>
            <Textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setStatus("idle");
              }}
              placeholder="e.g. Added the allowed code list to the output contract"
              rows={2}
            />
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={save} disabled={status === "saving" || note === run.note}>
                Save note
              </Button>
              {status === "saved" && <span className="text-xs text-success">Saved</span>}
              {status === "error" && <span className="text-xs text-destructive">Could not save</span>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-medium text-success">
                Newly passing ({entry.vsPrevious?.fixes.length ?? 0})
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {entry.vsPrevious?.fixes.join(", ") || "none"}
              </p>
            </div>
            <div>
              <p className="font-medium text-destructive">
                Newly failing ({entry.vsPrevious?.regressions.length ?? 0})
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {entry.vsPrevious?.regressions.join(", ") || "none"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {previous
                ? `Prompt change: ${previous.promptVersion} → ${run.promptVersion}`
                : "Prompt measured by this run"}
            </p>
            {previous ? (
              <PromptDiff diffs={diffs} />
            ) : (
              <p className="text-sm text-muted-foreground">
                First recorded run, so there is nothing earlier to compare with.
                {run.backfilled &&
                  " Its prompt text was captured from the code when history was added; it matches the version string."}
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function CaseMatrix({ entries, rows }: { entries: TimelineEntry[]; rows: ReturnType<typeof buildTimeline>["matrix"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card p-2 text-left font-medium text-muted-foreground">
              Test case
            </th>
            {entries.map((e) => (
              <th key={e.run.id} className="p-2 text-center font-normal text-muted-foreground">
                <div className="font-medium">#{e.index + 1}</div>
                <div className="font-mono">{e.run.promptVersion.replace(/^.*@/, "v")}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.caseId}>
              <td className="sticky left-0 whitespace-nowrap bg-card p-2 font-mono">{row.caseId}</td>
              {row.cells.map((cell, i) => (
                <td key={i} className="p-0.5 text-center">
                  <span
                    title={cell === null ? "not measured" : cell ? "pass" : "fail"}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-md",
                      cell === null && "bg-muted text-muted-foreground",
                      cell === true && "bg-success/10 text-success",
                      cell === false && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {cell === null ? (
                      <Minus className="size-3.5" aria-label="not measured" />
                    ) : cell ? (
                      <Check className="size-3.5" aria-label="pass" />
                    ) : (
                      <X className="size-3.5" aria-label="fail" />
                    )}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RolePanel({ data }: { data: EvalHistoryRole }) {
  const [runs, setRuns] = useState(data.runs);
  const timeline = useMemo(() => buildTimeline(runs, data.baselineRunId), [runs, data.baselineRunId]);
  const { entries, matrix } = timeline;
  const last = entries.at(-1);
  const unmeasured = last ? last.run.prompt.hash !== data.currentPrompt.hash : false;

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6 text-sm">
          <p>No runs recorded for {EVAL_ROLE_LABELS[data.role]} yet.</p>
          <Link href="/dev/eval" className="text-primary underline-offset-4 hover:underline">
            Go to Prompt Eval to run one
          </Link>
        </CardContent>
      </Card>
    );
  }

  const spend = runs.reduce((sum, r) => sum + (r.costUsd ?? 0) + (r.probeCostUsd ?? 0), 0);
  const measuredRuns = runs.filter((r) => r.costUsd !== undefined).length;
  const unmeasuredDiffs = unmeasured && last ? diffSnapshots(last.run.prompt, data.currentPrompt) : [];

  return (
    <div className="space-y-4">
      {unmeasured && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="text-base">Unmeasured prompt change</CardTitle>
            <p className="text-sm text-muted-foreground">
              The prompt in code ({data.currentVersion}) is not the one the last
              run measured ({last?.run.promptVersion}). Run the eval to see
              whether this change helped.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <PromptDiff diffs={unmeasuredDiffs} />
            <Link href="/dev/eval" className="text-sm text-primary underline-offset-4 hover:underline">
              Go to Prompt Eval to run it
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prompt journey</CardTitle>
        </CardHeader>
        <CardContent>
          <VersionJourney entries={entries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pass-rate per run</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each point is one eval run. Dashed lines mark a new prompt version.
          </p>
        </CardHeader>
        <CardContent>
          <PassRateChart entries={entries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Runs (newest first)</CardTitle>
          <p className="text-sm text-muted-foreground">
            {measuredRuns > 0
              ? `Recorded spend: ${usd(spend)} across ${measuredRuns} measured run${measuredRuns === 1 ? "" : "s"}.`
              : "No spend recorded yet: runs before token metering have no cost data."}
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {[...entries].reverse().map((entry, i) => (
              <RunCard
                key={entry.run.id}
                entry={entry}
                previous={entry.index > 0 ? entries[entry.index - 1].run : null}
                role={data.role}
                defaultOpen={i === 0}
                onNote={(updated) =>
                  setRuns((rs) => rs.map((r) => (r.id === updated.id ? updated : r)))
                }
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Every test case, run by run</CardTitle>
          <p className="text-sm text-muted-foreground">
            Read a row left to right to see when a case started passing or
            broke. A dash means the case did not exist or hit an API error.
          </p>
        </CardHeader>
        <CardContent>
          <CaseMatrix entries={entries} rows={matrix} />
        </CardContent>
      </Card>
    </div>
  );
}

export function EvalTimeline({ history }: { history: EvalHistoryRole[] }) {
  const [role, setRole] = useState(history[0]?.role);
  const current = history.find((h) => h.role === role) ?? history[0];

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {history.map((h) => (
          <Button
            key={h.role}
            role="tab"
            aria-selected={h.role === role}
            variant={h.role === role ? "default" : "outline"}
            size="sm"
            onClick={() => setRole(h.role)}
          >
            {EVAL_ROLE_LABELS[h.role]}
            <span className="text-xs opacity-80">({h.runs.length})</span>
          </Button>
        ))}
      </div>
      {current && <RolePanel key={current.role} data={current} />}
    </div>
  );
}
