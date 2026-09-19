import { CheckCircle2, Target, Quote, GraduationCap, Dumbbell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InterviewReview } from "@/domain/interview/interview-feedback";

const READINESS: Record<
  string,
  { label: string; variant: "success" | "default" | "warning" | "secondary" }
> = {
  strong: { label: "Strong", variant: "success" },
  solid: { label: "Solid", variant: "default" },
  developing: { label: "Developing", variant: "warning" },
  early: { label: "Early", variant: "secondary" },
};

const CODE_LABEL: Record<string, string> = {
  too_generic: "Too generic",
  insufficient_depth: "Not deep enough",
  weak_tradeoff: "Weak on trade-offs",
  weak_example: "Weak example",
  unsupported_claim: "Unsupported claim",
  missing_metric: "Missing metric",
};

export function InterviewReviewView({ review }: { review: InterviewReview }) {
  const readiness = READINESS[review.readiness] ?? READINESS.developing;

  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-4 text-primary" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Overall
        </span>
        <Badge variant={readiness.variant}>{readiness.label}</Badge>
      </div>
      <p className="leading-relaxed">{review.overallSummary}</p>

      {review.topFocusAreas.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Focus on these next
            </span>
          </div>
          <ul className="list-inside list-disc space-y-1">
            {review.topFocusAreas.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {review.strengths.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Strengths
          </p>
          {review.strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {review.areasToImprove.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Areas to improve
          </p>
          {review.areasToImprove.map((a, i) => (
            <div key={i} className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="warning">{CODE_LABEL[a.code] ?? a.code}</Badge>
                <span className="font-medium">{a.title}</span>
              </div>
              <p className="text-muted-foreground">{a.detail}</p>
              {a.evidence && (
                <p className="mt-2 flex items-start gap-1.5 text-xs italic text-muted-foreground">
                  <Quote className="mt-0.5 size-3 shrink-0" />
                  <span>&ldquo;{a.evidence}&rdquo;</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {review.recommendedPractice.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-accent/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Dumbbell className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Practice next
            </span>
          </div>
          <ul className="list-inside list-disc space-y-1">
            {review.recommendedPractice.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
