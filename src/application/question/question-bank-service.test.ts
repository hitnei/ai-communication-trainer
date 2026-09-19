import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * End-to-end test of the question bank against the mock generator + a real temp
 * DB. Verifies multi-category generation, review-before-save, no repetition
 * across batches (§37, §38, §39), and removal feedback capture (§40).
 */

let tmp: string;
type Service = typeof import("./question-bank-service");
let svc: Service;

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "qb-test-"));
  process.env.AI_PROVIDER = "mock";
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  svc = await import("./question-bank-service");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("question bank", () => {
  it("generates candidates from multiple categories and saves only chosen ones", async () => {
    const { candidates } = await svc.generateQuestionCandidates({
      categories: ["react", "behavioral", "leadership"],
      count: 10,
    });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(10);

    // Review-before-save: nothing is saved until we add.
    expect(svc.listQuestions().length).toBe(0);

    svc.addQuestions(candidates.slice(0, 5));
    expect(svc.listQuestions().length).toBe(5);
  });

  it("does not re-suggest questions already in the bank (no repetition)", async () => {
    const existing = new Set(svc.listQuestions().map((q) => q.text));
    const { candidates } = await svc.generateQuestionCandidates({
      categories: ["react", "performance"],
      count: 10,
    });
    for (const c of candidates) {
      expect(existing.has(c.text)).toBe(false);
    }
  });

  it("captures a reason when a question is removed", async () => {
    const q = svc.listQuestions()[0];
    svc.removeQuestion(q.id, "too_easy");
    expect(svc.listQuestions().find((x) => x.id === q.id)).toBeUndefined();

    // The removal feedback should influence the next generation's exclusions.
    const { candidates } = await svc.generateQuestionCandidates({
      categories: ["react"],
      count: 10,
    });
    // The removed question should not come back.
    expect(candidates.find((c) => c.text === q.text)).toBeUndefined();
  });
});
