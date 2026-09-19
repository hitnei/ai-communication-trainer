import { z } from "zod";
import { SUGGESTION_REASONS } from "./types";

/** Structured output for the flashcard suggestor (§54, §64). */
export const suggestedPhraseSchema = z.object({
  phrase: z.string().min(1),
  replacementFor: z.string().nullable().default(null),
  meaning: z.string().default(""),
  example: z.string().default(""),
  reason: z.enum(SUGGESTION_REASONS).default("useful_phrase"),
});

export const suggestedPhrasesBatchSchema = z.object({
  suggestions: z.array(suggestedPhraseSchema).default([]),
});

export type SuggestedPhrase = z.infer<typeof suggestedPhraseSchema>;
