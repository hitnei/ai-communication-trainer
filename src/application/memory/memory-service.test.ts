import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Verifies the "remember -> adapt" behaviour (§45-§48, §103):
 * - A single occurrence stays a candidate, not a confirmed weakness (§47).
 * - The SAME issue across 3 sessions becomes a confirmed, recurring pattern.
 * - Confirmed patterns are retrievable and summarised for future prompts (§48),
 *   so future practice adapts.
 */

let tmp: string;
let vn: typeof import("@/application/practice/vietnamese-coach-service");
let mem: typeof import("./memory-service");

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "mem-test-"));
  process.env.AI_PROVIDER = "mock"; // mock VN coach always reports main_point_late
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  process.env.AUDIO_STORAGE_DIR = path.join(tmp, "audio");
  vn = await import("@/application/practice/vietnamese-coach-service");
  mem = await import("./memory-service");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function runVietnameseSession(answer: string) {
  const session = vn.startVietnameseSession({
    exerciseType: "explain_problem",
    prompt: "Giải thích một blocker.",
    goal: "rõ ràng",
  });
  await vn.submitVietnameseAttempt({ sessionId: session.id, answer });
  vn.completeVietnameseSession(session.id); // triggers memory extraction
  return session.id;
}

describe("personal memory: remember and adapt", () => {
  it("keeps a single occurrence as a candidate, not a recurring weakness", async () => {
    await runVietnameseSession("Câu trả lời lộn xộn số 1.");
    const memories = mem.listMemories();
    const mainPoint = memories.find((m) => m.key === "main_point_late");
    expect(mainPoint).toBeTruthy();
    expect(mainPoint?.occurrenceCount).toBe(1);
    expect(mainPoint?.liveStatus).toBe("candidate");
  });

  it("promotes to a confirmed pattern after recurring across sessions", async () => {
    await runVietnameseSession("Câu trả lời lộn xộn số 2.");
    await runVietnameseSession("Câu trả lời lộn xộn số 3.");
    const mainPoint = mem
      .listMemories()
      .find((m) => m.key === "main_point_late");
    expect(mainPoint?.occurrenceCount).toBe(3);
    expect(mainPoint?.liveStatus).toBe("confirmed");
  });

  it("surfaces confirmed patterns in the summary fed to future coaching", () => {
    const summary = mem.buildMemorySummary(["communication_pattern"]);
    expect(summary).toBeTruthy();
    expect(summary).toContain("main point");
  });

  it("can be inspected with evidence and deleted", () => {
    const withEvidence = mem.listMemoriesWithEvidence();
    const mainPoint = withEvidence.find((m) => m.key === "main_point_late");
    expect((mainPoint?.evidence.length ?? 0) >= 3).toBe(true);

    mem.deleteMemory(mainPoint!.id);
    expect(
      mem.listMemories().find((m) => m.key === "main_point_late"),
    ).toBeUndefined();
  });
});
