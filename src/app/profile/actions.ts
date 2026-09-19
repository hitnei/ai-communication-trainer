"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CvExtraction } from "@/domain/profile/schema";
import type { ProjectInput } from "@/domain/profile/types";
import {
  updateProfile,
  extractCvForReview,
  applyCv,
} from "@/application/profile/profile-service";
import {
  createProject,
  updateProject,
  deleteProject,
} from "@/application/profile/project-service";
import {
  analyzeAndSaveJd,
  deleteJd,
  generateJobTrack,
} from "@/application/profile/jd-service";

const profileSchema = z.object({
  currentRole: z.string().default(""),
  yearsExperience: z.number().nullable().default(null),
  targetRole: z.string().default("Senior Frontend Engineer"),
  targetMarkets: z.array(z.string()).default([]),
  primarySkills: z.array(z.string()).default([]),
  secondarySkills: z.array(z.string()).default([]),
  englishGoal: z.string().default(""),
});

export async function updateProfileAction(
  input: z.input<typeof profileSchema>,
): Promise<void> {
  updateProfile(profileSchema.parse(input));
  revalidatePath("/profile");
}

export async function extractCvAction(text: string): Promise<
  { ok: true; extraction: CvExtraction } | { ok: false; message: string }
> {
  try {
    const extraction = await extractCvForReview(z.string().min(1).parse(text));
    return { ok: true, extraction };
  } catch {
    return { ok: false, message: "Couldn't read that CV. Please try again." };
  }
}

export async function applyCvAction(extraction: CvExtraction): Promise<void> {
  applyCv(extraction);
  revalidatePath("/profile");
}

export async function createProjectAction(input: ProjectInput): Promise<void> {
  createProject(input);
  revalidatePath("/profile");
}

export async function updateProjectAction(
  id: string,
  input: ProjectInput,
): Promise<void> {
  updateProject(id, input);
  revalidatePath("/profile");
}

export async function deleteProjectAction(id: string): Promise<void> {
  deleteProject(id);
  revalidatePath("/profile");
}

export async function analyzeJdAction(
  text: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const jd = await analyzeAndSaveJd(z.string().min(1).parse(text));
    revalidatePath("/profile");
    return { ok: true, id: jd.id };
  } catch {
    return { ok: false, message: "Couldn't analyze that job description." };
  }
}

export async function deleteJdAction(id: string): Promise<void> {
  deleteJd(id);
  revalidatePath("/profile");
}

export async function generateJobTrackAction(
  id: string,
): Promise<{ added: number }> {
  const r = await generateJobTrack(id);
  revalidatePath("/questions");
  return r;
}
