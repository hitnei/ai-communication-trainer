"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2, ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  MATCH_STATUS_LABEL,
  type MatchStatus,
} from "@/domain/profile/types";
import type { JdWithRequirements } from "@/infrastructure/db/repositories/jd-repository";
import {
  analyzeJdAction,
  deleteJdAction,
  generateJobTrackAction,
} from "@/app/profile/actions";

const STATUS_VARIANT: Record<
  MatchStatus,
  "success" | "secondary" | "warning" | "muted"
> = {
  strong: "success",
  medium: "secondary",
  weak: "warning",
  unknown: "muted",
};

export function JobDescriptions({ jds }: { jds: JdWithRequirements[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    const r = await analyzeJdAction(text);
    if (r.ok) {
      setText("");
      router.refresh();
    } else {
      setError(r.message);
    }
    setAnalyzing(false);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Job descriptions
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Paste a job description
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a job description to see how you match and generate a tailored interview track…"
            className="min-h-24"
          />
          <Button size="sm" onClick={analyze} disabled={analyzing || !text.trim()}>
            {analyzing ? <Spinner /> : <Sparkles className="size-4" />} Analyze &amp; match
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {jds.map((item) => (
        <JdCard key={item.jd.id} item={item} />
      ))}
    </section>
  );

  function JdCard({ item }: { item: JdWithRequirements }) {
    const [open, setOpen] = useState(false);
    const [trackMsg, setTrackMsg] = useState<string | null>(null);
    const { jd, requirements } = item;

    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{jd.title}</span>
                {jd.company && (
                  <span className="text-sm text-muted-foreground">{jd.company}</span>
                )}
                <Badge variant={STATUS_VARIANT[jd.overallStatus]}>
                  {MATCH_STATUS_LABEL[jd.overallStatus]} match
                </Badge>
              </div>
              {jd.summary && (
                <p className="mt-1 text-sm text-muted-foreground">{jd.summary}</p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Delete"
              onClick={() =>
                startTransition(async () => {
                  await deleteJdAction(jd.id);
                  router.refresh();
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              Requirements ({requirements.length})
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                startTransition(async () => {
                  const r = await generateJobTrackAction(jd.id);
                  setTrackMsg(`Added ${r.added} tailored question${r.added === 1 ? "" : "s"} to your bank.`);
                  router.refresh();
                })
              }
            >
              <ListChecks className="size-4" /> Generate interview track
            </Button>
            {trackMsg && <span className="text-xs text-success">{trackMsg}</span>}
          </div>

          {open && requirements.length > 0 && (
            <ul className="space-y-2 border-l pl-3">
              {requirements.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[r.matchStatus]}>
                      {MATCH_STATUS_LABEL[r.matchStatus]}
                    </Badge>
                    <span>{r.text}</span>
                  </div>
                  {r.note && (
                    <p className="text-xs text-muted-foreground">{r.note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }
}
