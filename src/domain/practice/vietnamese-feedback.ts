import { z } from "zod";
import {
  COMMUNICATION_CODES,
  THINKING_CODES,
} from "@/domain/feedback/taxonomy";

/**
 * Structured output contract for the Vietnamese Coach (§64). Every AI response
 * is validated against this — unvalidated output is never trusted.
 *
 * Vietnamese coaching separates THINKING problems from COMMUNICATION problems
 * (§19) and must NOT conflate language issues with thinking issues.
 */

export const vietnameseIssueSchema = z.object({
  category: z.enum(["thinking", "communication"]),
  code: z.enum([...THINKING_CODES, ...COMMUNICATION_CODES]),
  title: z.string().min(1),
  detail: z.string().min(1),
});

export const vietnameseCoachFeedbackSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  issues: z.array(vietnameseIssueSchema).default([]),
  /** Reflection questions — the core of attempt 1 (§18, §69). */
  reflectionQuestions: z.array(z.string()).default([]),
  /** Direction / structure hints — allowed from attempt 2 (§69). */
  suggestions: z.array(z.string()).default([]),
  /**
   * Full rewritten answer. Only permitted from attempt 3+. The application
   * layer strips this earlier regardless of what the model returns.
   */
  improvedVersion: z.string().nullable().default(null),
  nextAction: z.enum(["retry", "satisfied_or_retry"]).default("retry"),
});

export type VietnameseIssue = z.infer<typeof vietnameseIssueSchema>;
export type VietnameseCoachFeedback = z.infer<
  typeof vietnameseCoachFeedbackSchema
>;
