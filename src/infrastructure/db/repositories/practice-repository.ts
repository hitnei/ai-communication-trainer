import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../client";
import {
  feedbackItems,
  practiceAttempts,
  practiceSessions,
} from "../schema";
import type {
  PracticeAttempt,
  PracticeSession,
} from "@/domain/practice/types";
import type { VietnameseCoachFeedback } from "@/domain/practice/vietnamese-feedback";
import { ids } from "@/lib/ids";

export interface StoredFeedback {
  id: string;
  attemptId: string;
  role: string;
  promptVersion: string;
  stage: string;
  feedback: VietnameseCoachFeedback;
  createdAt: string;
}

export interface AttemptWithFeedback {
  attempt: PracticeAttempt;
  feedback: StoredFeedback | null;
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
          status === "completed"
            ? new Date().toISOString()
            : undefined,
      })
      .where(eq(practiceSessions.id, id))
      .run();
  },

  countAttempts(sessionId: string): number {
    const rows = db
      .select({ id: practiceAttempts.id })
      .from(practiceAttempts)
      .where(eq(practiceAttempts.sessionId, sessionId))
      .all();
    return rows.length;
  },

  createAttempt(input: {
    sessionId: string;
    attemptNumber: number;
    textAnswer?: string;
  }): PracticeAttempt {
    const id = ids.attempt();
    db.insert(practiceAttempts)
      .values({
        id,
        sessionId: input.sessionId,
        attemptNumber: input.attemptNumber,
        textAnswer: input.textAnswer,
      })
      .run();
    return mapAttempt(
      db.select().from(practiceAttempts).where(eq(practiceAttempts.id, id)).get()!,
    );
  },

  saveFeedback(input: {
    attemptId: string;
    role: string;
    promptVersion: string;
    stage: string;
    feedback: VietnameseCoachFeedback;
  }): StoredFeedback {
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

  listAttempts(sessionId: string): AttemptWithFeedback[] {
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
              feedback: JSON.parse(fb.payload) as VietnameseCoachFeedback,
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
