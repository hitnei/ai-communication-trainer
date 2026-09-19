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
  AI_PROVIDER: z.enum(["gemini", "mock", "auto"]).default("auto"),
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
