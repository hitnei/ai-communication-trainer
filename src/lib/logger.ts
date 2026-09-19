import { env } from "./env";

type LogLevel = "debug" | "info" | "warn" | "error";
const order: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Minimal structured logger for local development observability (§92).
 * Logs operational metadata (role, prompt version, latency, success) but never
 * dumps raw personal content or audio.
 */
function emit(level: LogLevel, message: string, fields?: Record<string, unknown>) {
  if (order[level] < order[env.LOG_LEVEL]) return;
  const line = { level, message, ...fields };
  const method = level === "debug" ? "log" : level;
  console[method](JSON.stringify(line));
}

export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => emit("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => emit("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => emit("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => emit("error", m, f),
};

/** Observability record for a single AI operation (§92). */
export interface AiCallLog {
  role: string;
  promptVersion: string;
  provider: string;
  sessionId?: string;
  latencyMs: number;
  ok: boolean;
  schemaError?: string;
}

export function logAiCall(record: AiCallLog) {
  logger.info("ai_call", { ...record });
}
