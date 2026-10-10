import { ENGLISH_CODES, THINKING_CODES } from "@/domain/feedback/taxonomy";
import type { EnglishCoachFeedback } from "./english-feedback";
import type { VietnameseCoachFeedback } from "./vietnamese-feedback";

/**
 * The issue `code` fully determines its `category` in the taxonomy, so the
 * category is derived here instead of trusted from the model (measured: the
 * model occasionally files "incomplete" under thinking). Progress and memory
 * aggregate by category, so a wrong label would skew them silently.
 */

const THINKING = new Set<string>(THINKING_CODES);
const ENGLISH = new Set<string>(ENGLISH_CODES);

export interface Normalized<T> {
  feedback: T;
  /** How many issues had their category corrected. */
  corrected: number;
}

export function normalizeVietnameseFeedback(
  fb: VietnameseCoachFeedback,
): Normalized<VietnameseCoachFeedback> {
  let corrected = 0;
  const issues = fb.issues.map((issue) => {
    const category = THINKING.has(issue.code) ? "thinking" : "communication";
    if (category === issue.category) return issue;
    corrected += 1;
    return { ...issue, category } as typeof issue;
  });
  return { feedback: corrected === 0 ? fb : { ...fb, issues }, corrected };
}

export function normalizeEnglishFeedback(
  fb: EnglishCoachFeedback,
): Normalized<EnglishCoachFeedback> {
  let corrected = 0;
  const issues = fb.issues.map((issue) => {
    const category = ENGLISH.has(issue.code) ? "english" : "content";
    if (category === issue.category) return issue;
    corrected += 1;
    return { ...issue, category } as typeof issue;
  });
  return { feedback: corrected === 0 ? fb : { ...fb, issues }, corrected };
}
