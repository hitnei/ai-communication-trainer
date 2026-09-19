/** Profile, projects, and job descriptions (§41-§44). */

export interface Profile {
  currentRole: string;
  yearsExperience: number | null;
  targetRole: string;
  targetMarkets: string[];
  primarySkills: string[];
  secondarySkills: string[];
  englishGoal: string;
}

export const EMPTY_PROFILE: Profile = {
  currentRole: "",
  yearsExperience: null,
  targetRole: "Senior Frontend Engineer",
  targetMarkets: [],
  primarySkills: [],
  secondarySkills: [],
  englishGoal: "",
};

/** Project knowledge (§43). Used to personalize questions; never invented. */
export interface Project {
  id: string;
  name: string;
  company: string;
  role: string;
  overview: string;
  techStack: string[];
  responsibilities: string;
  challenges: string;
  solutions: string;
  architecture: string;
  performance: string;
  leadership: string;
  collaboration: string;
  conflicts: string;
  achievements: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectInput = Omit<Project, "id" | "createdAt" | "updatedAt">;

export const EMPTY_PROJECT: ProjectInput = {
  name: "",
  company: "",
  role: "",
  overview: "",
  techStack: [],
  responsibilities: "",
  challenges: "",
  solutions: "",
  architecture: "",
  performance: "",
  leadership: "",
  collaboration: "",
  conflicts: "",
  achievements: "",
};

/** Non-judgmental match scale (§44). */
export const MATCH_STATUSES = ["strong", "medium", "weak", "unknown"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  strong: "Strong",
  medium: "Partial",
  weak: "Gap",
  unknown: "Unclear",
};

export const REQUIREMENT_CATEGORIES = [
  "technical",
  "responsibility",
  "behavioral",
  "architecture",
  "other",
] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export interface JobRequirement {
  id: string;
  jobDescriptionId: string;
  text: string;
  category: RequirementCategory;
  matchStatus: MatchStatus;
  note: string;
}

export interface JobDescription {
  id: string;
  title: string;
  company: string;
  rawText: string;
  seniority: string;
  summary: string;
  overallStatus: MatchStatus;
  createdAt: string;
}
