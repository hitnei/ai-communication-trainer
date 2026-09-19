"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Radio, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PracticeSession } from "@/domain/practice/types";
import type { EnglishAttemptFeedback } from "@/domain/practice/english-feedback";
import type {
  EnglishAttemptView,
  SubmitEnglishResult,
} from "@/application/practice/english-practice-service";
import {
  completeEnglishAction,
  setTranscriptModeAction,
} from "@/app/practice/english/actions";
import { AudioRecorder } from "./audio-recorder";
import { EnglishFeedbackView } from "./english-feedback-view";

interface EntryView {
  attemptNumber: number;
  transcript: string | null;
  audioUrl: string | null;
  feedback: EnglishAttemptFeedback | null;
  error?: string;
}

export function EnglishPractice({
  session,
  initialAttempts,
  initialTranscriptMode,
}: {
  session: PracticeSession;
  initialAttempts: EnglishAttemptView[];
  initialTranscriptMode: "live" | "after";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [entries, setEntries] = useState<EntryView[]>(() =>
    initialAttempts.map((a) => ({
      attemptNumber: a.attemptNumber,
      transcript: a.transcript,
      audioUrl: a.audioUrl,
      feedback: a.feedback,
    })),
  );
  const [transcriptMode, setTranscriptMode] = useState(initialTranscriptMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(session.status === "completed");
  const [recorderKey, setRecorderKey] = useState(0);

  const nextAttemptNumber = entries.length + 1;

  function changeMode(mode: "live" | "after") {
    setTranscriptMode(mode);
    startTransition(() => setTranscriptModeAction(mode));
  }

  async function submit(blob: Blob, transcript: string, durationMs: number) {
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("sessionId", session.id);
      form.set("audio", blob, "answer.webm");
      form.set("durationMs", String(durationMs));
      if (transcript) form.set("clientTranscript", transcript);

      const res = await fetch("/api/practice/english/attempt", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const result = (await res.json()) as SubmitEnglishResult;

      if (result.ok) {
        setEntries((prev) => [
          ...prev,
          {
            attemptNumber: result.attemptNumber,
            transcript: result.feedback.transcript,
            audioUrl: result.audioUrl,
            feedback: result.feedback,
          },
        ]);
      } else {
        setEntries((prev) => [
          ...prev,
          {
            attemptNumber: result.attemptNumber,
            transcript: result.transcript ?? null,
            audioUrl: result.audioUrl,
            feedback: null,
            error: result.message,
          },
        ]);
        setError(result.message);
      }
      setRecorderKey((k) => k + 1); // fresh recorder for the next attempt
    } catch {
      setError(
        "Something went wrong uploading your recording. Your attempt wasn't saved - please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function satisfied() {
    startTransition(async () => {
      await completeEnglishAction(session.id);
      setCompleted(true);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          onClick={() => router.push("/practice/english")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← New practice
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">
          English Practice
        </h1>
      </div>

      {/* Sticky prompt so it stays visible while reviewing attempts. */}
      <div className="sticky top-0 z-20 -mx-6 border-b bg-background/90 px-6 py-3 backdrop-blur-sm">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Speak your answer to
        </p>
        <p className="text-sm leading-relaxed">{session.prompt}</p>
      </div>

      {/* Transcript mode preference (§21) */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Transcript:</span>
        <div className="inline-flex rounded-md border p-0.5">
          <button
            onClick={() => changeMode("live")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
              transcriptMode === "live"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Radio className="size-3.5" /> While I speak
          </button>
          <button
            onClick={() => changeMode("after")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
              transcriptMode === "after"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FileText className="size-3.5" /> After I finish
          </button>
        </div>
      </div>

      {/* Attempt history */}
      <div className="space-y-5">
        {entries.map((entry) => (
          <div key={entry.attemptNumber} className="space-y-3">
            <span className="text-sm font-medium">
              Attempt {entry.attemptNumber}
            </span>
            {entry.audioUrl && (
              <audio controls src={entry.audioUrl} className="w-full" />
            )}
            {entry.transcript && (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  {entry.transcript}
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
                      What I noticed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EnglishFeedbackView feedback={entry.feedback} />
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
                  ? "Record your answer"
                  : `Attempt ${nextAttemptNumber}`}
              </CardTitle>
              {entries.length > 0 && <Badge>Try again</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Speak naturally. You&apos;ll get your transcript and feedback, then
              you can try again.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <AudioRecorder
              key={recorderKey}
              transcriptMode={transcriptMode}
              submitting={submitting}
              onSubmit={submit}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {entries.length > 0 && (
              <Button variant="ghost" onClick={satisfied} disabled={submitting}>
                <CheckCircle2 className="size-4" /> I&apos;m satisfied
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
