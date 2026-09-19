import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Verifies CV/Projects/JD (§42, §43, §44, §103): CV extraction is a reviewable
 * draft (not auto-saved), projects persist, JD analysis produces match/gap
 * requirements, and a job-specific track adds personalized questions.
 */

let tmp: string;
let profile: typeof import("./profile-service");
let projectSvc: typeof import("./project-service");
let jd: typeof import("./jd-service");
let qbank: typeof import("@/application/question/question-bank-service");

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "cv-test-"));
  process.env.AI_PROVIDER = "mock";
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  profile = await import("./profile-service");
  projectSvc = await import("./project-service");
  jd = await import("./jd-service");
  qbank = await import("@/application/question/question-bank-service");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("CV / projects / JD", () => {
  it("extracts a CV as a draft without saving it", async () => {
    const extraction = await profile.extractCvForReview("Senior FE, 6 yrs, React.");
    expect(extraction.currentRole.length).toBeGreaterThan(0);
    // Nothing persisted yet - the user must review and apply (§42).
    expect(profile.getProfile().currentRole).toBe("");
    expect(projectSvc.listProjects().length).toBe(0);

    profile.applyCv(extraction);
    expect(profile.getProfile().currentRole.length).toBeGreaterThan(0);
    expect(projectSvc.listProjects().length).toBeGreaterThan(0);
  });

  it("analyzes a JD into requirements with match status", async () => {
    const saved = await jd.analyzeAndSaveJd(
      "We need a senior React engineer to lead performance work.",
    );
    const full = jd.getJd(saved.id);
    expect(full).not.toBeNull();
    expect(full!.requirements.length).toBeGreaterThan(0);
    expect(["strong", "medium", "weak", "unknown"]).toContain(
      full!.jd.overallStatus,
    );
  });

  it("generates a job-specific track of questions into the bank", async () => {
    const before = qbank.listQuestions().length;
    const list = jd.listJds();
    const r = await jd.generateJobTrack(list[0].id, ["react", "performance"]);
    expect(r.added).toBeGreaterThan(0);
    expect(qbank.listQuestions().length).toBe(before + r.added);
  });
});
