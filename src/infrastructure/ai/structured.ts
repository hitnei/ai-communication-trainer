import type { ZodType } from "zod";
import { AIStructuredError } from "./errors";

/**
 * Extract a JSON object/array from a model response. Models sometimes wrap JSON
 * in prose or ```json fences even when asked not to, so we defensively strip it.
 */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const firstBrace = trimmed.search(/[[{]/);
  if (firstBrace === -1) return trimmed;
  const lastBrace = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (lastBrace <= firstBrace) return trimmed;
  return trimmed.slice(firstBrace, lastBrace + 1);
}

export interface RunStructuredOptions<T> {
  schema: ZodType<T>;
  schemaName: string;
  /** Produce a raw text completion for a given prompt. */
  generate: (prompt: string) => Promise<string>;
  basePrompt: string;
}

/**
 * Structured-output loop with the failure handling required by §65:
 *   attempt 1: normal generation
 *   attempt 2: retry
 *   attempt 3: schema-repair prompt (feed back the error)
 *   still invalid: throw AIStructuredError so the caller can save user work.
 *
 * Provider-agnostic: any AIProvider delegates here by supplying `generate`.
 */
export async function runStructured<T>(opts: RunStructuredOptions<T>): Promise<T> {
  const { schema, schemaName, generate, basePrompt } = opts;
  let lastRaw = "";
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    const prompt =
      attempt < 3
        ? basePrompt
        : `${basePrompt}\n\nYour previous response was not valid ${schemaName} JSON. ` +
          `The error was: ${lastError}\nPrevious response:\n${lastRaw}\n\n` +
          `Return ONLY corrected JSON that matches the required schema. No prose, no code fences.`;

    lastRaw = await generate(prompt);
    const candidate = extractJson(lastRaw);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(candidate);
    } catch (e) {
      lastError = `Not parseable JSON: ${(e as Error).message}`;
      continue;
    }

    const result = schema.safeParse(parsedJson);
    if (result.success) return result.data;
    lastError = JSON.stringify(result.error.issues.slice(0, 6));
  }

  throw new AIStructuredError(
    `Failed to obtain valid ${schemaName} after 3 attempts`,
    lastRaw,
    lastError,
  );
}
