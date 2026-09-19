import type { SkillDimension } from "@/domain/feedback/taxonomy";

/**
 * Progress domain (§49, §100). Maps feedback codes to the 13 skill dimensions so
 * progress can be rolled up from the issues we already capture - evidence-based,
 * never an invented per-dimension score.
 */

export const DIMENSION_LABEL: Record<SkillDimension, string> = {
  structure: "Structure",
  clarity: "Clarity",
  conciseness: "Conciseness",
  completeness: "Completeness",
  logic: "Logic",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  naturalness: "Naturalness",
  fluency: "Fluency",
  filler_usage: "Filler usage",
  pronunciation: "Pronunciation",
  technical_depth: "Technical depth",
  behavioral_depth: "Behavioral depth",
};

/** Which dimension each feedback code reflects. */
export const CODE_TO_DIMENSION: Record<string, SkillDimension> = {
  // thinking / communication
  poor_structure: "structure",
  main_point_late: "structure",
  too_long: "conciseness",
  repetitive: "conciseness",
  unclear: "clarity",
  unclear_idea: "clarity",
  incomplete: "completeness",
  missing_point: "completeness",
  weak_logic: "logic",
  // english
  grammar: "grammar",
  vocabulary: "vocabulary",
  unnatural_phrase: "naturalness",
  fluency: "fluency",
  filler: "filler_usage",
  // pronunciation
  word_clarity: "pronunciation",
  stress: "pronunciation",
  rhythm: "pronunciation",
  intelligibility: "pronunciation",
  // interview
  insufficient_depth: "technical_depth",
  weak_tradeoff: "technical_depth",
  unsupported_claim: "technical_depth",
  missing_metric: "technical_depth",
  too_generic: "behavioral_depth",
  weak_example: "behavioral_depth",
};

/** A concrete practice suggestion per dimension, for recurring-mistake cards (§51). */
export const DIMENSION_PRACTICE: Record<SkillDimension, string> = {
  structure: "Explain a technical blocker in under 45 seconds, main point first.",
  clarity: "Explain one concept to a non-technical person in 3 sentences.",
  conciseness: "Answer a question in exactly 3 sentences - no more.",
  completeness: "Answer with problem → cause → fix, all three, briefly.",
  logic: "State a claim, then give exactly two reasons that support it.",
  grammar: "Record a 60-second answer and review it for one recurring slip.",
  vocabulary: "Swap three vague words for precise ones in a re-record.",
  naturalness: "Re-say an answer more naturally, keeping it your own voice.",
  fluency: "Answer once slowly with no fillers, then at normal pace.",
  filler_usage: "Answer a question with a hard rule: no 'basically'/'you know'.",
  pronunciation: "Listen, then re-say the 3 words that were hard to catch.",
  technical_depth: "Answer with a decision, its trade-off, and a metric.",
  behavioral_depth: "Tell a STAR story with a specific, concrete example.",
};
