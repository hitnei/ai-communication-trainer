import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../client";
import {
  communicationMemories,
  interviewSessions,
  memoryEvidence,
  practiceSessions,
} from "../schema";
import type {
  CommunicationMemory,
  MemoryEvidence,
  MemoryStatus,
  MemoryType,
} from "@/domain/memory/types";

/** Data access for personal memory (§45, §46). */
export const memoryRepository = {
  findByTypeKey(type: string, key: string): CommunicationMemory | null {
    const row = db
      .select()
      .from(communicationMemories)
      .where(
        and(
          eq(communicationMemories.type, type),
          eq(communicationMemories.key, key),
        ),
      )
      .get();
    return row ? mapMemory(row) : null;
  },

  create(input: {
    id: string;
    type: MemoryType;
    key: string;
    description: string;
    confidence: number;
    occurrenceCount: number;
    status: MemoryStatus;
  }): void {
    db.insert(communicationMemories)
      .values({
        id: input.id,
        type: input.type,
        key: input.key,
        description: input.description,
        confidence: input.confidence,
        occurrenceCount: input.occurrenceCount,
        status: input.status,
      })
      .run();
  },

  update(
    id: string,
    patch: {
      description?: string;
      confidence?: number;
      occurrenceCount?: number;
      status?: MemoryStatus;
      lastSeenAt?: string;
    },
  ): void {
    db.update(communicationMemories)
      .set(patch)
      .where(eq(communicationMemories.id, id))
      .run();
  },

  hasEvidenceForSession(memoryId: string, sessionId: string): boolean {
    return !!db
      .select({ id: memoryEvidence.id })
      .from(memoryEvidence)
      .where(
        and(
          eq(memoryEvidence.memoryId, memoryId),
          eq(memoryEvidence.sessionId, sessionId),
        ),
      )
      .get();
  },

  addEvidence(input: {
    id: string;
    memoryId: string;
    sessionId: string;
    attemptId?: string;
    evidence: string;
    source: string;
  }): void {
    db.insert(memoryEvidence)
      .values({
        id: input.id,
        memoryId: input.memoryId,
        sessionId: input.sessionId,
        attemptId: input.attemptId,
        evidence: input.evidence,
        source: input.source,
      })
      .run();
  },

  list(): CommunicationMemory[] {
    return db
      .select()
      .from(communicationMemories)
      .orderBy(
        desc(communicationMemories.confidence),
        desc(communicationMemories.lastSeenAt),
      )
      .all()
      .map(mapMemory);
  },

  listEvidence(memoryId: string): MemoryEvidence[] {
    return db
      .select()
      .from(memoryEvidence)
      .where(eq(memoryEvidence.memoryId, memoryId))
      .orderBy(desc(memoryEvidence.createdAt))
      .all()
      .map((r) => ({
        id: r.id,
        memoryId: r.memoryId,
        sessionId: r.sessionId,
        attemptId: r.attemptId,
        evidence: r.evidence,
        source: r.source,
        createdAt: r.createdAt,
      }));
  },

  /** Distinct completed-or-active sessions started after `iso`, for recency. */
  countSessionsAfter(iso: string): number {
    const p = db
      .select({ n: sql<number>`count(*)` })
      .from(practiceSessions)
      .where(gt(practiceSessions.startedAt, iso))
      .get();
    const i = db
      .select({ n: sql<number>`count(*)` })
      .from(interviewSessions)
      .where(gt(interviewSessions.startedAt, iso))
      .get();
    return (p?.n ?? 0) + (i?.n ?? 0);
  },

  delete(id: string): void {
    db.delete(communicationMemories)
      .where(eq(communicationMemories.id, id))
      .run();
  },

  clearAll(): void {
    db.delete(communicationMemories).run();
  },
};

function mapMemory(
  row: typeof communicationMemories.$inferSelect,
): CommunicationMemory {
  return {
    id: row.id,
    type: row.type as MemoryType,
    key: row.key,
    description: row.description,
    confidence: row.confidence,
    occurrenceCount: row.occurrenceCount,
    status: row.status as MemoryStatus,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
  };
}
