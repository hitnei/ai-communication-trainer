"use client";

import { useEffect } from "react";
import { Mic, Square, Pause, Play, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useMediaRecorder } from "./use-media-recorder";
import { useSpeechRecognition } from "./use-speech-recognition";

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioRecorder({
  transcriptMode,
  submitting,
  onSubmit,
}: {
  transcriptMode: "live" | "after";
  submitting: boolean;
  onSubmit: (blob: Blob, transcript: string, durationMs: number) => void;
}) {
  const rec = useMediaRecorder();
  const speech = useSpeechRecognition();

  // Live transcript only while recording and only in "live" mode.
  useEffect(() => {
    if (rec.state === "recording" && transcriptMode === "live" && speech.supported) {
      if (!speech.listening) speech.start();
    } else if (speech.listening) {
      speech.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.state, transcriptMode]);

  if (!rec.isSupported) {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        Recording isn&apos;t supported in this browser. Try a recent Chrome, Edge,
        or Safari.
      </div>
    );
  }

  const liveText = (speech.finalText + " " + speech.interim).trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {rec.state === "idle" && (
          <Button onClick={rec.start} disabled={submitting}>
            <Mic className="size-4" /> Record
          </Button>
        )}

        {(rec.state === "recording" || rec.state === "paused") && (
          <>
            <span className="flex items-center gap-2 text-sm font-medium tabular-nums">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  rec.state === "recording"
                    ? "animate-pulse bg-destructive"
                    : "bg-muted-foreground",
                )}
              />
              {fmt(rec.durationMs)}
            </span>
            {rec.state === "recording" ? (
              <Button variant="outline" onClick={rec.pause}>
                <Pause className="size-4" /> Pause
              </Button>
            ) : (
              <Button variant="outline" onClick={rec.resume}>
                <Play className="size-4" /> Resume
              </Button>
            )}
            <Button onClick={rec.stop}>
              <Square className="size-4" /> Stop
            </Button>
          </>
        )}
      </div>

      {/* Live transcript (best-effort) */}
      {rec.state === "recording" && transcriptMode === "live" && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            Live transcript
          </p>
          {speech.supported ? (
            <p className="min-h-6 leading-relaxed">
              {liveText || <span className="text-muted-foreground">Listening…</span>}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Live transcript isn&apos;t available in this browser - you&apos;ll get
              the full transcript after you stop.
            </p>
          )}
        </div>
      )}

      {/* Playback + submit after stopping */}
      {rec.state === "stopped" && rec.audioUrl && (
        <div className="space-y-3">
          <audio controls src={rec.audioUrl} className="w-full" />

          {transcriptMode === "after" && speech.finalText && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Transcript
              </p>
              <p className="leading-relaxed">{speech.finalText}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                rec.blob &&
                onSubmit(rec.blob, speech.finalText.trim(), rec.durationMs)
              }
              disabled={submitting || !rec.blob}
            >
              {submitting ? (
                <>
                  <Spinner /> Analyzing your answer…
                </>
              ) : (
                <>
                  <Send className="size-4" /> Analyze this answer
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                speech.reset();
                rec.reset();
              }}
              disabled={submitting}
            >
              <Trash2 className="size-4" /> Delete & re-record
            </Button>
          </div>
        </div>
      )}

      {rec.error && <p className="text-sm text-destructive">{rec.error}</p>}
    </div>
  );
}
