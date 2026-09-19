import "server-only";
import type { JobDescription } from "@/domain/profile/types";
import { analyzeJd } from "@/infrastructure/ai/roles/jd-analyzer";
import {
  jdRepository,
  type JdWithRequirements,
} from "@/infrastructure/db/repositories/jd-repository";
import { buildProfileSummary } from "./profile-service";
import { buildProjectsSummary } from "./project-service";
import {
  generateQuestionCandidates,
  addQuestions,
} from "@/application/question/question-bank-service";

/** Job description ingestion + tailoring (§44). */

export async function analyzeAndSaveJd(rawText: string): Promise<JobDescription> {
  const analysis = await analyzeJd({
    jdText: rawText,
    profileSummary: buildProfileSummary(),
    projectsSummary: buildProjectsSummary(),
  });
  return jdRepository.create({
    title: analysis.title || "Untitled role",
    company: analysis.company,
    rawText,
    seniority: analysis.seniority,
    summary: analysis.summary,
    overallStatus: analysis.overallStatus,
    requirements: analysis.requirements,
  });
}

export function listJds(): JobDescription[] {
  return jdRepository.list();
}

export function getJd(id: string): JdWithRequirements | null {
  return jdRepository.getWithRequirements(id);
}

export function deleteJd(id: string): void {
  jdRepository.remove(id);
}

/**
 * Generate a job-specific interview track (§44): questions tailored to the JD's
 * requirements and gaps, saved straight into the bank. Returns how many added.
 */
export async function generateJobTrack(
  jobDescriptionId: string,
  categories: string[] = ["react", "frontend_architecture", "behavioral"],
): Promise<{ added: number }> {
  const data = jdRepository.getWithRequirements(jobDescriptionId);
  if (!data) return { added: 0 };

  const gapsFirst = [...data.requirements].sort(
    (a, b) => rank(a.matchStatus) - rank(b.matchStatus),
  );
  const jobContext = [
    `${data.jd.title}${data.jd.company ? ` at ${data.jd.company}` : ""}.`,
    data.jd.summary,
    "Requirements (prioritise gaps):",
    ...gapsFirst.map((r) => `- [${r.matchStatus}] ${r.text}`),
  ].join("\n");

  const { candidates } = await generateQuestionCandidates({
    categories,
    count: 10,
    jobContext,
  });
  const saved = addQuestions(candidates);
  return { added: saved.length };
}

function rank(status: string): number {
  return { weak: 0, medium: 1, unknown: 2, strong: 3 }[status] ?? 2;
}
