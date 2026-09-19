import { z } from "zod";
import { MATCH_STATUSES, REQUIREMENT_CATEGORIES } from "./types";

/**
 * CV extraction (§42). The AI proposes structured data; it is NEVER authoritative
 * - the user reviews and edits before saving. Do not invent details (§43).
 */
export const cvExtractionSchema = z.object({
  currentRole: z.string().default(""),
  yearsExperience: z.number().nullable().default(null),
  primarySkills: z.array(z.string()).default([]),
  secondarySkills: z.array(z.string()).default([]),
  projects: z
    .array(
      z.object({
        name: z.string().default(""),
        company: z.string().default(""),
        role: z.string().default(""),
        overview: z.string().default(""),
        techStack: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export type CvExtraction = z.infer<typeof cvExtractionSchema>;

/** JD analysis (§44, §74). Compare against profile; never invent skills. */
export const jdAnalysisSchema = z.object({
  title: z.string().default(""),
  company: z.string().default(""),
  seniority: z.string().default(""),
  summary: z.string().default(""),
  overallStatus: z.enum(MATCH_STATUSES).default("unknown"),
  requirements: z
    .array(
      z.object({
        text: z.string().min(1),
        category: z.enum(REQUIREMENT_CATEGORIES).default("other"),
        matchStatus: z.enum(MATCH_STATUSES).default("unknown"),
        note: z.string().default(""),
      }),
    )
    .default([]),
});

export type JdAnalysis = z.infer<typeof jdAnalysisSchema>;
