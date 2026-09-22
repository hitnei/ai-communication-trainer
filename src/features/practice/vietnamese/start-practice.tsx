"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  EXERCISE_LABELS,
  VIETNAMESE_EXERCISE_TYPES,
  type VietnameseExerciseType,
} from "@/domain/practice/types";
import { VIETNAMESE_PROMPTS } from "@/domain/practice/vietnamese-prompts";
import { startSessionAction } from "@/app/practice/vietnamese/actions";

export function StartPractice({
  seededQuestion,
}: {
  seededQuestion?: { id: string; text: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [exerciseType, setExerciseType] =
    useState<VietnameseExerciseType>("explain_problem");
  const [prompt, setPrompt] = useState(
    seededQuestion?.text ?? VIETNAMESE_PROMPTS.explain_problem[0],
  );
  const [error, setError] = useState<string | null>(null);

  function selectType(type: VietnameseExerciseType) {
    setExerciseType(type);
    setPrompt(VIETNAMESE_PROMPTS[type][0]);
  }

  function shuffle() {
    const options = VIETNAMESE_PROMPTS[exerciseType];
    const others = options.filter((p) => p !== prompt);
    setPrompt(others.length ? others[0] : options[0]);
  }

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        const { sessionId } = await startSessionAction({
          exerciseType,
          prompt,
          questionId: seededQuestion?.id,
        });
        router.push(`/practice/vietnamese?session=${sessionId}`);
      } catch {
        setError("Couldn't start the session. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Vietnamese Practice
        </h1>
        <p className="text-muted-foreground">
          Turn messy thoughts into clear, structured communication. Answer in
          Vietnamese - the coach diagnoses first, and only shows a rewrite once
          you&apos;ve worked on it yourself.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            1. Choose an exercise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {VIETNAMESE_EXERCISE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => selectType(type)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  exerciseType === type
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {EXERCISE_LABELS[type]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              2. Your prompt
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={shuffle}>
              <Shuffle className="size-4" /> Change prompt
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {seededQuestion && (
            <p className="text-xs text-muted-foreground">
              Loaded from your Question Bank. Edit it if you like.
            </p>
          )}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-20"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={start} disabled={pending || !prompt.trim()}>
            {pending ? (
              <>
                <Spinner /> Starting…
              </>
            ) : (
              <>
                Start practice <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
