import "server-only";
import { SKILL_DIMENSIONS, type SkillDimension } from "@/domain/feedback/taxonomy";
import {
  CODE_TO_DIMENSION,
  DIMENSION_LABEL,
  DIMENSION_PRACTICE,
} from "@/domain/progress/dimensions";
import { practiceRepository } from "@/infrastructure/db/repositories/practice-repository";
import { interviewRepository } from "@/infrastructure/db/repositories/interview-repository";
import { listMemoriesWithEvidence } from "@/application/memory/memory-service";
import { MEMORY_STATUS_LABEL } from "@/domain/memory/types";

/**
 * Progress is evidence-first (§49, §50): every claim is backed by counts. We do
 * NOT invent per-dimension exam scores - we roll up the issues actually observed
 * and measurable metrics (answer length), then compare recent vs earlier.
 */

export type Trend = "improving" | "steady" | "regressing" | "no_data";

export interface DimensionProgress {
  dimension: SkillDimension;
  label: string;
  hasData: boolean;
  recentWith: number;
  recentCount: number;
  earlierWith: number;
  earlierCount: number;
  trend: Trend;
  evidence: string;
}

export interface RecurringMistake {
  title: string;
  occurrences: number;
  status: string;
  examples: string[];
  suggestedPractice: string;
}

export interface ProgressOverview {
  totalSessions: number;
  dimensions: DimensionProgress[];
  lengthTrend: {
    earlierAvgWords: number;
    recentAvgWords: number;
    direction: "shorter" | "longer" | "same";
    hasData: boolean;
  };
  recurringMistakes: RecurringMistake[];
}

interface SessionAgg {
  at: string;
  dimensions: Set<SkillDimension>;
  wordCounts: number[];
}

function words(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function codeToDim(code: string): SkillDimension | null {
  return CODE_TO_DIMENSION[code] ?? null;
}

function collectPractice(): SessionAgg[] {
  const out: SessionAgg[] = [];
  for (const s of practiceRepository.listAllSessions()) {
    const attempts = practiceRepository.listAttempts(s.id);
    const dims = new Set<SkillDimension>();
    const wc: number[] = [];
    let answered = false;
    for (const a of attempts) {
      if (a.attempt.textAnswer) {
        wc.push(words(a.attempt.textAnswer));
        answered = true;
      }
      const fb = a.feedback?.feedback as unknown;
      for (const code of extractPracticeCodes(s.mode, fb)) {
        const d = codeToDim(code);
        if (d) dims.add(d);
      }
    }
    if (answered) out.push({ at: s.startedAt, dimensions: dims, wordCounts: wc });
  }
  return out;
}

function extractPracticeCodes(mode: string, fb: unknown): string[] {
  if (!fb || typeof fb !== "object") return [];
  const codes: string[] = [];
  if (mode === "vietnamese") {
    const issues = (fb as { issues?: { code?: string }[] }).issues ?? [];
    for (const i of issues) if (i.code) codes.push(i.code);
  } else {
    const english = (fb as { english?: { issues?: { code?: string }[] } }).english;
    for (const i of english?.issues ?? []) if (i.code) codes.push(i.code);
    const pron = (fb as { pronunciation?: { assessed?: boolean; intelligibility?: string } })
      .pronunciation;
    if (
      pron?.assessed &&
      (pron.intelligibility === "sometimes_unclear" ||
        pron.intelligibility === "hard_to_follow")
    ) {
      codes.push("intelligibility");
    }
  }
  return codes;
}

function collectInterview(): SessionAgg[] {
  const out: SessionAgg[] = [];
  for (const s of interviewRepository.listAllSessions()) {
    const turns = interviewRepository.listTurns(s.id);
    const dims = new Set<SkillDimension>();
    const wc: number[] = [];
    let answered = false;
    for (const t of turns) {
      if (t.turn.answer) {
        wc.push(words(t.turn.answer));
        answered = true;
      }
      for (const i of t.feedback?.issues ?? []) {
        const d = codeToDim(i.code);
        if (d) dims.add(d);
      }
    }
    const review = interviewRepository.getReview(s.id);
    for (const a of review?.areasToImprove ?? []) {
      const d = codeToDim(a.code);
      if (d) dims.add(d);
    }
    if (answered || review) {
      out.push({ at: s.startedAt, dimensions: dims, wordCounts: wc });
    }
  }
  return out;
}

export function getProgressOverview(): ProgressOverview {
  const aggs = [...collectPractice(), ...collectInterview()].sort((a, b) =>
    a.at.localeCompare(b.at),
  );
  const total = aggs.length;

  const mid = Math.floor(total / 2);
  const earlier = aggs.slice(0, mid);
  const recent = aggs.slice(mid);
  const enoughForTrend = earlier.length > 0 && recent.length > 0;

  const dimensions: DimensionProgress[] = SKILL_DIMENSIONS.map((dim) => {
    const earlierWith = earlier.filter((s) => s.dimensions.has(dim)).length;
    const recentWith = recent.filter((s) => s.dimensions.has(dim)).length;
    const totalWith = aggs.filter((s) => s.dimensions.has(dim)).length;
    const hasData = totalWith > 0;

    let trend: Trend = "no_data";
    if (hasData && enoughForTrend) {
      const er = earlierWith / earlier.length;
      const rr = recentWith / recent.length;
      trend = rr < er - 0.001 ? "improving" : rr > er + 0.001 ? "regressing" : "steady";
    } else if (hasData) {
      trend = "steady";
    }

    const evidence = hasData
      ? `Flagged in ${recentWith}/${recent.length || total} recent vs ${earlierWith}/${earlier.length} earlier sessions`
      : total > 0
        ? "No issues flagged yet"
        : "No practice yet";

    return {
      dimension: dim,
      label: DIMENSION_LABEL[dim],
      hasData,
      recentWith,
      recentCount: recent.length,
      earlierWith,
      earlierCount: earlier.length,
      trend,
      evidence,
    };
  });

  const avg = (arr: SessionAgg[]) => {
    const all = arr.flatMap((s) => s.wordCounts);
    if (all.length === 0) return 0;
    return Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  };
  const earlierAvg = avg(earlier);
  const recentAvg = avg(recent);
  const lengthTrend = {
    earlierAvgWords: earlierAvg,
    recentAvgWords: recentAvg,
    direction:
      recentAvg < earlierAvg ? ("shorter" as const)
      : recentAvg > earlierAvg ? ("longer" as const)
      : ("same" as const),
    hasData: enoughForTrend && earlierAvg > 0 && recentAvg > 0,
  };

  const recurringMistakes: RecurringMistake[] = listMemoriesWithEvidence()
    .filter((m) => m.occurrenceCount >= 2)
    .slice(0, 8)
    .map((m) => {
      const dim = CODE_TO_DIMENSION[m.key];
      return {
        title: m.description,
        occurrences: m.occurrenceCount,
        status: MEMORY_STATUS_LABEL[m.liveStatus],
        // Earliest + latest example = a rough before/after (§51).
        examples: [
          m.evidence[m.evidence.length - 1]?.evidence,
          m.evidence[0]?.evidence,
        ].filter((x): x is string => !!x),
        suggestedPractice: dim
          ? DIMENSION_PRACTICE[dim]
          : "Practice this in a short, focused session.",
      };
    });

  return { totalSessions: total, dimensions, lengthTrend, recurringMistakes };
}
