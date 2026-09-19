import { GLOBAL_AI_RULES } from "./global-rules";

/**
 * Prompt composition (§67). Prompts are assembled from discrete sections rather
 * than one giant string:
 *
 *   Global AI Rules + Role Rules + User Context + Relevant Memory + Task + Schema
 *
 * Only relevant context/memory should be passed in - never the whole DB (§93).
 */
export interface PromptSections {
  roleRules: string;
  userContext?: string;
  relevantMemory?: string;
  task: string;
  outputContract: string;
}

/** The system instruction: global + role rules (stable across a role's calls). */
export function buildSystemPrompt(roleRules: string): string {
  return `${GLOBAL_AI_RULES}\n\n---\n${roleRules}`;
}

/** The per-call user prompt: context + memory + task + output contract. */
export function buildUserPrompt(sections: PromptSections): string {
  const parts: string[] = [];
  if (sections.userContext) parts.push(`# User context\n${sections.userContext}`);
  if (sections.relevantMemory)
    parts.push(`# Relevant patterns from past sessions\n${sections.relevantMemory}`);
  parts.push(`# Task\n${sections.task}`);
  parts.push(`# Output\n${sections.outputContract}`);
  return parts.join("\n\n");
}
