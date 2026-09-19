"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  AlertTriangle,
  MessageCircleQuestion,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { InterviewSession } from "@/domain/interview/types";
import { CATEGORY_LABEL, INTERVIEW_TYPE_LABEL } from "@/domain/interview/types";
import type { InterviewReview } from "@/domain/interview/interview-feedback";
import type {
  SimulationState,
  SubmitSimulationResult,
} from "@/application/interview/simulation-service";
import { finishSimulationAction } from "@/app/interview/simulation/actions";
import { AudioRecorder } from "@/features/practice/english/audio-recorder";
import { InterviewReviewView } from "./interview-review-view";

interface ExchangeView {
  question: string;
  answer: string;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SimulationInterview({
  session,
  initialState,
}: {
  session: InterviewSession;
  initialState: SimulationState;
}) {
  const router = useRouter();

  const alreadyDone =
    session.status === "completed" || initialState.review !== null;

  const [phase, setPhase] = useState<"interviewing" | "reviewing" | "done">(
    alreadyDone ? "done" : "interviewing",
  );
  const [exchanges, setExchanges] = useState<ExchangeView[]>(
    initialState.exchanges
      .filter((e) => e.answer)
      .map((e) => ({ question: e.question, answer: e.answer as string })),
  );
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(
    initialState.currentQuestion,
  );
  const [answeredCount, setAnsweredCount] = useState(initialState.answeredCount);
  const [review, setReview] = useState<InterviewReview | null>(
    initialState.review,
  );
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);

  const targetCount = initialState.targetCount;

  // Countdown based on the session start time + duration.
  const endMs =
    new Date(session.startedAt).getTime() +
    (session.durationMinutes ?? 20) * 60_000;
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((endMs - Date.now()) / 1000)),
  );

  const finish = useCallback(async () => {
    setPhase("reviewing");
    try {
      const result = await finishSimulationAction(session.id);
      setReview(result.review);
      setReviewMessage(result.message ?? null);
    } catch {
      setReviewMessage(
        "The interview is saved, but the review couldn't be generated. Your transcript is above.",
      );
    } finally {
      setPhase("done");
    }
  }, [session.id]);

  // Timer tick; auto-finish when time runs out.
  const finishedRef = useRef(false);
  useEffect(() => {
    if (phase !== "interviewing") return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endMs - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !finishedRef.current && !submitting) {
        finishedRef.current = true;
        void finish();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, endMs, submitting, finish]);

  async function submit(blob: Blob, transcript: string, durationMs: number) {
    if (!currentQuestion) return;
    setSubmitting(true);
    setError(null);
    const answered = currentQuestion;
    try {
      const form = new FormData();
      form.set("sessionId", session.id);
      form.set("audio", blob, "answer.webm");
      form.set("durationMs", String(durationMs));
      if (transcript) form.set("clientTranscript", transcript);

      const res = await fetch("/api/interview/simulation/answer", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const result = (await res.json()) as SubmitSimulationResult;

      if (result.ok) {
        setExchanges((prev) => [...prev, { question: answered, answer: transcript }]);
        setAnsweredCount(result.answeredCount);
        setRecorderKey((k) => k + 1);
        if (result.done || !result.nextQuestion) {
          setCurrentQuestion(null);
          finishedRef.current = true;
          await finish();
        } else {
          setCurrentQuestion(result.nextQuestion);
        }
      } else {
        setError(result.message);
        setRecorderKey((k) => k + 1);
      }
    } catch {
      setError(
        "Something went wrong uploading your answer. It wasn't saved - please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const lowTime = secondsLeft <= 30;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <button
            onClick={() => router.push("/interview/simulation")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← New simulation
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {INTERVIEW_TYPE_LABEL[session.interviewType ?? "mixed"]} Simulation
          </h1>
          <div className="flex flex-wrap gap-1.5">
            {session.categories.map((c) => (
              <Badge key={c} variant="muted">
                {CATEGORY_LABEL[c] ?? c}
              </Badge>
            ))}
          </div>
        </div>
        {phase === "interviewing" && (
          <div
            className={
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium tabular-nums " +
              (lowTime ? "border-destructive/40 text-destructive" : "")
            }
          >
            <Clock className="size-4" />
            {fmt(secondsLeft)}
          </div>
        )}
      </div>

      {phase !== "done" && (
        <p className="text-sm text-muted-foreground">
          Question {Math.min(answeredCount + 1, targetCount)} of ~{targetCount}.
          You won&apos;t get feedback until the interview ends - just answer as you
          would in a real interview.
        </p>
      )}

      {/* Answered questions (no feedback during the interview, §32) */}
      {exchanges.length > 0 && (
        <div className="space-y-4">
          {exchanges.map((e, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Q{i + 1}</Badge>
                <span className="text-sm font-medium">{e.question}</span>
              </div>
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  {e.answer}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {phase === "interviewing" && currentQuestion && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="size-4 text-primary" />
              <Badge>Q{answeredCount + 1}</Badge>
            </div>
            <CardTitle className="text-base leading-relaxed">
              {currentQuestion}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AudioRecorder
              key={recorderKey}
              transcriptMode="after"
              submitting={submitting}
              onSubmit={submit}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              variant="ghost"
              onClick={() => {
                finishedRef.current = true;
                void finish();
              }}
              disabled={submitting}
            >
              <Flag className="size-4" /> End & get review
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "reviewing" && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
            <Spinner /> Putting together your interview review…
          </CardContent>
        </Card>
      )}

      {phase === "done" && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Interview review</CardTitle>
          </CardHeader>
          <CardContent>
            {review ? (
              <InterviewReviewView review={review} />
            ) : (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                <span>
                  {reviewMessage ??
                    "No review is available for this session."}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
