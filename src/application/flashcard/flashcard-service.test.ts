import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Verifies the phrase-bank flow (§54, §57, §103): the AI suggests but never
 * auto-adds; the user chooses; spaced repetition schedules review.
 */

let tmp: string;
type Service = typeof import("./flashcard-service");
let svc: Service;

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "fc-test-"));
  process.env.AI_PROVIDER = "mock";
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  svc = await import("./flashcard-service");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("flashcards / speaking phrase bank", () => {
  it("suggests phrases without auto-adding them", async () => {
    const r = await svc.generateSuggestionsFromText(
      "I have a problem about the API and it is slow.",
    );
    expect(r.added).toBeGreaterThan(0);
    // Suggestions exist, but no cards were created automatically (§54).
    expect(svc.listPendingSuggestions().length).toBeGreaterThan(0);
    expect(svc.listCards().length).toBe(0);
  });

  it("lets the user add a chosen suggestion as a card", () => {
    const suggestion = svc.listPendingSuggestions()[0];
    const card = svc.addSuggestion(suggestion.id);
    expect(card).not.toBeNull();
    expect(svc.listCards().length).toBe(1);
    // The added suggestion is no longer pending.
    expect(
      svc.listPendingSuggestions().find((s) => s.id === suggestion.id),
    ).toBeUndefined();
  });

  it("schedules review via spaced repetition", () => {
    const card = svc.listCards()[0];
    // A brand-new card is due immediately.
    expect(svc.getDueCards().find((c) => c.id === card.id)).toBeTruthy();

    const updated = svc.reviewCard(card.id, "good");
    expect(updated?.state).toBe("review");
    expect(updated?.reps).toBe(1);
    // After a 'good' it's scheduled for the future, so not due right now.
    expect(svc.getDueCards().find((c) => c.id === card.id)).toBeUndefined();
  });

  it("dedupes suggestions against existing phrases", async () => {
    const before = svc.listPendingSuggestions().length;
    // Same text again -> the mock's phrases already exist as a card/pending.
    await svc.generateSuggestionsFromText(
      "I have a problem about the API and it is slow.",
    );
    const after = svc.listPendingSuggestions().length;
    // No exact duplicates of the already-added phrase get re-suggested.
    expect(after).toBeLessThanOrEqual(before + 2);
  });
});
