import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Verifies Progress is evidence-based (§49, §50, §51, §103): after several
 * sessions, the Communication Profile has per-dimension data with counts, an
 * answer-length metric, and recurring mistakes with real examples - and the
 * recommendation engine returns evidence-backed suggestions (§52).
 */

let tmp: string;
let vn: typeof import("@/application/practice/vietnamese-coach-service");
let progress: typeof import("./progress-service");
let reco: typeof import("@/application/recommendation/recommendation-service");

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "prog-test-"));
  process.env.AI_PROVIDER = "mock";
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  process.env.AUDIO_STORAGE_DIR = path.join(tmp, "audio");
  vn = await import("@/application/practice/vietnamese-coach-service");
  progress = await import("./progress-service");
  reco = await import("@/application/recommendation/recommendation-service");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function session(answer: string) {
  const s = vn.startVietnameseSession({
    exerciseType: "explain_problem",
    prompt: "Giải thích một blocker.",
    goal: "rõ ràng",
  });
  await vn.submitVietnameseAttempt({ sessionId: s.id, answer });
  vn.completeVietnameseSession(s.id);
}

describe("progress (evidence-based)", () => {
  it("builds a communication profile with dimension evidence and a length metric", async () => {
    await session("Câu trả lời rất dài dòng số một với nhiều từ ngữ thừa thãi ở đây.");
    await session("Câu hai ngắn hơn.");
    await session("Câu ba.");
    await session("Bốn.");

    const overview = progress.getProgressOverview();
    expect(overview.totalSessions).toBe(4);

    // The mock VN coach flags main_point_late (structure) + too_long (conciseness).
    const withData = overview.dimensions.filter((d) => d.hasData);
    expect(withData.length).toBeGreaterThan(0);
    const structure = overview.dimensions.find((d) => d.dimension === "structure");
    expect(structure?.hasData).toBe(true);
    expect(structure?.evidence).toMatch(/recent|earlier/);

    // Length metric is present and measurable.
    expect(overview.lengthTrend.hasData).toBe(true);
    expect(overview.lengthTrend.recentAvgWords).toBeGreaterThan(0);
  });

  it("reports recurring mistakes with concrete examples", () => {
    const overview = progress.getProgressOverview();
    expect(overview.recurringMistakes.length).toBeGreaterThan(0);
    const first = overview.recurringMistakes[0];
    expect(first.occurrences).toBeGreaterThanOrEqual(2);
    expect(first.examples.length).toBeGreaterThan(0);
    expect(first.suggestedPractice.length).toBeGreaterThan(0);
  });

  it("recommends evidence-backed practice with a reason and time", () => {
    const recs = reco.getRecommendations();
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].why.length).toBeGreaterThan(0);
    expect(recs[0].estimatedMinutes).toBeGreaterThan(0);
    // Time-aware filtering (§15): only short options for a 10-minute window.
    const short = reco.getRecommendations(10);
    expect(short.every((r) => r.estimatedMinutes <= 10)).toBe(true);
  });
});
