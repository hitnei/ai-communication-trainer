import { describe, it, expect } from "vitest";
import { initialSrs, schedule, MATURE_INTERVAL_DAYS } from "./srs";

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("spaced repetition engine (§57)", () => {
  it("starts new and due now", () => {
    const s = initialSrs(NOW);
    expect(s.state).toBe("new");
    expect(s.reps).toBe(0);
  });

  it("graduates a new card to review on 'good'", () => {
    const s = schedule(initialSrs(NOW), "good", NOW);
    expect(s.state).toBe("review");
    expect(s.intervalDays).toBe(1);
    expect(s.reps).toBe(1);
  });

  it("keeps a card learning and due soon on 'again'", () => {
    const s = schedule(initialSrs(NOW), "again", NOW);
    expect(s.state).toBe("learning");
    expect(new Date(s.dueAt).getTime()).toBeGreaterThan(NOW.getTime());
    // due within a few minutes, not days
    expect(new Date(s.dueAt).getTime() - NOW.getTime()).toBeLessThan(60 * 60_000);
  });

  it("lengthens intervals with repeated 'good' and eventually matures", () => {
    let s = schedule(initialSrs(NOW), "good", NOW); // interval 1, review
    for (let i = 0; i < 6; i++) s = schedule(s, "good", NOW);
    expect(s.intervalDays).toBeGreaterThanOrEqual(MATURE_INTERVAL_DAYS);
    expect(s.state).toBe("mature");
  });

  it("lapses a mature card back to learning on 'again' and lowers ease", () => {
    let s = schedule(initialSrs(NOW), "easy", NOW);
    for (let i = 0; i < 6; i++) s = schedule(s, "good", NOW);
    const beforeEase = s.ease;
    const lapsed = schedule(s, "again", NOW);
    expect(lapsed.state).toBe("learning");
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.ease).toBeLessThan(beforeEase);
  });
});
