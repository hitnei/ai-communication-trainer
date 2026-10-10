import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("@/infrastructure/ai/roles/vietnamese-coach", () => ({
  VIETNAMESE_COACH_PROMPT_VERSION: "test",
  runVietnameseCoach: async () => ({
    summary: "Tóm tắt.",
    strengths: [],
    issues: [
      { category: "thinking", code: "incomplete", title: "t", detail: "d" },
      { category: "communication", code: "poor_structure", title: "t", detail: "d" },
    ],
    reflectionQuestions: ["Câu hỏi?"],
    suggestions: [],
    improvedVersion: null,
    nextAction: "retry",
  }),
}));

vi.mock("@/infrastructure/ai/roles/english-coach", () => ({
  ENGLISH_COACH_PROMPT_VERSION: "test",
  runEnglishCoach: async () => ({
    summary: "Summary.",
    strengths: [],
    issues: [
      { category: "content", code: "grammar", title: "t", detail: "d", evidence: null, naturalness: null },
      { category: "english", code: "main_point_late", title: "t", detail: "d", evidence: null, naturalness: null },
    ],
    topFocusAreas: ["x"],
    improvedVersion: null,
    comparison: null,
  }),
}));

let tmp: string;

beforeAll(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "norm-test-"));
  process.env.AI_PROVIDER = "mock";
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  process.env.AUDIO_STORAGE_DIR = path.join(tmp, "audio");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("services correct issue categories before returning feedback", () => {
  it("Vietnamese attempt", async () => {
    const svc = await import("./vietnamese-coach-service");
    const session = svc.startVietnameseSession({ prompt: "p", goal: "g" });
    const res = await svc.submitVietnameseAttempt({ sessionId: session.id, answer: "một câu trả lời" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.feedback.issues.map((i) => [i.code, i.category])).toEqual([
        ["incomplete", "communication"],
        ["poor_structure", "thinking"],
      ]);
    }
  });

  it("English attempt", async () => {
    const svc = await import("./english-practice-service");
    const session = svc.startEnglishSession({ prompt: "p", goal: "g" });
    const res = await svc.submitEnglishAttempt({
      sessionId: session.id,
      audio: Buffer.from([1, 2, 3, 4]),
      mimeType: "audio/webm",
      clientTranscript: "some transcript",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.feedback.english.issues.map((i) => [i.code, i.category])).toEqual([
        ["grammar", "english"],
        ["main_point_late", "content"],
      ]);
    }
  });
});
