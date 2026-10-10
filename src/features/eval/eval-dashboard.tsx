"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Play, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type {
  EvalOverview,
  EvalRoleOverview,
} from "@/application/eval/eval-service";
import { PRICING_MODEL } from "@/domain/eval/cost";
import { compare, type Verdict } from "@/domain/eval/report";
import {
  EVAL_ROLE_LABELS,
  type CaseOutcome,
  type RoleReport,
  type RunRecord,
} from "@/domain/eval/types";
import { runEvalAction, setBaselineAction } from "@/app/dev/eval/actions";

const VERDICT_LABEL: Record<Verdict, string> = {
  better: "Better than baseline",
  worse: "Worse than baseline",
  same: "Same as baseline",
  no_baseline: "No baseline yet",
};

const VERDICT_VARIANT: Record<Verdict, "success" | "destructive" | "muted"> = {
  better: "success",
  worse: "destructive",
  same: "muted",
  no_baseline: "muted",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const usd = (n: number) => `$${n.toFixed(2)}`;

function CaseRow({ outcome }: { outcome: CaseOutcome }) {
  const [open, setOpen] = useState(false);
  const failing = outcome.checks.filter((c) => !c.pass);
  const status = outcome.error ? "error" : outcome.pass ? "pass" : "fail";

  return (
    <li className="border-b last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 py-2.5 text-left text-sm"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <Badge
          variant={
            status === "pass"
              ? "success"
              : status === "fail"
                ? "destructive"
                : "warning"
          }
          className="w-14 justify-center uppercase"
        >
          {status}
        </Badge>
        <span className="font-mono text-xs">{outcome.id}</span>
        {failing.length > 0 && (
          <span className="truncate text-xs text-muted-foreground">
            {failing.map((c) => c.name).join(", ")}
          </span>
        )}
      </button>
      {open && (
        <div className="space-y-3 pb-4 pl-7 text-sm">
          {outcome.error && (
            <p className="rounded-md bg-warning/15 p-2 text-xs">{outcome.error}</p>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Test input
            </p>
            <p className="mt-1 whitespace-pre-wrap">{outcome.input}</p>
          </div>
          {outcome.checks.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Checks
              </p>
              <ul className="mt-1 space-y-1">
                {outcome.checks.map((c) => (
                  <li key={c.name} className="flex items-start gap-2">
                    {c.pass ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    <span>
                      {c.name}
                      {c.detail && (
                        <span className="text-muted-foreground"> - {c.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {outcome.observed && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                What the model said
              </p>
              <p className="mt-1">{outcome.observed.summary}</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {outcome.observed.issues.map((i, idx) => (
                  <li key={idx}>
                    <span className="font-mono text-xs">{i.code}</span>
                    {i.naturalness && ` (${i.naturalness})`}
                    {i.evidence && <> &ldquo;{i.evidence}&rdquo;</>}
                  </li>
                ))}
                {outcome.observed.improvedVersion && (
                  <li>Includes an improved version</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function RolePanel({
  data,
  canRun,
  model,
}: {
  data: EvalRoleOverview;
  canRun: boolean;
  model: string;
}) {
  const [latest, setLatest] = useState<RunRecord | null>(data.latest);
  const [baseline, setBaseline] = useState<RoleReport | null>(data.baseline);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comparison = latest ? compare(latest.report, baseline) : null;
  const staleVersion = latest && latest.promptVersion !== data.promptVersion;

  async function run() {
    setConfirming(false);
    setRunning(true);
    setError(null);
    const res = await runEvalAction(data.role, true);
    setRunning(false);
    if (res.ok) setLatest(res.value);
    else setError(res.error);
  }

  async function saveBaseline() {
    setError(null);
    const res = await setBaselineAction(data.role);
    if (res.ok) setBaseline(res.value);
    else setError(res.error);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{EVAL_ROLE_LABELS[data.role]}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{data.promptVersion}</Badge>
              <span className="text-xs text-muted-foreground">
                {data.caseCount} test cases
              </span>
            </div>
          </div>
          <Button
            onClick={() => setConfirming(true)}
            disabled={!canRun || running || confirming}
          >
            {running ? <Spinner /> : <Play />}
            {running ? "Running..." : "Run eval"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {confirming && (
          <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <p className="font-medium">This calls the live Gemini API and costs money.</p>
            <p>
              {data.estimate.calls} calls to <span className="font-mono">{model}</span>,
              estimated {usd(data.estimate.lowUsd)} - {usd(data.estimate.highUsd)}.
            </p>
            <p className="text-xs text-muted-foreground">
              Estimate uses {PRICING_MODEL} pricing and measured prompt sizes. A
              retry on a malformed answer can add a few calls.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={run}>
                Confirm and run
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!latest && !running && (
          <p className="text-sm text-muted-foreground">
            No run yet. Nothing is called until you confirm.
          </p>
        )}

        {latest && comparison && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <p className="text-3xl font-semibold tabular-nums">
                  {pct(latest.report.passRate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {latest.report.passed}/{latest.report.total} cases pass
                </p>
              </div>
              <div className="space-y-1">
                <Badge variant={VERDICT_VARIANT[comparison.verdict]}>
                  {VERDICT_LABEL[comparison.verdict]}
                </Badge>
                {baseline && (
                  <p className="text-xs text-muted-foreground">
                    Baseline {baseline.promptVersion}: {pct(baseline.passRate)}
                    {comparison.verdict !== "same" &&
                      ` (${comparison.delta >= 0 ? "+" : ""}${Math.round(comparison.delta * 100)} pts)`}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Ran <span suppressHydrationWarning>{new Date(latest.finishedAt).toLocaleString()}</span> on {latest.model}
              </p>
            </div>

            {data.promptChangedSinceLastRun && (
              <p className="rounded-md bg-warning/15 p-3 text-sm">
                The prompt in code has changed since this run, so these results
                describe the old text. Run again to measure the new one.{" "}
                <Link href="/dev/eval/history" className="underline underline-offset-4">
                  See what changed
                </Link>
              </p>
            )}

            {staleVersion && (
              <p className="text-xs text-muted-foreground">
                This run was for {latest.promptVersion}; the current prompt is{" "}
                {data.promptVersion}. Run again to measure it.
              </p>
            )}

            {latest.report.errors > 0 && (
              <p className="rounded-md bg-warning/15 p-3 text-sm">
                Incomplete: {latest.report.errors} case(s) hit an API error
                {latest.aborted && " (quota exhausted, the run stopped early)"}. They
                are excluded from the pass-rate and this run cannot become a
                baseline.
              </p>
            )}

            {(comparison.regressions.length > 0 || comparison.fixes.length > 0) && (
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                {comparison.regressions.length > 0 && (
                  <div>
                    <p className="font-medium text-destructive">
                      Newly failing ({comparison.regressions.length})
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {comparison.regressions.join(", ")}
                    </p>
                  </div>
                )}
                {comparison.fixes.length > 0 && (
                  <div>
                    <p className="font-medium text-success">
                      Newly passing ({comparison.fixes.length})
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {comparison.fixes.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            <ul className="rounded-lg border px-4">
              {latest.outcomes.map((o) => (
                <CaseRow key={o.id} outcome={o} />
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dev/eval/history"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                View progress over time
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={saveBaseline}
                disabled={latest.report.errors > 0}
              >
                Save this run as baseline
              </Button>
              <span className="text-xs text-muted-foreground">
                Future runs are compared against the baseline.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EvalDashboard({ overview }: { overview: EvalOverview }) {
  return (
    <div className="space-y-4">
      {!overview.canRun && (
        <p className="rounded-md bg-warning/15 p-3 text-sm">
          The active AI provider is <span className="font-mono">{overview.provider}</span>.
          The mock returns canned output, so an eval would measure nothing. Set
          GEMINI_API_KEY to enable runs. You can still read saved results.
        </p>
      )}
      {overview.roles.map((role) => (
        <RolePanel
          key={role.role}
          data={role}
          canRun={overview.canRun}
          model={overview.model}
        />
      ))}
    </div>
  );
}
