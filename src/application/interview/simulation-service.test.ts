import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * End-to-end test of the full simulation state machine against mock providers.
 * Verifies: no feedback is returned during the interview (only the next
 * question), the app wraps up at the target count, and a review is produced only
 * at the end (§32).
 */

let tmp: string;
type Service = typeof import("./simulation-service");
let svc: Service;

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "sim-test-"));
  process.env.AI_PROVIDER = "mock";
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  process.env.AUDIO_STORAGE_DIR = path.join(tmp, "audio");
  svc = await import("./simulation-service");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const fakeAudio = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);

describe("full interview simulation", () => {
  it("asks questions with no mid-interview feedback and reviews only at the end", async () => {
    const { session, question, questionsTarget } = await svc.startSimulation({
      categories: ["react", "behavioral"],
      interviewType: "mixed",
      durationMinutes: 10, // target 4 questions
    });
    expect(question.length).toBeGreaterThan(0);
    expect(questionsTarget).toBe(4);

    // Answer until the app signals the interview is done.
    let done = false;
    let guard = 0;
    while (!done && guard < 12) {
      guard++;
      const r = await svc.submitSimulationAnswer({
        sessionId: session.id,
        audio: fakeAudio,
        mimeType: "audio/webm",
        clientTranscript: `Answer number ${guard} with some detail.`,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        // No feedback is ever returned during the interview.
        expect(r).not.toHaveProperty("feedback");
        done = r.done;
      }
    }
    expect(done).toBe(true);
    expect(guard).toBe(4); // wrapped at the target count

    // Review is available only after finishing.
    const state = svc.getSimulationState(session.id);
    expect(state?.review).toBeNull();

    const { review } = await svc.finishSimulation(session.id);
    expect(review).not.toBeNull();
    expect(review?.readiness).toBeTruthy();
    expect(review?.topFocusAreas.length ?? 0).toBeGreaterThan(0);

    const after = svc.getSimulationState(session.id);
    expect(after?.session.status).toBe("completed");
    expect(after?.review).not.toBeNull();
  });
});
