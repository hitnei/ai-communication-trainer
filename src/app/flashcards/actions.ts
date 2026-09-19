"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  generateSuggestionsFromRecent,
  generateSuggestionsFromText,
  addSuggestion,
  dismissSuggestion,
  addManualCard,
  reviewCard,
  deleteCard,
  type SuggestResult,
} from "@/application/flashcard/flashcard-service";

export async function suggestFromRecentAction(): Promise<SuggestResult> {
  const r = await generateSuggestionsFromRecent();
  revalidatePath("/flashcards");
  return r;
}

export async function suggestFromTextAction(text: string): Promise<SuggestResult> {
  const r = await generateSuggestionsFromText(z.string().parse(text));
  revalidatePath("/flashcards");
  return r;
}

export async function addSuggestionAction(id: string): Promise<void> {
  addSuggestion(id);
  revalidatePath("/flashcards");
}

export async function dismissSuggestionAction(id: string): Promise<void> {
  dismissSuggestion(id);
  revalidatePath("/flashcards");
}

const manualSchema = z.object({
  phrase: z.string().min(1),
  meaning: z.string().default(""),
  example: z.string().default(""),
});

export async function addManualCardAction(
  input: z.input<typeof manualSchema>,
): Promise<void> {
  addManualCard(manualSchema.parse(input));
  revalidatePath("/flashcards");
}

export async function reviewCardAction(
  id: string,
  rating: string,
): Promise<void> {
  reviewCard(id, z.enum(["again", "hard", "good", "easy"]).parse(rating));
  revalidatePath("/flashcards");
}

export async function deleteCardAction(id: string): Promise<void> {
  deleteCard(id);
  revalidatePath("/flashcards");
}
