import { GoogleGenAI } from "@google/genai";
import { logAiCall } from "@/lib/logger";
import { AIProviderError, AIStructuredError } from "./errors";
import { runStructured } from "./structured";
import type {
  AICallMeta,
  AIProvider,
  GenerateStructuredParams,
  GenerateTextParams,
  MediaAttachment,
} from "./types";

/** Build Gemini `contents` from a text prompt plus optional media parts. */
function buildContents(prompt: string, attachments?: MediaAttachment[]) {
  if (!attachments || attachments.length === 0) return prompt;
  return [
    { text: prompt },
    ...attachments.map((a) => ({
      inlineData: { mimeType: a.mimeType, data: a.data },
    })),
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Transient, worth-retrying errors: overload (503), rate limit (429), 500. */
function isTransient(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (/UNAVAILABLE|RESOURCE_EXHAUSTED|overload|high demand|try again later/i.test(msg))
    return true;
  const code = msg.match(/"code"\s*:\s*(\d+)/);
  if (code && [429, 500, 503].includes(Number(code[1]))) return true;
  const status = (e as { status?: number }).status;
  return typeof status === "number" && [429, 500, 503].includes(status);
}

/** Retry a call on transient errors with exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let delay = 800;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isTransient(e)) throw e;
      await sleep(delay);
      delay *= 2;
    }
  }
}

/**
 * Gemini implementation of AIProvider. This is the only file that imports the
 * Gemini SDK - the rest of the app depends solely on the AIProvider interface.
 */
export class GeminiAIProvider implements AIProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateText(
    params: GenerateTextParams,
    meta: AICallMeta,
  ): Promise<string> {
    const started = performance.now();
    try {
      const res = await withRetry(() =>
        this.client.models.generateContent({
          model: this.model,
          contents: buildContents(params.prompt, params.attachments),
          config: {
            systemInstruction: params.system,
            temperature: params.temperature ?? 0.7,
            maxOutputTokens: params.maxOutputTokens,
          },
        }),
      );
      logAiCall({
        role: meta.role,
        promptVersion: meta.promptVersion,
        provider: this.name,
        sessionId: meta.sessionId,
        latencyMs: Math.round(performance.now() - started),
        ok: true,
      });
      return res.text ?? "";
    } catch (e) {
      logAiCall({
        role: meta.role,
        promptVersion: meta.promptVersion,
        provider: this.name,
        sessionId: meta.sessionId,
        latencyMs: Math.round(performance.now() - started),
        ok: false,
      });
      throw new AIProviderError("Gemini request failed", e);
    }
  }

  async generateStructured<T>(
    params: GenerateStructuredParams<T>,
    meta: AICallMeta,
  ): Promise<T> {
    const started = performance.now();
    const schemaName = params.schemaName ?? "response";
    try {
      const result = await runStructured<T>({
        schema: params.schema,
        schemaName,
        basePrompt: params.prompt,
        generate: async (prompt) => {
          const res = await withRetry(() =>
            this.client.models.generateContent({
              model: this.model,
              contents: buildContents(prompt, params.attachments),
              config: {
                systemInstruction: params.system,
                temperature: params.temperature ?? 0.4,
                maxOutputTokens: params.maxOutputTokens,
                responseMimeType: "application/json",
              },
            }),
          );
          return res.text ?? "";
        },
      });
      logAiCall({
        role: meta.role,
        promptVersion: meta.promptVersion,
        provider: this.name,
        sessionId: meta.sessionId,
        latencyMs: Math.round(performance.now() - started),
        ok: true,
      });
      return result;
    } catch (e) {
      logAiCall({
        role: meta.role,
        promptVersion: meta.promptVersion,
        provider: this.name,
        sessionId: meta.sessionId,
        latencyMs: Math.round(performance.now() - started),
        ok: false,
        schemaError: e instanceof Error ? e.message : String(e),
      });
      // AIStructuredError already means "valid schema never produced"; anything
      // else (network, 404 model, quota) is wrapped so callers can degrade
      // gracefully and preserve the user's work (§65, §77).
      if (e instanceof AIStructuredError) throw e;
      throw new AIProviderError("Gemini structured request failed", e);
    }
  }
}
