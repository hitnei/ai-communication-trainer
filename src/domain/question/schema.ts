import { z } from "zod";
import { DIFFICULTIES, QUESTION_TYPES } from "./types";

/** Structured output for the question generator (§64, §73). */
export const generatedQuestionSchema = z.object({
  text: z.string().min(1),
  categories: z.array(z.string()).default([]),
  difficulty: z.enum(DIFFICULTIES).default("senior"),
  questionType: z.enum(QUESTION_TYPES).default("scenario"),
});

export const generatedQuestionsBatchSchema = z.object({
  questions: z.array(generatedQuestionSchema).default([]),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
