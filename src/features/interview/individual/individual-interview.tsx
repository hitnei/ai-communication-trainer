"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  MessageCircleQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InterviewSession, TurnKind } from "@/domain/interview/types";
import { CATEGORY_LABEL } from "@/domain/interview/types";
import type { InterviewFeedback } from "@/domain/interview/interview-feedback";
import type {
  IndividualInterviewState,
  SubmitInterviewResult,
} from "@/application/interview/individual-interview-service";
import {
  completeInterviewAction,
  setNextQuestionAction,
} from "@/app/interview/individual/actions";
import { AudioRecorder } from "@/features/practice/english/audio-recorder";
import { InterviewFeedbackView } from "./interview-feedback-view";

const KIND_LABEL: Record<TurnKind, string> = {
  opening: "Opening question",
  followup: "Follow-up",
  retry: "Retry",
};

interface EntryView {
  sequence: number;
  kind: TurnKind;
  question: string;
  answer: string | null;
  audioUrl: string | null;
  feedback: InterviewFeedback | null;
  error?: string;
}

export function IndividualInterview({
  session,
  initialState,
}: {
  session: InterviewSession;
  initialState: IndividualInterviewState;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [entries, setEntries] = useState<EntryView[]>(initialState.turns);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(
    initialState.currentQuestion,
  );
  const [currentKind, setCurrentKind] = useState<TurnKind>(
    initialState.currentKind,
  );
  const [rationale, setRationale] = useState<string | null>(null);
  const lastAnswered = [...initialState.turns].reverse().find((t) => t.answer);
  const [lastAnsweredQuestion, setLastAnsweredQuestion] = useState<string | null>(
    lastAnswered?.question ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(session.status === "completed");
  const [recorderKey, setRecorderKey] = useState(0);

  async function submit(blob: Blob, transcript: string, durationMs: number) {
    if (!currentQuestion) return;
    setSubmitting(true);
    setError(null);
    const answeredQuestion = currentQuestion;
    const answeredKind = currentKind;
    try {
      const form = new FormData();
      form.set("sessionId", session.id);
      form.set("audio", blob, "answer.webm");
      form.set("durationMs", String(durationMs));
      if (transcript) form.set("clientTranscript", transcript);

      const res = await fetch("/api/interview/individual/answer", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const result = (await res.json()) as SubmitInterviewResult;

      if (result.ok) {
        setEntries((prev) => [
          ...prev,
          {
            sequence: prev.length + 1,
            kind: answeredKind,
            question: answeredQuestion,
            answer: result.transcript,
            audioUrl: result.audioUrl,
            feedback: result.feedback,
          },
        ]);
        setLastAnsweredQuestion(answeredQuestion);
        setCurrentQuestion(result.feedback.followUpQuestion);
        setCurrentKind("followup");
        setRationale(result.feedback.followUpRationale);
      } else {
        setEntries((prev) => [
          ...prev,
          {
            sequence: prev.length + 1,
            kind: answeredKind,
            question: answeredQuestion,
            answer: result.transcript ?? null,
            audioUrl: result.audioUrl,
            feedback: null,
            error: result.message,
          },
        ]);
        setError(result.message);
      }
      setRecorderKey((k) => k + 1);
    } catch {
      setError(
        "Something went wrong uploading your answer. It wasn't saved - please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function retryLast() {
    if (!lastAnsweredQuestion) return;
    setCurrentQuestion(lastAnsweredQuestion);
    setCurrentKind("retry");
    setRationale(null);
    startTransition(() =>
      setNextQuestionAction(session.id, lastAnsweredQuestion, "retry"),
    );
  }

  function finish() {
    startTransition(async () => {
      await completeInterviewAction(session.id);
      setCompleted(true);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          onClick={() => router.push("/interview/individual")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← New interview
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Individual Interview
        </h1>
        <div className="flex flex-wrap gap-1.5">
          {session.categories.map((c) => (
            <Badge key={c} variant="muted">
              {CATEGORY_LABEL[c] ?? c}
            </Badge>
          ))}
        </div>
      </div>

      {/* Answered turns */}
      <div className="space-y-5">
        {entries.map((entry) => (
          <div key={entry.sequence} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{KIND_LABEL[entry.kind]}</Badge>
            </div>
            <Card className="bg-muted/30">
              <CardContent className="pt-6 text-sm font-medium">
                {entry.question}
              </CardContent>
            </Card>
            {entry.audioUrl && (
              <audio controls src={entry.audioUrl} className="w-full" />
            )}
            {entry.answer && (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  {entry.answer}
                </CardContent>
              </Card>
            )}
            {entry.error ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{entry.error}</span>
              </div>
            ) : (
              entry.feedback && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">
                      Interviewer&apos;s read
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InterviewFeedbackView feedback={entry.feedback} />
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
              <p className="font-medium">Interview complete</p>
              <p className="text-muted-foreground">
                Good work. Review the follow-ups above - they show exactly where
                to go deeper next time.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        currentQuestion && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageCircleQuestion className="size-4 text-primary" />
                <Badge>{KIND_LABEL[currentKind]}</Badge>
              </div>
              <CardTitle className="text-base leading-relaxed">
                {currentQuestion}
              </CardTitle>
              {currentKind === "followup" && rationale && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Why I&apos;m asking:{" "}
                  </span>
                  {rationale}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <AudioRecorder
                key={recorderKey}
                transcriptMode="after"
                submitting={submitting}
                onSubmit={submit}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-wrap gap-2">
                {lastAnsweredQuestion && currentKind !== "retry" && (
                  <Button
                    variant="outline"
                    onClick={retryLast}
                    disabled={submitting}
                  >
                    <RotateCcw className="size-4" /> Retry previous question
                  </Button>
                )}
                {entries.length > 0 && (
                  <Button variant="ghost" onClick={finish} disabled={submitting}>
                    <CheckCircle2 className="size-4" /> Finish interview
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
