"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { VIETNAMESE_EXERCISE_TYPES } from "@/domain/practice/types";
import {
  startVietnameseSession,
  submitVietnameseAttempt,
  completeVietnameseSession,
  abandonVietnameseSession,
  type SubmitAttemptResult,
} from "@/application/practice/vietnamese-coach-service";
import { practiceRepository } from "@/infrastructure/db/repositories/practice-repository";

const startSchema = z.object({
  exerciseType: z.enum(VIETNAMESE_EXERCISE_TYPES).optional(),
  prompt: z.string().min(1, "Please provide a prompt to answer."),
  goal: z.string().default("Communicate clearly and concisely"),
  questionId: z.string().optional(),
});

export async function startSessionAction(
  input: z.input<typeof startSchema>,
): Promise<{ sessionId: string }> {
  const parsed = startSchema.parse(input);
  const session = startVietnameseSession(parsed);
  revalidatePath("/practice/vietnamese");
  revalidatePath("/");
  return { sessionId: session.id };
}

const submitSchema = z.object({
  sessionId: z.string().min(1),
  answer: z.string().min(1, "Write something before submitting."),
});

export async function submitAttemptAction(
  input: z.input<typeof submitSchema>,
): Promise<SubmitAttemptResult> {
  const parsed = submitSchema.parse(input);
  const result = await submitVietnameseAttempt(parsed);
  revalidatePath("/practice/vietnamese");
  return result;
}

export async function markSatisfiedAction(sessionId: string): Promise<void> {
  completeVietnameseSession(sessionId);
  revalidatePath("/practice/vietnamese");
  revalidatePath("/");
}

export async function discardSessionAction(sessionId: string): Promise<void> {
  abandonVietnameseSession(sessionId);
  revalidatePath("/");
}

export async function deleteAttemptAction(
  attemptId: string,
): Promise<void> {
  practiceRepository.deleteAttempt(attemptId);
  revalidatePath("/practice/vietnamese");
}
