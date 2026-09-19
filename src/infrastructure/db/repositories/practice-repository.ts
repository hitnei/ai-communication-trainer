import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../client";
import {
  audioRecordings,
  feedbackItems,
  practiceAttempts,
  practiceSessions,
  transcripts,
} from "../schema";
import type {
  PracticeAttempt,
  PracticeSession,
} from "@/domain/practice/types";
import { ids } from "@/lib/ids";

/** Stored feedback, generic over the payload shape each role produces. */
export interface StoredFeedback<T = unknown> {
  id: string;
  attemptId: string;
  role: string;
  promptVersion: string;
  stage: string;
  feedback: T;
  createdAt: string;
}

export interface AttemptWithFeedback<T = unknown> {
  attempt: PracticeAttempt;
  feedback: StoredFeedback<T> | null;
}

export interface StoredAudioRow {
  id: string;
  relativePath: string;
  mimeType: string;
  bytes: number;
  durationMs?: number | null;
}

/** Data access for the practice loop. UI never touches the DB directly (§87). */
export const practiceRepository = {
  createSession(
    input: Omit<PracticeSession, "id" | "startedAt" | "status" | "completedAt">,
  ): PracticeSession {
    const id = ids.session();
    db.insert(practiceSessions)
      .values({
        id,
        mode: input.mode,
        goal: input.goal,
        exerciseType: input.exerciseType,
        prompt: input.prompt,
        questionId: input.questionId,
        status: "active",
      })
      .run();
    return this.getSession(id)!;
  },

  getSession(id: string): PracticeSession | null {
    const row = db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.id, id))
      .get();
    return row ? mapSession(row) : null;
  },

  getActiveSession(mode: string): PracticeSession | null {
    const row = db
      .select()
      .from(practiceSessions)
      .where(
        and(eq(practiceSessions.mode, mode), eq(practiceSessions.status, "active")),
      )
      .orderBy(desc(practiceSessions.startedAt))
      .get();
    return row ? mapSession(row) : null;
  },

  setSessionStatus(id: string, status: PracticeSession["status"]) {
    db.update(practiceSessions)
      .set({
        status,
        completedAt:
          status === "completed" ? new Date().toISOString() : undefined,
      })
      .where(eq(practiceSessions.id, id))
      .run();
  },

  countAttempts(sessionId: string): number {
    return db
      .select({ id: practiceAttempts.id })
      .from(practiceAttempts)
      .where(eq(practiceAttempts.sessionId, sessionId))
      .all().length;
  },

  createAttempt(input: {
    sessionId: string;
    attemptNumber: number;
    textAnswer?: string;
    audioRecordingId?: string;
    transcriptId?: string;
  }): PracticeAttempt {
    const id = ids.attempt();
    db.insert(practiceAttempts)
      .values({
        id,
        sessionId: input.sessionId,
        attemptNumber: input.attemptNumber,
        textAnswer: input.textAnswer,
        audioRecordingId: input.audioRecordingId,
        transcriptId: input.transcriptId,
      })
      .run();
    return mapAttempt(
      db.select().from(practiceAttempts).where(eq(practiceAttempts.id, id)).get()!,
    );
  },

  saveAudioRecording(input: {
    id: string;
    relativePath: string;
    mimeType: string;
    bytes: number;
    durationMs?: number | null;
  }): StoredAudioRow {
    db.insert(audioRecordings)
      .values({
        id: input.id,
        relativePath: input.relativePath,
        mimeType: input.mimeType,
        bytes: input.bytes,
        durationMs: input.durationMs,
      })
      .run();
    return input;
  },

  getAudioRecording(id: string): StoredAudioRow | null {
    const row = db
      .select()
      .from(audioRecordings)
      .where(eq(audioRecordings.id, id))
      .get();
    return row ?? null;
  },

  saveTranscript(input: {
    audioRecordingId?: string;
    text: string;
    source: string;
    language?: string;
  }): string {
    const id = ids.transcript();
    db.insert(transcripts)
      .values({
        id,
        audioRecordingId: input.audioRecordingId,
        text: input.text,
        source: input.source,
        language: input.language,
      })
      .run();
    return id;
  },

  saveFeedback<T>(input: {
    attemptId: string;
    role: string;
    promptVersion: string;
    stage: string;
    feedback: T;
  }): StoredFeedback<T> {
    const id = ids.feedback();
    db.insert(feedbackItems)
      .values({
        id,
        attemptId: input.attemptId,
        role: input.role,
        promptVersion: input.promptVersion,
        stage: input.stage,
        payload: JSON.stringify(input.feedback),
      })
      .run();
    db.update(practiceAttempts)
      .set({ feedbackId: id })
      .where(eq(practiceAttempts.id, input.attemptId))
      .run();
    return {
      id,
      attemptId: input.attemptId,
      role: input.role,
      promptVersion: input.promptVersion,
      stage: input.stage,
      feedback: input.feedback,
      createdAt: new Date().toISOString(),
    };
  },

  listAttempts<T = unknown>(sessionId: string): AttemptWithFeedback<T>[] {
    const attempts = db
      .select()
      .from(practiceAttempts)
      .where(eq(practiceAttempts.sessionId, sessionId))
      .orderBy(asc(practiceAttempts.attemptNumber))
      .all();

    return attempts.map((a) => {
      const fb = a.feedbackId
        ? db
            .select()
            .from(feedbackItems)
            .where(eq(feedbackItems.id, a.feedbackId))
            .get()
        : null;
      return {
        attempt: mapAttempt(a),
        feedback: fb
          ? {
              id: fb.id,
              attemptId: fb.attemptId,
              role: fb.role,
              promptVersion: fb.promptVersion,
              stage: fb.stage,
              feedback: JSON.parse(fb.payload) as T,
              createdAt: fb.createdAt,
            }
          : null,
      };
    });
  },

  deleteAttempt(attemptId: string) {
    db.delete(practiceAttempts).where(eq(practiceAttempts.id, attemptId)).run();
  },

  deleteSession(sessionId: string) {
    db.delete(practiceSessions).where(eq(practiceSessions.id, sessionId)).run();
  },
};

function mapSession(row: typeof practiceSessions.$inferSelect): PracticeSession {
  return {
    id: row.id,
    mode: row.mode as PracticeSession["mode"],
    goal: row.goal,
    exerciseType: row.exerciseType as PracticeSession["exerciseType"],
    prompt: row.prompt,
    questionId: row.questionId ?? undefined,
    status: row.status as PracticeSession["status"],
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

function mapAttempt(row: typeof practiceAttempts.$inferSelect): PracticeAttempt {
  return {
    id: row.id,
    sessionId: row.sessionId,
    attemptNumber: row.attemptNumber,
    textAnswer: row.textAnswer,
    audioRecordingId: row.audioRecordingId,
    transcriptId: row.transcriptId,
    feedbackId: row.feedbackId,
    createdAt: row.createdAt,
  };
}
