import type { AIProvider } from "@/infrastructure/ai/types";
import type { SpeechProvider, TranscriptionResult } from "./types";

const TRANSCRIBE_PROMPT =
  "Transcribe the spoken audio verbatim, in the language spoken. " +
  "Keep natural spoken features (fillers, false starts) as spoken. " +
  "Return ONLY the transcript text - no quotes, no commentary, no timestamps.";

/**
 * Transcription via Gemini's audio understanding. Delegates to the shared
 * AIProvider so it reuses one client, retry/backoff, and logging.
 */
export class GeminiSpeechProvider implements SpeechProvider {
  readonly name = "gemini";
  constructor(private readonly ai: AIProvider) {}

  async transcribe(
    audio: Buffer,
    mimeType: string,
  ): Promise<TranscriptionResult> {
    const text = await this.ai.generateText(
      {
        prompt: TRANSCRIBE_PROMPT,
        attachments: [{ mimeType, data: audio.toString("base64") }],
        temperature: 0,
      },
      { role: "transcriber", promptVersion: "transcriber@1.0" },
    );
    return { text: text.trim() };
  }
}
