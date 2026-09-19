import type { SpeechProvider, TranscriptionResult } from "./types";

/**
 * Offline transcription stub. Returns a fixed, believable English answer so the
 * whole English voice loop is runnable/testable without a live speech vendor.
 */
export class MockSpeechProvider implements SpeechProvider {
  readonly name = "mock";

  async transcribe(): Promise<TranscriptionResult> {
    return {
      text:
        "So the main issue is that our list screen loads slowly, and basically " +
        "it's because we're making a lot of API calls one after another, you know, " +
        "and I think we can batch them into a single request to make it faster.",
      language: "en",
    };
  }
}
