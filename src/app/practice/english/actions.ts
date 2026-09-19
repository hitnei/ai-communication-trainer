"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { VIETNAMESE_EXERCISE_TYPES } from "@/domain/practice/types";
import {
  startEnglishSession,
  completeEnglishSession,
  abandonEnglishSession,
} from "@/application/practice/english-practice-service";
import { profileRepository } from "@/infrastructure/db/repositories/profile-repository";

const startSchema = z.object({
  exerciseType: z.enum(VIETNAMESE_EXERCISE_TYPES).optional(),
  prompt: z.string().min(1, "Please provide a prompt to answer."),
  goal: z.string().default("Speak clearly and naturally"),
});

export async function startEnglishSessionAction(
  input: z.input<typeof startSchema>,
): Promise<{ sessionId: string }> {
  const parsed = startSchema.parse(input);
  const session = startEnglishSession(parsed);
  revalidatePath("/practice/english");
  revalidatePath("/");
  return { sessionId: session.id };
}

export async function completeEnglishAction(sessionId: string): Promise<void> {
  completeEnglishSession(sessionId);
  revalidatePath("/practice/english");
  revalidatePath("/");
}

export async function discardEnglishSessionAction(
  sessionId: string,
): Promise<void> {
  abandonEnglishSession(sessionId);
  revalidatePath("/");
}

export async function setTranscriptModeAction(
  mode: "live" | "after",
): Promise<void> {
  profileRepository.setTranscriptMode(mode);
  revalidatePath("/practice/english");
}
