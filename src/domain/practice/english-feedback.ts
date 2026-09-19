import { z } from "zod";
import {
  COMMUNICATION_CODES,
  ENGLISH_CODES,
  INTELLIGIBILITY_LEVELS,
  NATURALNESS_LEVELS,
  THINKING_CODES,
} from "@/domain/feedback/taxonomy";

/**
 * Structured contracts for the English voice loop (§23-§28, §64).
 *
 * Communication effectiveness and grammar carry EQUAL weight - grammar is never
 * automatically preferred over clarity (§23). Natural spoken fillers are judged
 * on the naturalness scale, not flagged as errors by default (§27).
 */

export const englishIssueSchema = z.object({
  // "content" = structure/clarity/conciseness/completeness/logic
  // "english" = grammar/vocabulary/naturalness/fluency/filler
  category: z.enum(["content", "english"]),
  code: z.enum([
    ...THINKING_CODES,
    ...COMMUNICATION_CODES,
    ...ENGLISH_CODES,
  ]),
  title: z.string().min(1),
  detail: z.string().min(1),
  /** Exact quote from the transcript when possible (§25, §50). */
  evidence: z.string().nullable().default(null),
  /** For english-category issues, where it sits on the naturalness scale. */
  naturalness: z.enum(NATURALNESS_LEVELS).nullable().default(null),
});

export const englishCoachFeedbackSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  issues: z.array(englishIssueSchema).default([]),
  /** The 2-3 highest-value things to fix this session (§24). */
  topFocusAreas: z.array(z.string()).default([]),
  /** A more natural way to say it - gated to attempt 2+ by the app (§28). */
  improvedVersion: z.string().nullable().default(null),
  /** Present only when a previous attempt exists (§25). */
  comparison: z
    .object({
      improvement: z.string(),
      remainingIssue: z.string(),
    })
    .nullable()
    .default(null),
});

export const pronunciationFeedbackSchema = z.object({
  /** False when the provider cannot reliably assess audio - do not fake it (§26). */
  assessed: z.boolean().default(true),
  intelligibility: z.enum(INTELLIGIBILITY_LEVELS).nullable().default(null),
  summary: z.string().default(""),
  flaggedWords: z
    .array(z.object({ word: z.string(), note: z.string() }))
    .default([]),
});

export type EnglishIssue = z.infer<typeof englishIssueSchema>;
export type EnglishCoachFeedback = z.infer<typeof englishCoachFeedbackSchema>;
export type PronunciationFeedback = z.infer<typeof pronunciationFeedbackSchema>;

/** Aggregate returned to the UI for one English attempt. */
export interface EnglishAttemptFeedback {
  transcript: string;
  transcriptSource: string;
  english: EnglishCoachFeedback;
  pronunciation: PronunciationFeedback | null;
}
