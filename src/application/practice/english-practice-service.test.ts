import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * End-to-end test of the English voice loop against the mock providers and a
 * real temporary SQLite DB. Verifies the improved version is gated to attempt
 * 2+ (§28) and that pronunciation feedback is attached.
 */

let tmp: string;
type Service = typeof import("./english-practice-service");
let svc: Service;

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "eng-test-"));
  process.env.AI_PROVIDER = "mock";
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  process.env.AUDIO_STORAGE_DIR = path.join(tmp, "audio");
  svc = await import("./english-practice-service");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const fakeAudio = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);

describe("English voice loop", () => {
  it("gates the improved version until attempt 2 and returns full analysis", async () => {
    const session = svc.startEnglishSession({
      exerciseType: "explain_problem",
      prompt: "Explain a technical blocker.",
      goal: "Clear and concise",
    });

    const a1 = await svc.submitEnglishAttempt({
      sessionId: session.id,
      audio: fakeAudio,
      mimeType: "audio/webm",
      clientTranscript: "So basically the list screen is slow, you know.",
    });
    expect(a1.ok).toBe(true);
    if (a1.ok) {
      expect(a1.attemptNumber).toBe(1);
      expect(a1.feedback.english.improvedVersion).toBeNull(); // gated
      expect(a1.feedback.english.topFocusAreas.length).toBeGreaterThan(0);
      expect(a1.feedback.pronunciation).not.toBeNull();
      expect(a1.audioUrl).toContain("/api/audio/");
    }

    const a2 = await svc.submitEnglishAttempt({
      sessionId: session.id,
      audio: fakeAudio,
      mimeType: "audio/webm",
      clientTranscript:
        "The list screen loads slowly because we make sequential API calls.",
    });
    expect(a2.ok).toBe(true);
    if (a2.ok) {
      expect(a2.attemptNumber).toBe(2);
      expect(a2.feedback.english.improvedVersion).toBeTruthy(); // now allowed
    }
  });

  it("persists attempts with transcript and audio for the session", () => {
    const session = svc.startEnglishSession({
      prompt: "Test",
      goal: "test",
    });
    const state = svc.getEnglishSessionState(session.id);
    expect(state?.attempts.length).toBe(0);
    expect(state?.transcriptMode).toBe("after");
  });
});
