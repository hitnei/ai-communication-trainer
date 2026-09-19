import { Lightbulb, HelpCircle, CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VietnameseCoachFeedback } from "@/domain/practice/vietnamese-feedback";

const CATEGORY_LABEL: Record<string, string> = {
  thinking: "Thinking",
  communication: "Communication",
};

/**
 * Renders coach feedback. Shows only the top 2-3 issues to avoid overload (§24).
 * The improved version only appears when the stage allowed it (already enforced
 * server-side).
 */
export function FeedbackView({
  feedback,
}: {
  feedback: VietnameseCoachFeedback;
}) {
  const topIssues = feedback.issues.slice(0, 3);

  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed">{feedback.summary}</p>

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

      {topIssues.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What to work on
          </p>
          {topIssues.map((issue, i) => (
            <div key={i} className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={issue.category === "thinking" ? "warning" : "secondary"}>
                  {CATEGORY_LABEL[issue.category] ?? issue.category}
                </Badge>
                <span className="font-medium">{issue.title}</span>
              </div>
              <p className="text-muted-foreground">{issue.detail}</p>
            </div>
          ))}
        </div>
      )}

      {feedback.reflectionQuestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Think about this
          </p>
          {feedback.reflectionQuestions.map((q, i) => (
            <div key={i} className="flex items-start gap-2">
              <HelpCircle className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{q}</span>
            </div>
          ))}
        </div>
      )}

      {feedback.suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            A direction to try
          </p>
          {feedback.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {feedback.improvedVersion && (
        <div className="rounded-lg border border-primary/30 bg-accent/40 p-3">
          <div className="mb-1.5 flex items-center gap-2 text-primary">
            <Sparkles className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              A more natural way to say it
            </span>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">
            {feedback.improvedVersion}
          </p>
        </div>
      )}
    </div>
  );
}
