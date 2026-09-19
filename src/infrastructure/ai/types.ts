import type { ZodType } from "zod";

/** Metadata attached to every AI call for observability and prompt versioning. */
export interface AICallMeta {
  role: string;
  promptVersion: string;
  sessionId?: string;
}

/** Binary media (e.g. audio) sent alongside a prompt for multimodal models. */
export interface MediaAttachment {
  mimeType: string;
  /** Base64-encoded bytes. */
  data: string;
}

export interface GenerateTextParams {
  system?: string;
  prompt: string;
  attachments?: MediaAttachment[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateStructuredParams<T> {
  system?: string;
  prompt: string;
  attachments?: MediaAttachment[];
  /** Zod schema - the single source of truth for AI output shape (§64). */
  schema: ZodType<T>;
  /** Human-readable name used in repair prompts. */
  schemaName?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * The one interface the domain/application layers depend on. Adding a new AI
 * vendor means implementing this - no product logic changes (§6).
 */
export interface AIProvider {
  readonly name: string;
  generateText(params: GenerateTextParams, meta: AICallMeta): Promise<string>;
  generateStructured<T>(
    params: GenerateStructuredParams<T>,
    meta: AICallMeta,
  ): Promise<T>;
}
