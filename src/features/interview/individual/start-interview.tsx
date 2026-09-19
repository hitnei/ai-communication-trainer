"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { INTERVIEW_CATEGORIES } from "@/domain/interview/types";
import { startInterviewAction } from "@/app/interview/individual/actions";

export function StartInterview() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(["react"]);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function start() {
    if (selected.length === 0) {
      setError("Pick at least one category.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const { sessionId } = await startInterviewAction({
          categories: selected,
          technologies: [],
        });
        router.push(`/interview/individual?session=${sessionId}`);
      } catch {
        setError("Couldn't start the interview. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Individual Interview
        </h1>
        <p className="text-muted-foreground">
          Master one question at a time. You answer by voice, get senior-level
          feedback, and the interviewer asks a follow-up based on what you
          actually said - then you can retry.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Choose categories (you can combine)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {INTERVIEW_CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => toggle(c.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  selected.includes(c.key)
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={start} disabled={pending || selected.length === 0}>
            {pending ? (
              <>
                <Spinner /> Preparing your first question…
              </>
            ) : (
              <>
                Start interview <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
