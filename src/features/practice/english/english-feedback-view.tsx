import {
  CheckCircle2,
  Target,
  Quote,
  Sparkles,
  Volume2,
  ArrowUpRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  EnglishAttemptFeedback,
  EnglishIssue,
} from "@/domain/practice/english-feedback";

const NATURALNESS_LABEL: Record<string, string> = {
  natural: "Natural",
  acceptable: "Acceptable",
  context_dependent: "Depends on context",
  awkward: "Awkward",
  incorrect: "Incorrect",
};

const NATURALNESS_VARIANT: Record<
  string,
  "success" | "secondary" | "warning" | "destructive"
> = {
  natural: "success",
  acceptable: "secondary",
  context_dependent: "secondary",
  awkward: "warning",
  incorrect: "destructive",
};

const INTELLIGIBILITY_LABEL: Record<string, string> = {
  clear: "Clear",
  mostly_clear: "Mostly clear",
  sometimes_unclear: "Sometimes unclear",
  hard_to_follow: "Hard to follow",
};

function IssueCard({ issue }: { issue: EnglishIssue }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant={issue.category === "content" ? "secondary" : "default"}>
          {issue.category === "content" ? "Content" : "English"}
        </Badge>
        <span className="font-medium">{issue.title}</span>
        {issue.naturalness && (
          <Badge variant={NATURALNESS_VARIANT[issue.naturalness] ?? "secondary"}>
            {NATURALNESS_LABEL[issue.naturalness] ?? issue.naturalness}
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground">{issue.detail}</p>
      {issue.evidence && (
        <p className="mt-2 flex items-start gap-1.5 text-xs italic text-muted-foreground">
          <Quote className="mt-0.5 size-3 shrink-0" />
          <span>&ldquo;{issue.evidence}&rdquo;</span>
        </p>
      )}
    </div>
  );
}

export function EnglishFeedbackView({
  feedback,
}: {
  feedback: EnglishAttemptFeedback;
}) {
  const { english, pronunciation } = feedback;

  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed">{english.summary}</p>

      {english.comparison && (
        <div className="rounded-lg border border-primary/30 bg-accent/40 p-3">
          <div className="mb-1 flex items-center gap-2 text-primary">
            <ArrowUpRight className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Since last time
            </span>
          </div>
          <p>
            <span className="font-medium">Better: </span>
            {english.comparison.improvement}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Still: </span>
            {english.comparison.remainingIssue}
          </p>
        </div>
      )}

      {english.topFocusAreas.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Focus on these {english.topFocusAreas.length}
            </span>
          </div>
          <ul className="list-inside list-disc space-y-1">
            {english.topFocusAreas.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {english.strengths.length > 0 && (
        <div className="space-y-1.5">
          {english.strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {english.issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What I noticed
          </p>
          {english.issues.map((issue, i) => (
            <IssueCard key={i} issue={issue} />
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-1 flex items-center gap-2">
          <Volume2 className="size-4 text-primary" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pronunciation
          </span>
        </div>
        {!pronunciation || !pronunciation.assessed ? (
          <p className="text-muted-foreground">
            {pronunciation?.summary ||
              "Couldn't assess pronunciation reliably from this recording."}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {pronunciation.intelligibility && (
                <Badge variant="secondary">
                  {INTELLIGIBILITY_LABEL[pronunciation.intelligibility] ??
                    pronunciation.intelligibility}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {pronunciation.summary}
              </span>
            </div>
            {pronunciation.flaggedWords.length > 0 && (
              <ul className="space-y-1">
                {pronunciation.flaggedWords.map((w, i) => (
                  <li key={i}>
                    <span className="font-medium">{w.word}</span>
                    <span className="text-muted-foreground"> - {w.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {english.improvedVersion && (
        <div className="rounded-lg border border-primary/30 bg-accent/40 p-3">
          <div className="mb-1.5 flex items-center gap-2 text-primary">
            <Sparkles className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              A more natural way to say it
            </span>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">
            {english.improvedVersion}
          </p>
        </div>
      )}
    </div>
  );
}
