import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getActiveVietnameseSession } from "@/application/practice/vietnamese-coach-service";
import { getActiveEnglishSession } from "@/application/practice/english-practice-service";
import { getActiveIndividualInterview } from "@/application/interview/individual-interview-service";
import { getActiveSimulation } from "@/application/interview/simulation-service";
import { listMemories } from "@/application/memory/memory-service";
import { MEMORY_STATUS_LABEL } from "@/domain/memory/types";
import { getRecommendations } from "@/application/recommendation/recommendation-service";

export const dynamic = "force-dynamic";

const PRIORITY_VARIANT = {
  high: "default",
  medium: "secondary",
  low: "muted",
} as const;

export default function DashboardPage() {
  const activeSession = getActiveVietnameseSession();
  const activeEnglish = getActiveEnglishSession();
  const activeInterview = getActiveIndividualInterview();
  const activeSimulation = getActiveSimulation();
  const topFocus = listMemories().find((m) => m.liveStatus !== "stable");
  const recommendations = getRecommendations();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Here&apos;s the most useful thing to practice next.
        </p>
      </header>

      {activeSession && (
        <Card className="border-primary/30 bg-accent/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <CardTitle className="text-base">
                You have an unfinished session
              </CardTitle>
            </div>
            <CardDescription className="line-clamp-2">
              {activeSession.prompt}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/practice/vietnamese?session=${activeSession.id}`}
              className={buttonVariants({ size: "sm" })}
            >
              Continue <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {activeEnglish && (
        <Card className="border-primary/30 bg-accent/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <CardTitle className="text-base">
                Unfinished English session
              </CardTitle>
            </div>
            <CardDescription className="line-clamp-2">
              {activeEnglish.prompt}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/practice/english?session=${activeEnglish.id}`}
              className={buttonVariants({ size: "sm" })}
            >
              Continue <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {activeInterview && (
        <Card className="border-primary/30 bg-accent/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <CardTitle className="text-base">
                Unfinished interview
              </CardTitle>
            </div>
            <CardDescription className="line-clamp-2">
              {activeInterview.pendingQuestion ?? "Continue where you left off."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/interview/individual?session=${activeInterview.id}`}
              className={buttonVariants({ size: "sm" })}
            >
              Continue <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {activeSimulation && (
        <Card className="border-primary/30 bg-accent/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <CardTitle className="text-base">Interview in progress</CardTitle>
            </div>
            <CardDescription className="line-clamp-2">
              {activeSimulation.pendingQuestion ??
                "Your timed simulation is still open."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/interview/simulation?session=${activeSimulation.id}`}
              className={buttonVariants({ size: "sm" })}
            >
              Resume <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {topFocus && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Your focus right now
          </h2>
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-base">
                  {topFocus.description}
                </CardTitle>
                <Badge variant="muted">
                  {MEMORY_STATUS_LABEL[topFocus.liveStatus]}
                </Badge>
              </div>
              <CardDescription>
                Seen across {topFocus.occurrenceCount} session
                {topFocus.occurrenceCount === 1 ? "" : "s"}. Your coaching now
                keeps this in mind.{" "}
                <Link href="/memory" className="underline underline-offset-4">
                  See why
                </Link>
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recommended practice
        </h2>
        {recommendations.map((rec, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-base">{rec.title}</CardTitle>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={PRIORITY_VARIANT[rec.priority]}>
                    {rec.priority}
                  </Badge>
                  <Badge variant="muted">≈ {rec.estimatedMinutes} min</Badge>
                </div>
              </div>
              <CardDescription>
                <span className="font-medium text-foreground">Why this? </span>
                {rec.why}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={rec.href}
                className={buttonVariants({
                  variant: i === 0 ? "default" : "outline",
                })}
              >
                Start <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          The training loop
        </h2>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You answer → the coach diagnoses the real problem → you retry → it
            compares your attempts → meaningful patterns are remembered → future
            practice adapts. This is a trainer, not a chatbot.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
