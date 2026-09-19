import "server-only";
import { getRelevantMemories, type LiveMemory } from "@/application/memory/memory-service";
import { CODE_TO_DIMENSION, DIMENSION_PRACTICE } from "@/domain/progress/dimensions";
import { MEMORY_TYPES, type MemoryType } from "@/domain/memory/types";

/**
 * Recommendation engine (§52): what practice is likely to help most right now?
 * Ranks by weakness severity (confidence), recurrence, and recency (all from
 * memory), and is time-aware (§15). Every recommendation explains WHY (§13).
 */

export type PracticeType = "vietnamese" | "english" | "interview";

export interface Recommendation {
  title: string;
  why: string;
  estimatedMinutes: number;
  practiceType: PracticeType;
  priority: "high" | "medium" | "low";
  href: string;
}

const ROUTE: Record<PracticeType, string> = {
  vietnamese: "/practice/vietnamese",
  english: "/practice/english",
  interview: "/interview/individual",
};

function practiceTypeFor(type: MemoryType): PracticeType {
  if (type === "interview_pattern" || type === "technical_gap") return "interview";
  if (type === "english_pattern" || type === "pronunciation_pattern")
    return "english";
  return "vietnamese";
}

function priorityFor(m: LiveMemory): Recommendation["priority"] {
  if (m.liveStatus === "confirmed" || m.confidence >= 0.75) return "high";
  if (m.confidence >= 0.5) return "medium";
  return "low";
}

function estimatedMinutesFor(type: PracticeType): number {
  return type === "interview" ? 15 : 10;
}

const DEFAULTS: Recommendation[] = [
  {
    title: "Explain a technical blocker in 45 seconds",
    why: "Getting to your main point early is the highest-value habit for interviews and standups.",
    estimatedMinutes: 10,
    practiceType: "vietnamese",
    priority: "medium",
    href: ROUTE.vietnamese,
  },
  {
    title: "Say a technical answer out loud, in English",
    why: "Move clear thinking into natural spoken English with a transcript and feedback.",
    estimatedMinutes: 10,
    practiceType: "english",
    priority: "medium",
    href: ROUTE.english,
  },
  {
    title: "Practice one interview question deeply",
    why: "A senior interviewer pushes on why, trade-offs, and metrics - get an adaptive follow-up.",
    estimatedMinutes: 15,
    practiceType: "interview",
    priority: "low",
    href: ROUTE.interview,
  },
];

export function getRecommendations(availableMinutes?: number): Recommendation[] {
  const memories = getRelevantMemories({
    types: [...MEMORY_TYPES],
    limit: 4,
  });

  const fromMemory: Recommendation[] = memories.map((m) => {
    const type = practiceTypeFor(m.type);
    const dim = CODE_TO_DIMENSION[m.key];
    return {
      title: dim ? DIMENSION_PRACTICE[dim] : `Work on: ${m.description}`,
      why: `${m.description} Seen across ${m.occurrenceCount} session${
        m.occurrenceCount === 1 ? "" : "s"
      }.`,
      estimatedMinutes: estimatedMinutesFor(type),
      practiceType: type,
      priority: priorityFor(m),
      href: ROUTE[type],
    };
  });

  // Fill with defaults for practice types not already covered.
  const covered = new Set(fromMemory.map((r) => r.practiceType));
  const recs = [...fromMemory, ...DEFAULTS.filter((d) => !covered.has(d.practiceType))];

  const filtered =
    availableMinutes != null
      ? recs.filter((r) => r.estimatedMinutes <= availableMinutes)
      : recs;

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return (filtered.length ? filtered : recs)
    .sort((a, b) => rank[a.priority] - rank[b.priority])
    .slice(0, 3);
}
