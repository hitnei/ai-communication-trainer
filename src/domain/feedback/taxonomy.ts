/**
 * Normalized feedback taxonomy (§63). Every issue the system raises maps to one
 * of these stable codes so progress, memory, and analytics can aggregate them.
 */

export const THINKING_CODES = [
  "unclear_idea",
  "missing_point",
  "weak_logic",
  "poor_structure",
] as const;

export const COMMUNICATION_CODES = [
  "too_long",
  "repetitive",
  "main_point_late",
  "unclear",
  "incomplete",
] as const;

export const ENGLISH_CODES = [
  "grammar",
  "vocabulary",
  "unnatural_phrase",
  "fluency",
  "filler",
] as const;

export const PRONUNCIATION_CODES = [
  "word_clarity",
  "stress",
  "rhythm",
  "intelligibility",
] as const;

export const INTERVIEW_CODES = [
  "too_generic",
  "insufficient_depth",
  "weak_tradeoff",
  "weak_example",
  "unsupported_claim",
  "missing_metric",
] as const;

export const FEEDBACK_CATEGORIES = [
  "thinking",
  "communication",
  "english",
  "pronunciation",
  "interview",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const ALL_FEEDBACK_CODES = [
  ...THINKING_CODES,
  ...COMMUNICATION_CODES,
  ...ENGLISH_CODES,
  ...PRONUNCIATION_CODES,
  ...INTERVIEW_CODES,
] as const;

export type FeedbackCode = (typeof ALL_FEEDBACK_CODES)[number];

/** Skill/progress dimensions tracked per user (§49, §100). */
export const SKILL_DIMENSIONS = [
  "structure",
  "clarity",
  "conciseness",
  "completeness",
  "logic",
  "grammar",
  "vocabulary",
  "naturalness",
  "fluency",
  "filler_usage",
  "pronunciation",
  "technical_depth",
  "behavioral_depth",
] as const;

export type SkillDimension = (typeof SKILL_DIMENSIONS)[number];
