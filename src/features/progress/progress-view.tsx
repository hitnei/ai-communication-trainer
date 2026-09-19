import { TrendingUp, TrendingDown, Minus, Ruler, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ProgressOverview,
  Trend,
} from "@/application/progress/progress-service";

const TREND: Record<
  Trend,
  { label: string; variant: "success" | "warning" | "muted"; icon: typeof Minus }
> = {
  improving: { label: "Improving", variant: "success", icon: TrendingUp },
  regressing: { label: "Slipping", variant: "warning", icon: TrendingDown },
  steady: { label: "Steady", variant: "muted", icon: Minus },
  no_data: { label: "—", variant: "muted", icon: Minus },
};

export function ProgressView({ data }: { data: ProgressOverview }) {
  if (data.totalSessions === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          No progress yet. Finish a few practice or interview sessions and your
          Communication Profile will build here - always backed by evidence, never
          a single score.
        </CardContent>
      </Card>
    );
  }

  const withData = data.dimensions.filter((d) => d.hasData);
  const clean = data.dimensions.filter((d) => !d.hasData);

  return (
    <div className="space-y-8">
      {/* Measurable metric (§50) */}
      {data.lengthTrend.hasData && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Ruler className="size-4 text-primary" />
              <CardTitle className="text-base">Answer length</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            Your answers are getting{" "}
            <span className="font-medium">{data.lengthTrend.direction}</span>:{" "}
            earlier averaged{" "}
            <span className="font-medium">
              {data.lengthTrend.earlierAvgWords} words
            </span>
            , recently{" "}
            <span className="font-medium">
              {data.lengthTrend.recentAvgWords} words
            </span>
            .
          </CardContent>
        </Card>
      )}

      {/* Communication profile - dimensions with observed issues */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Communication profile
        </h2>
        {withData.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No issues flagged across your sessions yet. Keep going.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {withData.map((d) => {
              const t = TREND[d.trend];
              const Icon = t.icon;
              return (
                <Card key={d.dimension}>
                  <CardContent className="space-y-1.5 pt-6">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{d.label}</span>
                      <Badge variant={t.variant}>
                        <Icon className="mr-1 size-3" />
                        {t.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.evidence}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {clean.length > 0 && (
          <p className="text-xs text-muted-foreground">
            No issues flagged yet:{" "}
            {clean.map((d) => d.label).join(", ")}.
          </p>
        )}
      </section>

      {/* Recurring mistakes with real examples (§51) */}
      {data.recurringMistakes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Recurring mistakes
          </h2>
          <div className="space-y-3">
            {data.recurringMistakes.map((m, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 pt-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{m.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="muted">{m.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        seen {m.occurrences}×
                      </span>
                    </div>
                  </div>
                  {m.examples.length > 0 && (
                    <ul className="space-y-1 border-l pl-3">
                      {m.examples.map((ex, j) => (
                        <li key={j} className="text-xs italic text-muted-foreground">
                          &ldquo;{ex}&rdquo;
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="flex items-start gap-1.5 text-sm">
                    <Repeat className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span>
                      <span className="font-medium">Try: </span>
                      {m.suggestedPractice}
                    </span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
