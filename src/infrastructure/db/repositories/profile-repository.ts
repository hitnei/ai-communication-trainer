import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { profiles } from "../schema";
import { ids } from "@/lib/ids";

export type TranscriptMode = "live" | "after";

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
};
