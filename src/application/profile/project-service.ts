import "server-only";
import type { Project, ProjectInput } from "@/domain/profile/types";
import { projectRepository } from "@/infrastructure/db/repositories/project-repository";

/** Project knowledge (§43), used to personalize interview questions. */

export function listProjects(): Project[] {
  return projectRepository.list();
}

export function createProject(input: ProjectInput): Project {
  return projectRepository.create(input);
}

export function updateProject(id: string, input: ProjectInput): void {
  projectRepository.update(id, input);
}

export function deleteProject(id: string): void {
  projectRepository.remove(id);
}

/** Concise projects summary for prompts - only the fields that carry signal. */
export function buildProjectsSummary(): string {
  const projects = projectRepository.list();
  if (projects.length === 0) return "(no projects on file)";
  return projects
    .slice(0, 5)
    .map((p) => {
      const parts = [
        `- ${p.name}${p.company ? ` @ ${p.company}` : ""}${p.role ? ` (${p.role})` : ""}`,
        p.overview ? `  ${p.overview}` : "",
        p.techStack.length ? `  Tech: ${p.techStack.join(", ")}` : "",
        p.challenges ? `  Challenges: ${p.challenges}` : "",
        p.achievements ? `  Achievements: ${p.achievements}` : "",
      ];
      return parts.filter(Boolean).join("\n");
    })
    .join("\n");
}
