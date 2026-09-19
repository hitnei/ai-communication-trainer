import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { jobDescriptions, jobRequirements } from "../schema";
import type {
  JobDescription,
  JobRequirement,
  MatchStatus,
  RequirementCategory,
} from "@/domain/profile/types";
import { ids } from "@/lib/ids";

export interface JdWithRequirements {
  jd: JobDescription;
  requirements: JobRequirement[];
}

export const jdRepository = {
  create(input: {
    title: string;
    company: string;
    rawText: string;
    seniority: string;
    summary: string;
    overallStatus: MatchStatus;
    requirements: {
      text: string;
      category: RequirementCategory;
      matchStatus: MatchStatus;
      note: string;
    }[];
  }): JobDescription {
    const id = ids.jd();
    db.insert(jobDescriptions)
      .values({
        id,
        title: input.title,
        company: input.company,
        rawText: input.rawText,
        seniority: input.seniority,
        summary: input.summary,
        overallStatus: input.overallStatus,
      })
      .run();
    for (const r of input.requirements) {
      db.insert(jobRequirements)
        .values({
          id: ids.jd(),
          jobDescriptionId: id,
          text: r.text,
          category: r.category,
          matchStatus: r.matchStatus,
          note: r.note,
        })
        .run();
    }
    return this.get(id)!;
  },

  get(id: string): JobDescription | null {
    const row = db
      .select()
      .from(jobDescriptions)
      .where(eq(jobDescriptions.id, id))
      .get();
    return row ? mapJd(row) : null;
  },

  getWithRequirements(id: string): JdWithRequirements | null {
    const jd = this.get(id);
    if (!jd) return null;
    const requirements = db
      .select()
      .from(jobRequirements)
      .where(eq(jobRequirements.jobDescriptionId, id))
      .orderBy(asc(jobRequirements.createdAt))
      .all()
      .map(mapReq);
    return { jd, requirements };
  },

  list(): JobDescription[] {
    return db
      .select()
      .from(jobDescriptions)
      .orderBy(desc(jobDescriptions.createdAt))
      .all()
      .map(mapJd);
  },

  remove(id: string): void {
    db.delete(jobDescriptions).where(eq(jobDescriptions.id, id)).run();
  },
};

function mapJd(row: typeof jobDescriptions.$inferSelect): JobDescription {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    rawText: row.rawText,
    seniority: row.seniority,
    summary: row.summary,
    overallStatus: row.overallStatus as MatchStatus,
    createdAt: row.createdAt,
  };
}

function mapReq(row: typeof jobRequirements.$inferSelect): JobRequirement {
  return {
    id: row.id,
    jobDescriptionId: row.jobDescriptionId,
    text: row.text,
    category: row.category as RequirementCategory,
    matchStatus: row.matchStatus as MatchStatus,
    note: row.note,
  };
}
