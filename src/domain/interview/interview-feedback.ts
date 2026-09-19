import { z } from "zod";
import { INTERVIEW_CODES } from "@/domain/feedback/taxonomy";

/**
 * Structured contracts for interview evaluation (§34, §63, §64).
 *
 * In INDIVIDUAL practice the interviewer becomes a reviewer after each answer:
 * it grades the answer against senior-level expectations and generates an
 * adaptive follow-up derived from what the candidate actually said (§33). It
 * does NOT correct grammar (§32) - that's the coach's job elsewhere.
 */

export const interviewIssueSchema = z.object({
  code: z.enum(INTERVIEW_CODES),
  title: z.string().min(1),
  detail: z.string().min(1),
  /** Exact quote from the candidate's answer when possible. */
  evidence: z.string().nullable().default(null),
});

export const interviewFeedbackSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  issues: z.array(interviewIssueSchema).default([]),
  topFocusAreas: z.array(z.string()).default([]),
  /** The adaptive next question, built from THIS answer (§33). */
  followUpQuestion: z.string().min(1),
  /** Why this follow-up - names the gap in the answer it probes (§33, §34). */
  followUpRationale: z.string().min(1),
  /** Present only when this was a retry of the same question (§25). */
  comparison: z
    .object({ improvement: z.string(), remainingIssue: z.string() })
    .nullable()
    .default(null),
});

export const interviewQuestionSchema = z.object({
  question: z.string().min(1),
});

export type InterviewIssue = z.infer<typeof interviewIssueSchema>;
export type InterviewFeedback = z.infer<typeof interviewFeedbackSchema>;
