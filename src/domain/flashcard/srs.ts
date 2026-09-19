import type { FlashcardState, ReviewRating } from "./types";

/**
 * SpacedRepetitionEngine (§57) - an SM-2 variant tracking
 * new → learning → review → mature. The rating already reflects recall; lapses
 * and ease capture previous failures; intervalDays captures time since review.
 * Pronunciation/naturalness from a speaking check can lower the rating upstream.
 *
 * Pure and deterministic: `now` is injected so it is easy to test.
 */

export interface SrsState {
  state: FlashcardState;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: string;
}

export const MIN_EASE = 1.3;
export const MATURE_INTERVAL_DAYS = 21;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export function initialSrs(now: Date): SrsState {
  return {
    state: "new",
    ease: 2.5,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    dueAt: now.toISOString(),
  };
}

function due(now: Date, ms: number): string {
  return new Date(now.getTime() + ms).toISOString();
}

export function schedule(
  prev: SrsState,
  rating: ReviewRating,
  now: Date,
): SrsState {
  const learning = prev.state === "new" || prev.state === "learning";

  if (learning) {
    switch (rating) {
      case "again":
        return { ...prev, state: "learning", intervalDays: 0, dueAt: due(now, MINUTE) };
      case "hard":
        return { ...prev, state: "learning", intervalDays: 0, dueAt: due(now, 6 * MINUTE) };
      case "good":
        return {
          ...prev,
          state: "review",
          intervalDays: 1,
          reps: prev.reps + 1,
          dueAt: due(now, DAY),
        };
      case "easy":
        return {
          ...prev,
          state: "review",
          intervalDays: 4,
          reps: prev.reps + 1,
          dueAt: due(now, 4 * DAY),
        };
    }
  }

  // review / mature
  switch (rating) {
    case "again": {
      const ease = Math.max(MIN_EASE, prev.ease - 0.2);
      return {
        state: "learning",
        ease,
        intervalDays: 0,
        reps: prev.reps,
        lapses: prev.lapses + 1,
        dueAt: due(now, 10 * MINUTE),
      };
    }
    case "hard": {
      const ease = Math.max(MIN_EASE, prev.ease - 0.15);
      const interval = Math.max(1, Math.round(prev.intervalDays * 1.2));
      return settle({ ...prev, ease, intervalDays: interval, reps: prev.reps + 1 }, now);
    }
    case "good": {
      const interval = Math.max(1, Math.round(prev.intervalDays * prev.ease));
      return settle({ ...prev, intervalDays: interval, reps: prev.reps + 1 }, now);
    }
    case "easy": {
      const ease = prev.ease + 0.15;
      const interval = Math.max(1, Math.round(prev.intervalDays * ease * 1.3));
      return settle({ ...prev, ease, intervalDays: interval, reps: prev.reps + 1 }, now);
    }
  }
}

function settle(s: SrsState, now: Date): SrsState {
  const state: FlashcardState =
    s.intervalDays >= MATURE_INTERVAL_DAYS ? "mature" : "review";
  return { ...s, state, dueAt: due(now, s.intervalDays * DAY) };
}
