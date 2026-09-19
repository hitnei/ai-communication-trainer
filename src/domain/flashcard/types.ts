/** Flashcards as a Speaking Phrase Bank (§53-§57). */

export const FLASHCARD_STATES = ["new", "learning", "review", "mature"] as const;
export type FlashcardState = (typeof FLASHCARD_STATES)[number];

export const FLASHCARD_STATE_LABEL: Record<FlashcardState, string> = {
  new: "New",
  learning: "Learning",
  review: "Review",
  mature: "Mature",
};

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface Flashcard {
  id: string;
  phrase: string;
  meaning: string;
  example: string;
  notes?: string | null;
  tags: string[];
  // Spaced-repetition state (§57).
  state: FlashcardState;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: string;
  lastReviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Why the AI proposed a phrase (§54). */
export const SUGGESTION_REASONS = [
  "useful_phrase",
  "vocab_gap",
  "awkward_phrase",
  "repeated_phrase",
  "interview_phrase",
  "natural_alternative",
] as const;

export type SuggestionReason = (typeof SUGGESTION_REASONS)[number];

export const SUGGESTION_REASON_LABEL: Record<SuggestionReason, string> = {
  useful_phrase: "Useful phrase",
  vocab_gap: "Vocabulary gap",
  awkward_phrase: "Awkward phrasing",
  repeated_phrase: "Repeated phrase",
  interview_phrase: "Interview phrase",
  natural_alternative: "More natural way",
};

export type SuggestionStatus = "pending" | "added" | "dismissed";

export interface PhraseSuggestion {
  id: string;
  phrase: string;
  /** The user's own phrasing this improves on, if any (§55). */
  replacementFor?: string | null;
  meaning: string;
  example: string;
  reason: SuggestionReason;
  source: string;
  status: SuggestionStatus;
  createdAt: string;
}
