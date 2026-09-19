/** Interview domain entities (§61, §62). */

export type InterviewMode = "individual" | "simulation";
export type InterviewStatus = "active" | "completed" | "abandoned";

/**
 * Interview categories the user can combine (§35, §37). Technical categories are
 * weighted toward Senior Frontend (React first); behavioral covers experience
 * and leadership.
 */
export const INTERVIEW_CATEGORIES = [
  { key: "react", label: "React", kind: "technical" },
  { key: "javascript", label: "JavaScript", kind: "technical" },
  { key: "typescript", label: "TypeScript", kind: "technical" },
  { key: "nextjs", label: "Next.js", kind: "technical" },
  { key: "nodejs", label: "Node.js", kind: "technical" },
  { key: "frontend_architecture", label: "Frontend Architecture", kind: "technical" },
  { key: "performance", label: "Performance", kind: "technical" },
  { key: "state_management", label: "State Management", kind: "technical" },
  { key: "system_design", label: "System Design", kind: "technical" },
  { key: "behavioral", label: "Behavioral", kind: "behavioral" },
  { key: "leadership", label: "Leadership", kind: "behavioral" },
] as const;

export type InterviewCategoryKey = (typeof INTERVIEW_CATEGORIES)[number]["key"];

/** Full-simulation interview types (§31). */
export const INTERVIEW_TYPES = [
  { key: "recruiter", label: "Recruiter screen" },
  { key: "behavioral", label: "Behavioral" },
  { key: "technical", label: "Technical" },
  { key: "system_design", label: "System design" },
  { key: "mixed", label: "Mixed" },
] as const;

export type InterviewType = (typeof INTERVIEW_TYPES)[number]["key"];

export const INTERVIEW_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  INTERVIEW_TYPES.map((t) => [t.key, t.label]),
);

/** Supported durations in minutes (§31). */
export const DURATION_OPTIONS = [10, 20, 30, 45] as const;

/** How many questions to aim for in a simulation of the given length. */
export function questionsTargetForDuration(minutes: number): number {
  const map: Record<number, number> = { 10: 4, 20: 6, 30: 8, 45: 10 };
  return map[minutes] ?? Math.max(3, Math.round(minutes / 4));
}

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  INTERVIEW_CATEGORIES.map((c) => [c.key, c.label]),
);

export interface InterviewSession {
  id: string;
  mode: InterviewMode;
  categories: string[];
  technologies: string[];
  /** Simulation only: the interview type (recruiter/behavioral/...). */
  interviewType?: string | null;
  durationMinutes?: number | null;
  /** Simulation only: how many questions to aim for. */
  questionsTarget?: number | null;
  status: InterviewStatus;
  /** Question awaiting an answer, persisted for resume (§78). */
  pendingQuestion?: string | null;
  pendingKind?: TurnKind | null;
  startedAt: string;
  completedAt?: string | null;
}

/** The kind of question a turn represents. */
export type TurnKind = "opening" | "followup" | "retry";

export interface InterviewTurn {
  id: string;
  sessionId: string;
  sequence: number;
  kind: TurnKind;
  question: string;
  answer?: string | null;
  audioRecordingId?: string | null;
  transcriptId?: string | null;
  createdAt: string;
}
