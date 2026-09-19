import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * End-to-end test of the individual interview loop against the mock providers
 * and a real temporary SQLite DB. Verifies the opening question is produced, an
 * answer yields senior-level feedback plus an adaptive follow-up, and the app
 * advances the pending question (§30, §33).
 */

let tmp: string;
type Service = typeof import("./individual-interview-service");
let svc: Service;

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "iv-test-"));
  process.env.AI_PROVIDER = "mock";
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  process.env.AUDIO_STORAGE_DIR = path.join(tmp, "audio");
  svc = await import("./individual-interview-service");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const fakeAudio = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);

describe("individual interview loop", () => {
  it("opens a question, evaluates an answer, and asks an adaptive follow-up", async () => {
    const { session, question } = await svc.startIndividualInterview({
      categories: ["react", "performance"],
      technologies: [],
    });
    expect(question.length).toBeGreaterThan(0);
    expect(session.pendingQuestion).toBe(question);
    expect(session.pendingKind).toBe("opening");

    const answer = await svc.submitInterviewAnswer({
      sessionId: session.id,
      audio: fakeAudio,
      mimeType: "audio/webm",
      clientTranscript:
        "I improved the caching strategy and it got faster to make it faster.",
    });
    expect(answer.ok).toBe(true);
    if (answer.ok) {
      expect(answer.feedback.followUpQuestion.length).toBeGreaterThan(0);
      expect(answer.feedback.followUpRationale.length).toBeGreaterThan(0);
      expect(answer.feedback.issues.length).toBeGreaterThan(0);
    }

    const state = svc.getIndividualInterviewState(session.id);
    expect(state?.turns.length).toBe(1);
    expect(state?.currentKind).toBe("followup");
    // The app advanced the pending question to the adaptive follow-up.
    if (answer.ok) {
      expect(state?.currentQuestion).toBe(answer.feedback.followUpQuestion);
    }
  });

  it("supports retry of the same question", async () => {
    const { session, question } = await svc.startIndividualInterview({
      categories: ["react"],
      technologies: [],
    });
    await svc.submitInterviewAnswer({
      sessionId: session.id,
      audio: fakeAudio,
      mimeType: "audio/webm",
      clientTranscript: "A short first attempt.",
    });
    svc.setNextQuestion(session.id, question, "retry");
    const retry = await svc.submitInterviewAnswer({
      sessionId: session.id,
      audio: fakeAudio,
      mimeType: "audio/webm",
      clientTranscript: "A more detailed second attempt with a metric: 40% faster.",
    });
    expect(retry.ok).toBe(true);
    const state = svc.getIndividualInterviewState(session.id);
    expect(state?.turns.length).toBe(2);
    expect(state?.turns[1].kind).toBe("retry");
  });
});
