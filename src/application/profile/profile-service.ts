import "server-only";
import type { Profile } from "@/domain/profile/types";
import type { CvExtraction } from "@/domain/profile/schema";
import { extractCv } from "@/infrastructure/ai/roles/cv-extractor";
import { profileRepository } from "@/infrastructure/db/repositories/profile-repository";
import { projectRepository } from "@/infrastructure/db/repositories/project-repository";
import { EMPTY_PROJECT } from "@/domain/profile/types";

/** Profile + CV import (§41, §42). CV extraction is a draft the user reviews. */

export function getProfile(): Profile {
  return profileRepository.getProfile();
}

export function updateProfile(patch: Partial<Profile>): void {
  profileRepository.updateProfile(patch);
}

/** Extract structured data from a pasted CV - NOT saved (§42). */
export function extractCvForReview(cvText: string): Promise<CvExtraction> {
  return extractCv(cvText);
}

/** Persist the reviewed CV data: merge into profile, add the projects. */
export function applyCv(extraction: CvExtraction): void {
  profileRepository.updateProfile({
    currentRole: extraction.currentRole || undefined,
    yearsExperience: extraction.yearsExperience,
    primarySkills: extraction.primarySkills,
    secondarySkills: extraction.secondarySkills,
  });
  for (const p of extraction.projects) {
    if (!p.name.trim()) continue;
    projectRepository.create({
      ...EMPTY_PROJECT,
      name: p.name,
      company: p.company,
      role: p.role,
      overview: p.overview,
      techStack: p.techStack,
    });
  }
}

/** Concise profile summary for prompts (§48, §93). */
export function buildProfileSummary(): string {
  const p = getProfile();
  return [
    `Current role: ${p.currentRole || "unspecified"}`,
    `Years of experience: ${p.yearsExperience ?? "unspecified"}`,
    `Target role: ${p.targetRole}`,
    p.targetMarkets.length ? `Target markets: ${p.targetMarkets.join(", ")}` : "",
    p.primarySkills.length ? `Primary skills: ${p.primarySkills.join(", ")}` : "",
    p.secondarySkills.length
      ? `Secondary skills: ${p.secondarySkills.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
