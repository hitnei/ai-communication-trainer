"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

/** Stable no-op subscription for static (never-changing) external snapshots. */
const emptySubscribe = () => () => {};

/** Minimal typing for the Web Speech API (not in the TS DOM lib). */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Best-effort live transcript via the browser's Web Speech API (§21 "live"
 * mode). Availability varies by browser; the authoritative transcript still
 * comes from the server after recording, so this is purely for live feedback.
 */
export function useSpeechRecognition() {
  const supported = useSyncExternalStore(
    emptySubscribe,
    () => getCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interimText = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalChunk) setFinalText((prev) => (prev + " " + finalChunk).trim());
      setInterim(interimText);
    };
    recognition.onerror = () => {};
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterim("");
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setFinalText("");
    setInterim("");
  }, []);

  return { supported, listening, finalText, interim, start, stop, reset };
}
