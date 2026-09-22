import "server-only";
import { practiceRepository } from "@/infrastructure/db/repositories/practice-repository";
import { interviewRepository } from "@/infrastructure/db/repositories/interview-repository";
import type { PracticeSession } from "@/domain/practice/types";
import type { InterviewSession } from "@/domain/interview/types";

export interface PracticeHistoryItem {
  session: PracticeSession;
  attemptCount: number;
  startedAtLabel: string;
}

export interface InterviewHistoryItem {
  session: InterviewSession;
  turnCount: number;
  startedAtLabel: string;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Format server-side and pass a string so the client component doesn't re-derive
// dates during hydration (which would mismatch across locales/timezones).
function label(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFmt.format(d);
}

export function listPracticeHistory(): PracticeHistoryItem[] {
  return practiceRepository
    .listAllSessions()
    .filter((s) => s.status !== "active")
    .map((s) => ({
      session: s,
      attemptCount: practiceRepository.countAttempts(s.id),
      startedAtLabel: label(s.startedAt),
    }))
    .reverse();
}

export function listInterviewHistory(): InterviewHistoryItem[] {
  return interviewRepository
    .listAllSessions()
    .filter((s) => s.status !== "active")
    .map((s) => ({
      session: s,
      turnCount: interviewRepository.countTurns(s.id),
      startedAtLabel: label(s.startedAt),
    }))
    .reverse();
}
