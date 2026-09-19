import { CheckCircle2, Target, Quote, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  InterviewFeedback,
  InterviewIssue,
} from "@/domain/interview/interview-feedback";

const CODE_LABEL: Record<string, string> = {
  too_generic: "Too generic",
  insufficient_depth: "Not deep enough",
  weak_tradeoff: "Weak on trade-offs",
  weak_example: "Weak example",
  unsupported_claim: "Unsupported claim",
  missing_metric: "Missing metric",
};

function IssueCard({ issue }: { issue: InterviewIssue }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant="warning">{CODE_LABEL[issue.code] ?? issue.code}</Badge>
        <span className="font-medium">{issue.title}</span>
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

export function InterviewFeedbackView({
  feedback,
}: {
  feedback: InterviewFeedback;
}) {
  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed">{feedback.summary}</p>

      {feedback.comparison && (
        <div className="rounded-lg border border-primary/30 bg-accent/40 p-3">
          <div className="mb-1 flex items-center gap-2 text-primary">
            <ArrowUpRight className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Since last attempt
            </span>
          </div>
          <p>
            <span className="font-medium">Better: </span>
            {feedback.comparison.improvement}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Still: </span>
            {feedback.comparison.remainingIssue}
          </p>
        </div>
      )}

      {feedback.topFocusAreas.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Focus on these
            </span>
          </div>
          <ul className="list-inside list-disc space-y-1">
            {feedback.topFocusAreas.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {feedback.strengths.length > 0 && (
        <div className="space-y-1.5">
          {feedback.strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {feedback.issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What a senior interviewer would push on
          </p>
          {feedback.issues.map((issue, i) => (
            <IssueCard key={i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}
