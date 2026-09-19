"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  startIndividualInterview,
  setNextQuestion,
  completeIndividualInterview,
  abandonIndividualInterview,
} from "@/application/interview/individual-interview-service";

const startSchema = z.object({
  categories: z.array(z.string()).min(1, "Pick at least one category."),
  technologies: z.array(z.string()).default([]),
});

export async function startInterviewAction(
  input: z.input<typeof startSchema>,
): Promise<{ sessionId: string }> {
  const parsed = startSchema.parse(input);
  const { session } = await startIndividualInterview(parsed);
  revalidatePath("/interview/individual");
  revalidatePath("/");
  return { sessionId: session.id };
}

export async function setNextQuestionAction(
  sessionId: string,
  question: string,
  kind: "followup" | "retry",
): Promise<void> {
  setNextQuestion(sessionId, question, kind);
  revalidatePath("/interview/individual");
}

export async function completeInterviewAction(sessionId: string): Promise<void> {
  completeIndividualInterview(sessionId);
  revalidatePath("/interview/individual");
  revalidatePath("/");
}

export async function discardInterviewAction(sessionId: string): Promise<void> {
  abandonIndividualInterview(sessionId);
  revalidatePath("/");
}
