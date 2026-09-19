import "server-only";
import {
  CODE_MEMORY,
  confidenceFor,
  deriveStatus,
  MEMORY_STATUS_LABEL,
  type CommunicationMemory,
  type MemorySignal,
  type MemoryStatus,
  type MemoryType,
} from "@/domain/memory/types";
import type { VietnameseCoachFeedback } from "@/domain/practice/vietnamese-feedback";
import type { EnglishAttemptFeedback } from "@/domain/practice/english-feedback";
import { memoryRepository } from "@/infrastructure/db/repositories/memory-repository";
import { practiceRepository } from "@/infrastructure/db/repositories/practice-repository";
import { interviewRepository } from "@/infrastructure/db/repositories/interview-repository";
import { ids } from "@/lib/ids";
import { logger } from "@/lib/logger";

/**
 * Application service for personal memory (§45-§48). It decides what counts as a
 * recurring pattern (Rule 3): each signal adds at most one occurrence per
 * session, so confidence reflects true cross-session recurrence, not repetition
 * within a single practice.
 */

/** Record coded observations from a finished session, deduped per session. */
function recordSignals(signals: MemorySignal[]): void {
  // Collapse to one signal per (type,key) for this session.
  const unique = new Map<string, MemorySignal>();
  for (const s of signals) {
    const k = `${s.type}:${s.key}`;
    if (!unique.has(k)) unique.set(k, s);
  }

  for (const s of unique.values()) {
    const existing = memoryRepository.findByTypeKey(s.type, s.key);
    if (!existing) {
      const id = ids.memory();
      memoryRepository.create({
        id,
        type: s.type,
        key: s.key,
        description: s.description,
        confidence: confidenceFor(1),
        occurrenceCount: 1,
        status: deriveStatus(1, 0),
      });
      memoryRepository.addEvidence({
        id: ids.evidence(),
        memoryId: id,
        sessionId: s.sessionId,
        attemptId: s.attemptId,
        evidence: s.evidence,
        source: s.source,
      });
      continue;
    }
    // Already counted this session? Skip (one occurrence per session, §47).
    if (memoryRepository.hasEvidenceForSession(existing.id, s.sessionId)) continue;

    const count = existing.occurrenceCount + 1;
    memoryRepository.update(existing.id, {
      occurrenceCount: count,
      confidence: confidenceFor(count),
      status: deriveStatus(count, 0),
      lastSeenAt: new Date().toISOString(),
    });
    memoryRepository.addEvidence({
      id: ids.evidence(),
      memoryId: existing.id,
      sessionId: s.sessionId,
      attemptId: s.attemptId,
      evidence: s.evidence,
      source: s.source,
    });
  }
}

function signalFromCode(
  code: string,
  base: { evidence: string; sessionId: string; attemptId?: string; source: string },
): MemorySignal | null {
  const mapping = CODE_MEMORY[code];
  if (!mapping) return null;
  return {
    type: mapping.type,
    key: code,
    description: mapping.description,
    ...base,
  };
}

/** Extract memory from a completed Vietnamese practice session. */
export function extractFromVietnamese(sessionId: string): void {
  try {
    const attempts =
      practiceRepository.listAttempts<VietnameseCoachFeedback>(sessionId);
    const signals: MemorySignal[] = [];
    for (const a of attempts) {
      const fb = a.feedback?.feedback;
      if (!fb) continue;
      for (const issue of fb.issues) {
        const s = signalFromCode(issue.code, {
          evidence: issue.detail,
          sessionId,
          attemptId: a.attempt.id,
          source: "vietnamese",
        });
        if (s) signals.push(s);
      }
    }
    recordSignals(signals);
  } catch (e) {
    logger.warn("memory_extract_vietnamese_failed", {
      sessionId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Extract memory from a completed English voice session. */
export function extractFromEnglish(sessionId: string): void {
  try {
    const attempts =
      practiceRepository.listAttempts<EnglishAttemptFeedback>(sessionId);
    const signals: MemorySignal[] = [];
    for (const a of attempts) {
      const fb = a.feedback?.feedback;
      if (!fb) continue;
      for (const issue of fb.english.issues) {
        const s = signalFromCode(issue.code, {
          evidence: issue.evidence ?? issue.detail,
          sessionId,
          attemptId: a.attempt.id,
          source: "english",
        });
        if (s) signals.push(s);
      }
      const p = fb.pronunciation;
      if (
        p?.assessed &&
        (p.intelligibility === "sometimes_unclear" ||
          p.intelligibility === "hard_to_follow")
      ) {
        const s = signalFromCode("intelligibility", {
          evidence: p.summary || "Parts were hard to catch.",
          sessionId,
          attemptId: a.attempt.id,
          source: "english",
        });
        if (s) signals.push(s);
      }
    }
    recordSignals(signals);
  } catch (e) {
    logger.warn("memory_extract_english_failed", {
      sessionId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Extract memory from a completed individual interview. */
export function extractFromInterviewIndividual(sessionId: string): void {
  try {
    const turns = interviewRepository.listTurns(sessionId);
    const signals: MemorySignal[] = [];
    for (const t of turns) {
      if (!t.feedback) continue;
      for (const issue of t.feedback.issues) {
        const s = signalFromCode(issue.code, {
          evidence: issue.evidence ?? issue.detail,
          sessionId,
          attemptId: t.turn.id,
          source: "interview",
        });
        if (s) signals.push(s);
      }
    }
    recordSignals(signals);
  } catch (e) {
    logger.warn("memory_extract_interview_failed", {
      sessionId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Extract memory from a completed full simulation (from its review). */
export function extractFromSimulation(sessionId: string): void {
  try {
    const review = interviewRepository.getReview(sessionId);
    if (!review) return;
    const signals: MemorySignal[] = [];
    for (const a of review.areasToImprove) {
      const s = signalFromCode(a.code, {
        evidence: a.evidence ?? a.detail,
        sessionId,
        source: "simulation",
      });
      if (s) signals.push(s);
    }
    recordSignals(signals);
  } catch (e) {
    logger.warn("memory_extract_simulation_failed", {
      sessionId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** A memory with its status recomputed for how recently it last appeared. */
export interface LiveMemory extends CommunicationMemory {
  liveStatus: MemoryStatus;
  sessionsSinceLastSeen: number;
}

function toLive(m: CommunicationMemory): LiveMemory {
  const sessionsSinceLastSeen = memoryRepository.countSessionsAfter(m.lastSeenAt);
  return {
    ...m,
    sessionsSinceLastSeen,
    liveStatus: deriveStatus(m.occurrenceCount, sessionsSinceLastSeen),
  };
}

export function listMemories(): LiveMemory[] {
  return memoryRepository.list().map(toLive);
}

export function getMemoryEvidence(memoryId: string) {
  return memoryRepository.listEvidence(memoryId);
}

export interface MemoryWithEvidence extends LiveMemory {
  evidence: ReturnType<typeof memoryRepository.listEvidence>;
}

/** All memories with their evidence, for the inspection UI (§46). */
export function listMemoriesWithEvidence(): MemoryWithEvidence[] {
  return listMemories().map((m) => ({
    ...m,
    evidence: memoryRepository.listEvidence(m.id),
  }));
}

export function deleteMemory(id: string): void {
  memoryRepository.delete(id);
}

export function clearAllMemory(): void {
  memoryRepository.clearAll();
}

/**
 * Retrieve the most relevant patterns for a task (§48). Never returns everything;
 * ranks by confidence and recency and drops patterns that look under control.
 */
export function getRelevantMemories(opts: {
  types: MemoryType[];
  limit?: number;
}): LiveMemory[] {
  const limit = opts.limit ?? 3;
  return listMemories()
    .filter((m) => opts.types.includes(m.type))
    .filter((m) => m.liveStatus !== "stable")
    .map((m) => ({ m, score: priority(m) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.m);
}

function priority(m: LiveMemory): number {
  let score = m.confidence;
  if (m.liveStatus === "confirmed") score += 0.3;
  if (m.liveStatus === "improving") score -= 0.15;
  return score;
}

/** A concise, human summary of relevant patterns to inject into a prompt (§48). */
export function buildMemorySummary(types: MemoryType[]): string | undefined {
  const relevant = getRelevantMemories({ types, limit: 3 });
  if (relevant.length === 0) return undefined;
  const lines = relevant.map(
    (m) =>
      `- ${m.description} (seen in ${m.occurrenceCount} session${
        m.occurrenceCount === 1 ? "" : "s"
      }, ${MEMORY_STATUS_LABEL[m.liveStatus].toLowerCase()})`,
  );
  return `These are recurring patterns for this user from past sessions. Gently keep them in mind; do not force them if this answer doesn't show them:\n${lines.join(
    "\n",
  )}`;
}
