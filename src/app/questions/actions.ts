"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DIFFICULTIES,
  QUESTION_STATUSES,
  QUESTION_TYPES,
  REMOVAL_REASONS,
} from "@/domain/question/types";
import type { QuestionCandidate } from "@/domain/question/types";
import {
  generateQuestionCandidates,
  addQuestions,
  updateQuestionText,
  setQuestionStatus,
  removeQuestion,
} from "@/application/question/question-bank-service";

const generateSchema = z.object({
  categories: z.array(z.string()).min(1, "Pick at least one category."),
  difficulty: z.enum(DIFFICULTIES).optional(),
  count: z.number().int().min(1).max(20).optional(),
});

export type GenerateActionResult =
  | { ok: true; candidates: QuestionCandidate[]; duplicatesFiltered: number }
  | { ok: false; message: string };

export async function generateQuestionsAction(
  input: z.input<typeof generateSchema>,
): Promise<GenerateActionResult> {
  const parsed = generateSchema.parse(input);
  try {
    const result = await generateQuestionCandidates(parsed);
    return { ok: true, ...result };
  } catch {
    return {
      ok: false,
      message:
        "Something went wrong generating questions. Please try again in a moment.",
    };
  }
}

const candidateSchema = z.object({
  text: z.string().min(1),
  categories: z.array(z.string()),
  difficulty: z.enum(DIFFICULTIES),
  questionType: z.enum(QUESTION_TYPES),
});

export async function addQuestionsAction(
  candidates: z.input<typeof candidateSchema>[],
): Promise<void> {
  const parsed = z.array(candidateSchema).parse(candidates);
  addQuestions(parsed);
  revalidatePath("/questions");
}

export async function updateQuestionTextAction(
  id: string,
  text: string,
): Promise<void> {
  updateQuestionText(id, z.string().min(1).parse(text));
  revalidatePath("/questions");
}

export async function setQuestionStatusAction(
  id: string,
  status: string,
): Promise<void> {
  setQuestionStatus(id, z.enum(QUESTION_STATUSES).parse(status));
  revalidatePath("/questions");
}

export async function removeQuestionAction(
  id: string,
  reason: string,
  note?: string,
): Promise<void> {
  removeQuestion(id, z.enum(REMOVAL_REASONS).parse(reason), note);
  revalidatePath("/questions");
}
