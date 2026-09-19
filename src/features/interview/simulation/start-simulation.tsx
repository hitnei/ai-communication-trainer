"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  INTERVIEW_CATEGORIES,
  INTERVIEW_TYPES,
  DURATION_OPTIONS,
  type InterviewType,
} from "@/domain/interview/types";
import { startSimulationAction } from "@/app/interview/simulation/actions";

export function StartSimulation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [interviewType, setInterviewType] = useState<InterviewType>("mixed");
  const [categories, setCategories] = useState<string[]>(["react", "behavioral"]);
  const [duration, setDuration] = useState<number>(20);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function start() {
    if (categories.length === 0) {
      setError("Pick at least one category.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const { sessionId } = await startSimulationAction({
          categories,
          interviewType,
          durationMinutes: duration,
        });
        router.push(`/interview/simulation?session=${sessionId}`);
      } catch {
        setError("Couldn't start the simulation. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Full Interview Simulation
        </h1>
        <p className="text-muted-foreground">
          A timed mock interview. The interviewer stays in role the whole time -
          no feedback until the end, then you get a full review.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            1. Interview type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {INTERVIEW_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setInterviewType(t.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  interviewType === t.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            2. Focus areas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {INTERVIEW_CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => toggle(c.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  categories.includes(c.key)
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            3. Duration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  duration === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {d} min
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={start} disabled={pending || categories.length === 0}>
            {pending ? (
              <>
                <Spinner /> Setting up your interview…
              </>
            ) : (
              <>
                Begin interview <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
