"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { coachingPolicyForAttempt } from "@/domain/practice/coaching-stage";
import type { PracticeSession } from "@/domain/practice/types";
import type { CoachingPolicy } from "@/domain/practice/coaching-stage";
import type { VietnameseCoachFeedback } from "@/domain/practice/vietnamese-feedback";
import type { AttemptWithFeedback } from "@/infrastructure/db/repositories/practice-repository";
import {
  submitAttemptAction,
  markSatisfiedAction,
} from "@/app/practice/vietnamese/actions";
import { FeedbackView } from "./feedback-view";

interface LoopEntry {
  attemptNumber: number;
  answer: string;
  stageLabel: string;
  feedback: VietnameseCoachFeedback | null;
  failed?: boolean;
}

const STAGE_HELP: Record<CoachingPolicy["stage"], string> = {
  diagnose:
    "First attempt — the coach will point out the real problem and ask you questions, but won't rewrite it for you yet.",
  guide:
    "Second attempt — you'll get direction and structure hints, still no full rewrite.",
  improve:
    "You've put in the work — the coach may now show a more natural version, keeping your voice.",
};

export function VietnamesePractice({
  session,
  initialAttempts,
}: {
  session: PracticeSession;
  initialAttempts: AttemptWithFeedback[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [entries, setEntries] = useState<LoopEntry[]>(() =>
    initialAttempts.map((a) => ({
      attemptNumber: a.attempt.attemptNumber,
      answer: a.attempt.textAnswer ?? "",
      stageLabel: a.feedback?.stage ?? "",
      feedback: a.feedback?.feedback ?? null,
    })),
  );
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(session.status === "completed");

  const nextAttemptNumber = entries.length + 1;
  const policy = useMemo(
    () => coachingPolicyForAttempt(nextAttemptNumber),
    [nextAttemptNumber],
  );

  function submit() {
    if (!answer.trim()) return;
    setError(null);
    const submitted = answer;
    startTransition(async () => {
      const result = await submitAttemptAction({
        sessionId: session.id,
        answer: submitted,
      });
      if (result.ok) {
        setEntries((prev) => [
          ...prev,
          {
            attemptNumber: result.attemptNumber,
            answer: submitted,
            stageLabel: result.policy.label,
            feedback: result.feedback,
          },
        ]);
        setAnswer("");
      } else {
        // Work is saved server-side; surface a graceful message (§77).
        setEntries((prev) => [
          ...prev,
          {
            attemptNumber: result.attemptNumber,
            answer: submitted,
            stageLabel: "",
            feedback: null,
            failed: true,
          },
        ]);
        setError(result.message);
        setAnswer("");
      }
    });
  }

  function satisfied() {
    startTransition(async () => {
      await markSatisfiedAction(session.id);
      setCompleted(true);
    });
  }

  function focusInput() {
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <button
          onClick={() => router.push("/practice/vietnamese")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← New practice
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Vietnamese Practice
        </h1>
        <Card className="bg-muted/30">
          <CardContent className="pt-6 text-sm leading-relaxed">
            {session.prompt}
          </CardContent>
        </Card>
      </header>

      {/* Attempt history + feedback */}
      <div className="space-y-5">
        {entries.map((entry) => (
          <div key={entry.attemptNumber} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Attempt {entry.attemptNumber}
              </span>
              {entry.stageLabel && (
                <Badge variant="muted">{entry.stageLabel}</Badge>
              )}
            </div>
            <Card>
              <CardContent className="whitespace-pre-wrap pt-6 text-sm text-muted-foreground">
                {entry.answer}
              </CardContent>
            </Card>
            {entry.failed ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Something went wrong while analyzing this answer. Your work was
                  saved — you can try submitting again.
                </span>
              </div>
            ) : (
              entry.feedback && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">
                      What I noticed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FeedbackView feedback={entry.feedback} />
                  </CardContent>
                </Card>
              )
            )}
          </div>
        ))}
      </div>

      {completed ? (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex items-center gap-3 pt-6 text-sm">
            <CheckCircle2 className="size-5 text-success" />
            <div>
              <p className="font-medium">Session complete</p>
              <p className="text-muted-foreground">
                Nice work. You decided when this was good enough.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">
                {entries.length === 0
                  ? "Your answer"
                  : `Attempt ${nextAttemptNumber}`}
              </CardTitle>
              <Badge>{policy.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {STAGE_HELP[policy.stage]}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Viết câu trả lời của bạn bằng tiếng Việt…"
              className="min-h-32"
              disabled={pending}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={submit} disabled={pending || !answer.trim()}>
                {pending ? (
                  <>
                    <Spinner /> Thinking about your answer…
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    {entries.length === 0 ? "Submit" : "Try again"}
                  </>
                )}
              </Button>
              {entries.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={focusInput}
                    disabled={pending}
                  >
                    <RotateCcw className="size-4" /> Keep improving
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={satisfied}
                    disabled={pending}
                  >
                    <CheckCircle2 className="size-4" /> I&apos;m satisfied
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
