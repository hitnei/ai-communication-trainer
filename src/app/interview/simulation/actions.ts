"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { INTERVIEW_TYPES, DURATION_OPTIONS } from "@/domain/interview/types";
import type { InterviewReview } from "@/domain/interview/interview-feedback";
import {
  startSimulation,
  finishSimulation,
  abandonSimulation,
} from "@/application/interview/simulation-service";

const startSchema = z.object({
  categories: z.array(z.string()).min(1, "Pick at least one category."),
  interviewType: z.enum(INTERVIEW_TYPES.map((t) => t.key) as [string, ...string[]]),
  durationMinutes: z
    .number()
    .refine((n) => (DURATION_OPTIONS as readonly number[]).includes(n), {
      message: "Unsupported duration.",
    }),
});

export async function startSimulationAction(
  input: z.input<typeof startSchema>,
): Promise<{ sessionId: string }> {
  const parsed = startSchema.parse(input);
  const { session } = await startSimulation(parsed);
  revalidatePath("/interview/simulation");
  revalidatePath("/");
  return { sessionId: session.id };
}

export async function finishSimulationAction(
  sessionId: string,
): Promise<{ review: InterviewReview | null; message?: string }> {
  const result = await finishSimulation(sessionId);
  revalidatePath("/interview/simulation");
  revalidatePath("/");
  return result;
}

export async function discardSimulationAction(sessionId: string): Promise<void> {
  abandonSimulation(sessionId);
  revalidatePath("/");
}
