"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

/** Stable no-op subscription for static (never-changing) external snapshots. */
const emptySubscribe = () => () => {};

/** Pick a broadly-supported recording mime type for this browser. */
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export interface UseMediaRecorder {
  state: RecorderState;
  error: string | null;
  durationMs: number;
  audioUrl: string | null;
  blob: Blob | null;
  mimeType: string;
  isSupported: boolean;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Thin wrapper over the MediaRecorder API with permission handling (§22).
 * Produces a Blob + object URL for replay; the caller uploads the Blob.
 */
export function useMediaRecorder(): UseMediaRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  const [mimeType] = useState<string>(() => pickMimeType());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Server snapshot is `true` so SSR + first client render match (avoiding a
  // hydration mismatch); after hydration it resolves to the real capability.
  const isSupported = useSyncExternalStore(
    emptySubscribe,
    () =>
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof MediaRecorder !== "undefined",
    () => true,
  );

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const reset = useCallback(() => {
    clearTimer();
    stopStream();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    recorderRef.current = null;
    chunksRef.current = [];
    accumulatedRef.current = 0;
    setState("idle");
    setError(null);
    setDurationMs(0);
    setAudioUrl(null);
    setBlob(null);
  }, [audioUrl]);

  const start = useCallback(async () => {
    if (!isSupported) {
      setError("Recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      accumulatedRef.current = 0;
      const options = mimeType
        ? { mimeType: mimeType }
        : undefined;
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = mimeType || "audio/webm";
        const finalBlob = new Blob(chunksRef.current, { type });
        setBlob(finalBlob);
        setAudioUrl(URL.createObjectURL(finalBlob));
        stopStream();
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setState("recording");
      setError(null);
      clearTimer();
      timerRef.current = setInterval(() => {
        setDurationMs(accumulatedRef.current + (Date.now() - startedAtRef.current));
      }, 200);
    } catch {
      setError(
        "I couldn't access your microphone. Check the browser permission and try again.",
      );
      setState("idle");
    }
  }, [isSupported, mimeType]);

  const pause = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state === "recording") {
      r.pause();
      accumulatedRef.current += Date.now() - startedAtRef.current;
      clearTimer();
      setState("paused");
    }
  }, []);

  const resume = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state === "paused") {
      r.resume();
      startedAtRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setDurationMs(accumulatedRef.current + (Date.now() - startedAtRef.current));
      }, 200);
      setState("recording");
    }
  }, []);

  const stop = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      if (r.state === "recording") {
        accumulatedRef.current += Date.now() - startedAtRef.current;
      }
      r.stop();
      clearTimer();
      setDurationMs(accumulatedRef.current);
      setState("stopped");
    }
  }, []);

  return {
    state,
    error,
    durationMs,
    audioUrl,
    blob,
    mimeType: mimeType || "audio/webm",
    isSupported,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
