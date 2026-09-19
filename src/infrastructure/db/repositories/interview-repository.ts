import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { interviewSessions, interviewTurns } from "../schema";
import type {
  InterviewSession,
  InterviewTurn,
  TurnKind,
} from "@/domain/interview/types";
import type { InterviewFeedback } from "@/domain/interview/interview-feedback";
import { ids } from "@/lib/ids";

export interface TurnWithFeedback {
  turn: InterviewTurn;
  feedback: InterviewFeedback | null;
}

/** Data access for interviews. UI never touches the DB directly (§87). */
export const interviewRepository = {
  createSession(input: {
    mode: InterviewSession["mode"];
    categories: string[];
    technologies: string[];
    durationMinutes?: number;
    pendingQuestion?: string;
    pendingKind?: TurnKind;
  }): InterviewSession {
    const id = ids.session();
    db.insert(interviewSessions)
      .values({
        id,
        mode: input.mode,
        categories: JSON.stringify(input.categories),
        technologies: JSON.stringify(input.technologies),
        durationMinutes: input.durationMinutes,
        pendingQuestion: input.pendingQuestion,
        pendingKind: input.pendingKind,
        status: "active",
      })
      .run();
    return this.getSession(id)!;
  },

  setPending(id: string, pendingQuestion: string | null, pendingKind: TurnKind | null) {
    db.update(interviewSessions)
      .set({ pendingQuestion, pendingKind })
      .where(eq(interviewSessions.id, id))
      .run();
  },

  getSession(id: string): InterviewSession | null {
    const row = db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, id))
      .get();
    return row ? mapSession(row) : null;
  },

  getActiveSession(mode: InterviewSession["mode"]): InterviewSession | null {
    const row = db
      .select()
      .from(interviewSessions)
      .where(
        and(
          eq(interviewSessions.mode, mode),
          eq(interviewSessions.status, "active"),
        ),
      )
      .orderBy(desc(interviewSessions.startedAt))
      .get();
    return row ? mapSession(row) : null;
  },

  setStatus(id: string, status: InterviewSession["status"]) {
    db.update(interviewSessions)
      .set({
        status,
        completedAt:
          status === "completed" ? new Date().toISOString() : undefined,
      })
      .where(eq(interviewSessions.id, id))
      .run();
  },

  countTurns(sessionId: string): number {
    return db
      .select({ id: interviewTurns.id })
      .from(interviewTurns)
      .where(eq(interviewTurns.sessionId, sessionId))
      .all().length;
  },

  createTurn(input: {
    sessionId: string;
    kind: TurnKind;
    question: string;
    answer?: string;
    audioRecordingId?: string;
    transcriptId?: string;
    feedback?: InterviewFeedback;
    promptVersion?: string;
  }): InterviewTurn {
    const id = ids.attempt();
    const sequence = this.countTurns(input.sessionId) + 1;
    db.insert(interviewTurns)
      .values({
        id,
        sessionId: input.sessionId,
        sequence,
        kind: input.kind,
        question: input.question,
        answer: input.answer,
        audioRecordingId: input.audioRecordingId,
        transcriptId: input.transcriptId,
        feedbackPayload: input.feedback
          ? JSON.stringify(input.feedback)
          : undefined,
        promptVersion: input.promptVersion,
      })
      .run();
    return mapTurn(
      db.select().from(interviewTurns).where(eq(interviewTurns.id, id)).get()!,
    );
  },

  listTurns(sessionId: string): TurnWithFeedback[] {
    const rows = db
      .select()
      .from(interviewTurns)
      .where(eq(interviewTurns.sessionId, sessionId))
      .orderBy(asc(interviewTurns.sequence))
      .all();
    return rows.map((r) => ({
      turn: mapTurn(r),
      feedback: r.feedbackPayload
        ? (JSON.parse(r.feedbackPayload) as InterviewFeedback)
        : null,
    }));
  },
};

function mapSession(
  row: typeof interviewSessions.$inferSelect,
): InterviewSession {
  return {
    id: row.id,
    mode: row.mode as InterviewSession["mode"],
    categories: safeArray(row.categories),
    technologies: safeArray(row.technologies),
    durationMinutes: row.durationMinutes,
    status: row.status as InterviewSession["status"],
    pendingQuestion: row.pendingQuestion,
    pendingKind: row.pendingKind as InterviewSession["pendingKind"],
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

function mapTurn(row: typeof interviewTurns.$inferSelect): InterviewTurn {
  return {
    id: row.id,
    sessionId: row.sessionId,
    sequence: row.sequence,
    kind: row.kind as TurnKind,
    question: row.question,
    answer: row.answer,
    audioRecordingId: row.audioRecordingId,
    transcriptId: row.transcriptId,
    createdAt: row.createdAt,
  };
}

function safeArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
