import "server-only";
import { resolveAiProvider } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getAIProvider } from "@/infrastructure/ai/provider";
import { GeminiSpeechProvider } from "./gemini-speech-provider";
import { MockSpeechProvider } from "./mock-speech-provider";
import type { SpeechProvider } from "./types";

let cached: SpeechProvider | null = null;

/** Single access point for transcription. Mirrors the AI provider selection. */
export function getSpeechProvider(): SpeechProvider {
  if (cached) return cached;
  cached =
    resolveAiProvider() === "gemini"
      ? new GeminiSpeechProvider(getAIProvider())
      : new MockSpeechProvider();
  logger.info("speech_provider_selected", { provider: cached.name });
  return cached;
}
