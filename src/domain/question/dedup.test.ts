import { describe, it, expect } from "vitest";
import { isNearDuplicate, similarity, dedupeCandidates } from "./dedup";

describe("question near-duplicate detection (§38)", () => {
  it("treats reworded but equivalent questions as duplicates", () => {
    const a = "How does React re-render components?";
    const b = "Explain how React re-rendering of components works.";
    expect(similarity(a, b)).toBeGreaterThan(0.5);
    expect(isNearDuplicate(a, b)).toBe(true);
  });

  it("treats genuinely different questions as distinct", () => {
    const a = "How would you design a caching layer for a dashboard?";
    const b = "Tell me about a time you mentored a junior engineer.";
    expect(isNearDuplicate(a, b)).toBe(false);
  });

  it("filters candidates against existing and against each other", () => {
    const existing = ["How does the event loop work in JavaScript?"];
    const candidates = [
      { text: "Explain how the JavaScript event loop works." }, // dup of existing
      { text: "How would you optimize a slow React list?" }, // unique
      { text: "How would you optimise a slow React list?" }, // dup within batch
    ];
    const { kept, dropped } = dedupeCandidates(
      candidates,
      (c) => c.text,
      existing,
    );
    expect(kept.length).toBe(1);
    expect(dropped.length).toBe(2);
  });
});
