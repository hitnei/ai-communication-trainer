import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * SQLite schema (§58). Grows per phase. Phase 0/1 defines the profile and the
 * Vietnamese practice loop. Audio/transcript/memory/flashcard tables are added
 * in their respective phases. Every major entity carries timestamps.
 *
 * Timestamps are ISO-8601 strings for readability and to match domain types.
 */

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  currentRole: text("current_role"),
  yearsExperience: integer("years_experience"),
  targetRole: text("target_role"),
  targetMarkets: text("target_markets"), // JSON array
  primarySkills: text("primary_skills"), // JSON array
  secondarySkills: text("secondary_skills"), // JSON array
  englishGoal: text("english_goal"),
  transcriptMode: text("transcript_mode").notNull().default("after"), // §21
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const practiceSessions = sqliteTable("practice_sessions", {
  id: text("id").primaryKey(),
  mode: text("mode").notNull(), // "vietnamese" | "english"
  goal: text("goal").notNull(),
  exerciseType: text("exercise_type"),
  prompt: text("prompt").notNull(),
  questionId: text("question_id"),
  status: text("status").notNull().default("active"), // active|completed|abandoned
  startedAt: text("started_at").notNull().default(now),
  completedAt: text("completed_at"),
});

export const practiceAttempts = sqliteTable("practice_attempts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => practiceSessions.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  textAnswer: text("text_answer"),
  audioRecordingId: text("audio_recording_id"),
  transcriptId: text("transcript_id"),
  feedbackId: text("feedback_id"),
  createdAt: text("created_at").notNull().default(now),
});

export const feedbackItems = sqliteTable("feedback_items", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id")
    .notNull()
    .references(() => practiceAttempts.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // AI role that produced it
  promptVersion: text("prompt_version").notNull(),
  stage: text("stage").notNull(), // coaching stage at time of feedback
  payload: text("payload").notNull(), // JSON of the validated feedback object
  createdAt: text("created_at").notNull().default(now),
});

// Phase 2: English voice. Audio is stored as local files (§8); this row holds
// only metadata pointing at the file on disk.
export const audioRecordings = sqliteTable("audio_recordings", {
  id: text("id").primaryKey(),
  relativePath: text("relative_path").notNull(),
  mimeType: text("mime_type").notNull(),
  bytes: integer("bytes").notNull(),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at").notNull().default(now),
});

export const transcripts = sqliteTable("transcripts", {
  id: text("id").primaryKey(),
  audioRecordingId: text("audio_recording_id").references(
    () => audioRecordings.id,
    { onDelete: "set null" },
  ),
  text: text("text").notNull(),
  source: text("source").notNull(), // "browser" | "gemini" | "mock"
  language: text("language"),
  createdAt: text("created_at").notNull().default(now),
});

// Phase 3: interviews (§61, §62). Each turn is one question + its answer +
// the interviewer's feedback (stored as JSON), which is a practical read of the
// conceptual turn model.
export const interviewSessions = sqliteTable("interview_sessions", {
  id: text("id").primaryKey(),
  mode: text("mode").notNull(), // "individual" | "simulation"
  categories: text("categories").notNull(), // JSON array of category keys
  technologies: text("technologies").notNull().default("[]"), // JSON array
  interviewType: text("interview_type"), // simulation: recruiter/behavioral/...
  durationMinutes: integer("duration_minutes"),
  questionsTarget: integer("questions_target"), // simulation: target # of questions
  reviewPayload: text("review_payload"), // simulation: JSON of the final review
  status: text("status").notNull().default("active"),
  // The question currently awaiting an answer (for resume, §78) and its kind.
  pendingQuestion: text("pending_question"),
  pendingKind: text("pending_kind"),
  startedAt: text("started_at").notNull().default(now),
  completedAt: text("completed_at"),
});

export const interviewTurns = sqliteTable("interview_turns", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => interviewSessions.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  kind: text("kind").notNull(), // "opening" | "followup" | "retry"
  question: text("question").notNull(),
  answer: text("answer"),
  audioRecordingId: text("audio_recording_id"),
  transcriptId: text("transcript_id"),
  feedbackPayload: text("feedback_payload"), // JSON of InterviewFeedback
  promptVersion: text("prompt_version"),
  createdAt: text("created_at").notNull().default(now),
});

export type ProfileRow = typeof profiles.$inferSelect;
export type PracticeSessionRow = typeof practiceSessions.$inferSelect;
export type PracticeAttemptRow = typeof practiceAttempts.$inferSelect;
export type FeedbackItemRow = typeof feedbackItems.$inferSelect;
export type AudioRecordingRow = typeof audioRecordings.$inferSelect;
export type TranscriptRow = typeof transcripts.$inferSelect;
export type InterviewSessionRow = typeof interviewSessions.$inferSelect;
export type InterviewTurnRow = typeof interviewTurns.$inferSelect;
