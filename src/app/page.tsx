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

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const activeSession = getActiveVietnameseSession();

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
