import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { profiles } from "../schema";
import type { Profile } from "@/domain/profile/types";
import { ids } from "@/lib/ids";

export type TranscriptMode = "live" | "after";

function toArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Single-user local profile. Phase 2 uses it for the persisted transcript-mode
 * preference (§21); it grows into the full profile in Phase 9.
 */
export const profileRepository = {
  getOrCreate() {
    const existing = db.select().from(profiles).limit(1).get();
    if (existing) return existing;
    const id = ids.profile();
    db.insert(profiles).values({ id, transcriptMode: "after" }).run();
    return db.select().from(profiles).where(eq(profiles.id, id)).get()!;
  },

  getTranscriptMode(): TranscriptMode {
    return (this.getOrCreate().transcriptMode as TranscriptMode) ?? "after";
  },

  setTranscriptMode(mode: TranscriptMode) {
    const profile = this.getOrCreate();
    db.update(profiles)
      .set({ transcriptMode: mode, updatedAt: new Date().toISOString() })
      .where(eq(profiles.id, profile.id))
      .run();
  },

  getProfile(): Profile {
    const row = this.getOrCreate();
    return {
      currentRole: row.currentRole ?? "",
      yearsExperience: row.yearsExperience ?? null,
      targetRole: row.targetRole ?? "Senior Frontend Engineer",
      targetMarkets: toArray(row.targetMarkets),
      primarySkills: toArray(row.primarySkills),
      secondarySkills: toArray(row.secondarySkills),
      englishGoal: row.englishGoal ?? "",
    };
  },

  updateProfile(patch: Partial<Profile>) {
    const profile = this.getOrCreate();
    db.update(profiles)
      .set({
        currentRole: patch.currentRole,
        yearsExperience: patch.yearsExperience ?? undefined,
        targetRole: patch.targetRole,
        targetMarkets: patch.targetMarkets
          ? JSON.stringify(patch.targetMarkets)
          : undefined,
        primarySkills: patch.primarySkills
          ? JSON.stringify(patch.primarySkills)
          : undefined,
        secondarySkills: patch.secondarySkills
          ? JSON.stringify(patch.secondarySkills)
          : undefined,
        englishGoal: patch.englishGoal,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(profiles.id, profile.id))
      .run();
  },
};
