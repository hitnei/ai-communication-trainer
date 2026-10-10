import "server-only";
import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * AI API keys are read here and must never reach the browser (Rule from
 * product spec §5, §88). If GEMINI_API_KEY is absent, the app falls back to a
 * deterministic mock AI provider so the product remains runnable end-to-end.
 */
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.6-flash"),
  // Cap "thinking" tokens per request. This model thinks unbounded by default,
  // which burns the key's token-per-minute quota and triggers 429s. A moderate
  // budget keeps reasoning quality while staying under rate limits. 0 disables.
  GEMINI_THINKING_BUDGET: z.coerce.number().int().min(0).default(512),
  AI_PROVIDER: z.enum(["gemini", "mock", "auto"]).default("auto"),
  // Request pacing for the prompt eval harness. Lower it on a free-tier key.
  EVAL_RPM: z.coerce.number().int().min(1).max(6000).default(30),
  // Hard stop for one eval run, measured from real token usage.
  EVAL_MAX_USD: z.coerce.number().positive().default(1),
  // USD per 1M tokens, used to turn measured tokens into cost. Check Google's page.
  EVAL_PRICE_INPUT_PER_M: z.coerce.number().positive().default(1.5),
  EVAL_PRICE_OUTPUT_PER_M: z.coerce.number().positive().default(9),
  DATABASE_PATH: z.string().min(1).default("./.data/app.db"),
  AUDIO_STORAGE_DIR: z.string().min(1).default("./.data/audio"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message rather than obscure runtime errors.
  console.error("Invalid environment configuration:", parsed.error.flatten());
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

/** Which AI provider will actually be used given current configuration. */
export function resolveAiProvider(): "gemini" | "mock" {
  if (env.AI_PROVIDER === "gemini") return "gemini";
  if (env.AI_PROVIDER === "mock") return "mock";
  return env.GEMINI_API_KEY ? "gemini" : "mock";
}
