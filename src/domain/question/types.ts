/** Question bank domain (§36-§40). Reuses interview categories for tagging. */

export const QUESTION_STATUSES = [
  "suggested",
  "selected",
  "practicing",
  "weak",
  "improving",
  "mastered",
] as const;

export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  suggested: "Suggested",
  selected: "Selected",
  practicing: "Practicing",
  weak: "Weak",
  improving: "Improving",
  mastered: "Mastered",
};

/** What the question assesses (§35) - not just definitions. */
export const QUESTION_TYPES = [
  "recall",
  "understanding",
  "application",
  "scenario",
  "tradeoff",
  "decision",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ["junior", "mid", "senior", "staff"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const REMOVAL_REASONS = [
  "not_relevant",
  "too_easy",
  "already_know",
  "bad_question",
  "other",
] as const;

export type RemovalReason = (typeof REMOVAL_REASONS)[number];

export const REMOVAL_REASON_LABEL: Record<RemovalReason, string> = {
  not_relevant: "Not relevant",
  too_easy: "Too easy",
  already_know: "Already know this",
  bad_question: "Bad question",
  other: "Other",
};

export interface Question {
  id: string;
  text: string;
  categories: string[];
  technologies: string[];
  difficulty: Difficulty;
  questionType: QuestionType;
  status: QuestionStatus;
  source: string; // "ai" | "manual"
  createdAt: string;
  updatedAt: string;
}

/** A generated candidate, not yet saved (shown for review, §39). */
export interface QuestionCandidate {
  text: string;
  categories: string[];
  difficulty: Difficulty;
  questionType: QuestionType;
}
