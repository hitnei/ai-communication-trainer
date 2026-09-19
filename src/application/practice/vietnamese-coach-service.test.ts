import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * End-to-end test of the Vietnamese coaching loop against the mock AI provider
 * and a real (temporary) SQLite DB. Verifies the Phase 1 acceptance criteria
 * (§103): the full rewrite is withheld until attempt 3+.
 */

let tmp: string;
type Service = typeof import("./vietnamese-coach-service");
let svc: Service;

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "act-test-"));
  process.env.AI_PROVIDER = "mock";
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  svc = await import("./vietnamese-coach-service");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("Vietnamese coaching loop", () => {
  it("withholds the full rewrite until attempt 3", async () => {
    const session = svc.startVietnameseSession({
      exerciseType: "explain_problem",
      prompt: "Giải thích một blocker kỹ thuật.",
      goal: "Rõ ràng, ngắn gọn",
    });

    const a1 = await svc.submitVietnameseAttempt({
      sessionId: session.id,
      answer: "Ừ thì cái màn hình danh sách nó chậm, à mà tại vì nhiều thứ lắm...",
    });
    expect(a1.ok).toBe(true);
    if (a1.ok) {
      expect(a1.attemptNumber).toBe(1);
      expect(a1.policy.stage).toBe("diagnose");
      expect(a1.feedback.improvedVersion).toBeNull(); // no rewrite yet
    }

    const a2 = await svc.submitVietnameseAttempt({
      sessionId: session.id,
      answer: "Màn hình danh sách tải chậm vì gọi nhiều API tuần tự.",
    });
    expect(a2.ok).toBe(true);
    if (a2.ok) {
      expect(a2.attemptNumber).toBe(2);
      expect(a2.policy.stage).toBe("guide");
      expect(a2.feedback.improvedVersion).toBeNull(); // still no rewrite
    }

    const a3 = await svc.submitVietnameseAttempt({
      sessionId: session.id,
      answer: "Vấn đề: danh sách tải chậm do gọi API tuần tự. Cách khắc phục: gộp request.",
    });
    expect(a3.ok).toBe(true);
    if (a3.ok) {
      expect(a3.attemptNumber).toBe(3);
      expect(a3.policy.stage).toBe("improve");
      expect(a3.feedback.improvedVersion).toBeTruthy(); // rewrite now allowed
    }
  });

  it("lets the user control completion", () => {
    const session = svc.startVietnameseSession({
      prompt: "Test prompt",
      goal: "test",
    });
    svc.completeVietnameseSession(session.id);
    const state = svc.getSessionState(session.id);
    expect(state?.session.status).toBe("completed");
  });
});
