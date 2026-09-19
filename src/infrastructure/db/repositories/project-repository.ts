import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { projects } from "../schema";
import type { Project, ProjectInput } from "@/domain/profile/types";
import { ids } from "@/lib/ids";

export const projectRepository = {
  create(input: ProjectInput): Project {
    const id = ids.project();
    db.insert(projects)
      .values({ id, ...serialize(input) })
      .run();
    return this.get(id)!;
  },

  get(id: string): Project | null {
    const row = db.select().from(projects).where(eq(projects.id, id)).get();
    return row ? mapProject(row) : null;
  },

  list(): Project[] {
    return db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt))
      .all()
      .map(mapProject);
  },

  update(id: string, input: ProjectInput): void {
    db.update(projects)
      .set({ ...serialize(input), updatedAt: new Date().toISOString() })
      .where(eq(projects.id, id))
      .run();
  },

  remove(id: string): void {
    db.delete(projects).where(eq(projects.id, id)).run();
  },
};

function serialize(input: ProjectInput) {
  return {
    name: input.name,
    company: input.company,
    role: input.role,
    overview: input.overview,
    techStack: JSON.stringify(input.techStack ?? []),
    responsibilities: input.responsibilities,
    challenges: input.challenges,
    solutions: input.solutions,
    architecture: input.architecture,
    performance: input.performance,
    leadership: input.leadership,
    collaboration: input.collaboration,
    conflicts: input.conflicts,
    achievements: input.achievements,
  };
}

function mapProject(row: typeof projects.$inferSelect): Project {
  let techStack: string[] = [];
  try {
    const v = JSON.parse(row.techStack);
    if (Array.isArray(v)) techStack = v;
  } catch {
    techStack = [];
  }
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    role: row.role,
    overview: row.overview,
    techStack,
    responsibilities: row.responsibilities,
    challenges: row.challenges,
    solutions: row.solutions,
    architecture: row.architecture,
    performance: row.performance,
    leadership: row.leadership,
    collaboration: row.collaboration,
    conflicts: row.conflicts,
    achievements: row.achievements,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
