/** Practice domain entities (§59, §60). */

export type PracticeMode = "vietnamese" | "english";
export type SessionStatus = "active" | "completed" | "abandoned";

/** Vietnamese exercise types (§16). */
export const VIETNAMESE_EXERCISE_TYPES = [
  "explain_problem",
  "tell_story",
  "give_opinion",
  "explain_concept",
  "explain_experience",
  "interview_answer",
  "casual_conversation",
  "rewrite_messy",
] as const;

export type VietnameseExerciseType =
  (typeof VIETNAMESE_EXERCISE_TYPES)[number];

export const EXERCISE_LABELS: Record<VietnameseExerciseType, string> = {
  explain_problem: "Explain a problem",
  tell_story: "Tell a story",
  give_opinion: "Give an opinion",
  explain_concept: "Explain a technical concept",
  explain_experience: "Explain an experience",
  interview_answer: "Interview answer",
  casual_conversation: "Casual conversation",
  rewrite_messy: "Rewrite a messy thought",
};

export interface PracticeSession {
  id: string;
  mode: PracticeMode;
  goal: string;
  exerciseType?: VietnameseExerciseType;
  prompt: string;
  questionId?: string;
  status: SessionStatus;
  startedAt: string;
  completedAt?: string | null;
}

export interface PracticeAttempt {
  id: string;
  sessionId: string;
  attemptNumber: number;
  textAnswer?: string | null;
  audioRecordingId?: string | null;
  transcriptId?: string | null;
  feedbackId?: string | null;
  createdAt: string;
}
