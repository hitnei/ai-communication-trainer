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

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const activeSession = getActiveVietnameseSession();
  const activeEnglish = getActiveEnglishSession();
  const activeInterview = getActiveIndividualInterview();
  const activeSimulation = getActiveSimulation();
  const topFocus = listMemories().find((m) => m.liveStatus !== "stable");

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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">
                Explain a technical blocker in 45 seconds
              </CardTitle>
              <Badge variant="muted">≈ 8-10 min</Badge>
            </div>
            <CardDescription>
              <span className="font-medium text-foreground">Why this? </span>
              Getting to your main point early is the highest-value habit for
              interviews and standups. Start in Vietnamese to fix the thinking
              first, then move it into English later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/practice/vietnamese"
              className={buttonVariants()}
            >
              Start practice <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">
                Say a technical blocker out loud, in English
              </CardTitle>
              <Badge variant="muted">≈ 10 min</Badge>
            </div>
            <CardDescription>
              <span className="font-medium text-foreground">Why this? </span>
              Once the thinking is clear, practice it by voice. You&apos;ll get a
              transcript plus feedback on clarity, natural English, and
              pronunciation, then retry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/practice/english" className={buttonVariants({ variant: "outline" })}>
              Start speaking <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">
                Practice one interview question deeply
              </CardTitle>
              <Badge variant="muted">≈ 15 min</Badge>
            </div>
            <CardDescription>
              <span className="font-medium text-foreground">Why this? </span>
              A senior interviewer will push on why, trade-offs, and metrics. Get
              one adaptive follow-up per answer that targets exactly what you left
              out, then retry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/interview/individual"
              className={buttonVariants({ variant: "outline" })}
            >
              Start interview <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
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
