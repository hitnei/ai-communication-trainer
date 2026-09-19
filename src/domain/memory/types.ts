/**
 * Personal memory domain (§45-§48).
 *
 * Memory captures RECURRING patterns, never one-offs (§47). Recurrence is
 * measured deterministically by counting the distinct sessions in which a coded
 * issue appears - this is more reliable than asking an LLM "did this recur?" and
 * keeps the "does this count as a weakness" decision in the application layer
 * (Rule 3). The lifecycle candidate -> confirmed -> improving -> stable reflects
 * both how often a pattern occurs and how recently.
 */

export const MEMORY_TYPES = [
  "communication_pattern",
  "english_pattern",
  "pronunciation_pattern",
  "interview_pattern",
  "technical_gap",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
  communication_pattern: "Communication",
  english_pattern: "English",
  pronunciation_pattern: "Pronunciation",
  interview_pattern: "Interview",
  technical_gap: "Technical gap",
};

export const MEMORY_STATUSES = [
  "candidate",
  "confirmed",
  "improving",
  "stable",
] as const;

export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export const MEMORY_STATUS_LABEL: Record<MemoryStatus, string> = {
  candidate: "Emerging",
  confirmed: "Recurring",
  improving: "Improving",
  stable: "Under control",
};

export interface CommunicationMemory {
  id: string;
  type: MemoryType;
  /** Stable key, usually the feedback code (e.g. "main_point_late"). */
  key: string;
  description: string;
  /** 0..1, derived from how many distinct sessions showed the pattern. */
  confidence: number;
  occurrenceCount: number;
  status: MemoryStatus;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface MemoryEvidence {
  id: string;
  memoryId: string;
  sessionId: string;
  attemptId?: string | null;
  /** A short quote or note showing the pattern in context (§46). */
  evidence: string;
  source: string; // "vietnamese" | "english" | "interview" | "simulation"
  createdAt: string;
}

/** A single coded observation extracted from a session's feedback. */
export interface MemorySignal {
  type: MemoryType;
  key: string;
  description: string;
  evidence: string;
  sessionId: string;
  attemptId?: string;
  source: string;
}

/** Number of distinct sessions before a pattern is treated as recurring (§47). */
export const CONFIRM_THRESHOLD = 3;

export function confidenceFor(occurrenceCount: number): number {
  return Math.min(1, occurrenceCount / (CONFIRM_THRESHOLD + 1));
}

/**
 * Derive status from how often and how recently a pattern appears.
 * `sessionsSinceLastSeen` = number of later completed sessions in which it did
 * not reappear.
 */
export function deriveStatus(
  occurrenceCount: number,
  sessionsSinceLastSeen: number,
): MemoryStatus {
  if (occurrenceCount < CONFIRM_THRESHOLD) return "candidate";
  if (sessionsSinceLastSeen >= 4) return "stable";
  if (sessionsSinceLastSeen >= 2) return "improving";
  return "confirmed";
}

/**
 * Maps feedback codes (from the shared taxonomy) to a memory type and a
 * human, non-robotic default description (§5). Codes not listed are ignored.
 */
export const CODE_MEMORY: Record<
  string,
  { type: MemoryType; description: string }
> = {
  // thinking + communication
  unclear_idea: {
    type: "communication_pattern",
    description: "Your core idea isn't fully formed before you start explaining.",
  },
  missing_point: {
    type: "communication_pattern",
    description: "The main point sometimes never quite lands.",
  },
  weak_logic: {
    type: "communication_pattern",
    description: "The reasoning has gaps that are easy to poke at.",
  },
  poor_structure: {
    type: "communication_pattern",
    description: "Ideas come out in an order that's hard to follow.",
  },
  too_long: {
    type: "communication_pattern",
    description: "Answers run long and the core idea gets buried.",
  },
  repetitive: {
    type: "communication_pattern",
    description: "You circle back and repeat the same point.",
  },
  main_point_late: {
    type: "communication_pattern",
    description: "You give background before stating the main point.",
  },
  unclear: {
    type: "communication_pattern",
    description: "Some explanations are hard to follow the first time.",
  },
  incomplete: {
    type: "communication_pattern",
    description: "Answers sometimes leave out a key part.",
  },
  // english
  grammar: {
    type: "english_pattern",
    description: "A few grammar slips recur in your speech.",
  },
  vocabulary: {
    type: "english_pattern",
    description: "Word choice could be more precise in places.",
  },
  unnatural_phrase: {
    type: "english_pattern",
    description: "Some phrasing sounds a little unnatural.",
  },
  fluency: {
    type: "english_pattern",
    description: "Fluency breaks up the delivery at times.",
  },
  filler: {
    type: "english_pattern",
    description: "You lean on filler words around your main point.",
  },
  // pronunciation
  word_clarity: {
    type: "pronunciation_pattern",
    description: "A few words come out less clearly than they could.",
  },
  stress: {
    type: "pronunciation_pattern",
    description: "Word stress lands in unexpected places sometimes.",
  },
  rhythm: {
    type: "pronunciation_pattern",
    description: "Speech rhythm can make you harder to follow.",
  },
  intelligibility: {
    type: "pronunciation_pattern",
    description: "Parts of your speech are sometimes hard to catch.",
  },
  // interview
  too_generic: {
    type: "interview_pattern",
    description: "Interview answers stay generic instead of specific.",
  },
  insufficient_depth: {
    type: "interview_pattern",
    description: "Answers don't go deep enough for a senior bar.",
  },
  weak_tradeoff: {
    type: "interview_pattern",
    description: "You skip the trade-offs behind your decisions.",
  },
  weak_example: {
    type: "interview_pattern",
    description: "Examples are thin or hard to picture.",
  },
  unsupported_claim: {
    type: "interview_pattern",
    description: "Claims aren't backed by evidence.",
  },
  missing_metric: {
    type: "interview_pattern",
    description: "You describe impact without numbers.",
  },
};
