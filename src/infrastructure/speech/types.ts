/**
 * Speech provider abstraction (transcription + optional synthesis for
 * pronunciation "listen"). Implemented in Phase 2. Kept as an interface now so
 * the English voice loop can be plugged in without touching product logic (§6).
 */
export interface TranscriptSegment {
  text: string;
  startMs?: number;
  endMs?: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  segments?: TranscriptSegment[];
  /** 0..1 confidence if the provider reports it; undefined otherwise (§26). */
  confidence?: number;
}

export interface SpeechProvider {
  readonly name: string;
  transcribe(audio: Buffer, mimeType: string): Promise<TranscriptionResult>;
  /** Optional TTS for pronunciation "listen" (§26). May be unsupported. */
  synthesize?(text: string): Promise<{ audio: Buffer; mimeType: string }>;
}
