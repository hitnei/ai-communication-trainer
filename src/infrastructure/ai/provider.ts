import "server-only";
import { env, resolveAiProvider } from "@/lib/env";
import { logger } from "@/lib/logger";
import { GeminiAIProvider } from "./gemini-provider";
import { MockAIProvider } from "./mock-provider";
import type { AIProvider } from "./types";

let cached: AIProvider | null = null;

/**
 * Single access point for the AI provider. Selects Gemini when a key is present,
 * otherwise the mock - decided here so no other module knows which is active.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const kind = resolveAiProvider();
  if (kind === "gemini" && env.GEMINI_API_KEY) {
    cached = new GeminiAIProvider(
      env.GEMINI_API_KEY,
      env.GEMINI_MODEL,
      env.GEMINI_THINKING_BUDGET,
    );
    logger.info("ai_provider_selected", { provider: "gemini", model: env.GEMINI_MODEL });
  } else {
    cached = new MockAIProvider();
    logger.info("ai_provider_selected", { provider: "mock" });
  }
  return cached;
}
