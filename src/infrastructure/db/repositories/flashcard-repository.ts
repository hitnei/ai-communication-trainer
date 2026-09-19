import "server-only";
import { asc, desc, eq, lte } from "drizzle-orm";
import { db } from "../client";
import { flashcardReviews, flashcards, phraseSuggestions } from "../schema";
import type {
  Flashcard,
  FlashcardState,
  PhraseSuggestion,
  ReviewRating,
  SuggestionReason,
  SuggestionStatus,
} from "@/domain/flashcard/types";
import type { SrsState } from "@/domain/flashcard/srs";
import { ids } from "@/lib/ids";

export const flashcardRepository = {
  createCard(input: {
    phrase: string;
    meaning: string;
    example: string;
    tags?: string[];
    srs: SrsState;
  }): Flashcard {
    const id = ids.flashcard();
    db.insert(flashcards)
      .values({
        id,
        phrase: input.phrase,
        meaning: input.meaning,
        example: input.example,
        tags: JSON.stringify(input.tags ?? []),
        state: input.srs.state,
        ease: input.srs.ease,
        intervalDays: input.srs.intervalDays,
        reps: input.srs.reps,
        lapses: input.srs.lapses,
        dueAt: input.srs.dueAt,
      })
      .run();
    return this.getCard(id)!;
  },

  getCard(id: string): Flashcard | null {
    const row = db.select().from(flashcards).where(eq(flashcards.id, id)).get();
    return row ? mapCard(row) : null;
  },

  listCards(): Flashcard[] {
    return db
      .select()
      .from(flashcards)
      .orderBy(desc(flashcards.createdAt))
      .all()
      .map(mapCard);
  },

  listDue(nowIso: string): Flashcard[] {
    return db
      .select()
      .from(flashcards)
      .where(lte(flashcards.dueAt, nowIso))
      .orderBy(asc(flashcards.dueAt))
      .all()
      .map(mapCard);
  },

  cardPhrases(): string[] {
    return db.select({ p: flashcards.phrase }).from(flashcards).all().map((r) => r.p);
  },

  updateCardText(
    id: string,
    patch: { phrase?: string; meaning?: string; example?: string },
  ): void {
    db.update(flashcards)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(flashcards.id, id))
      .run();
  },

  applyReview(id: string, srs: SrsState, reviewedAtIso: string): void {
    db.update(flashcards)
      .set({
        state: srs.state,
        ease: srs.ease,
        intervalDays: srs.intervalDays,
        reps: srs.reps,
        lapses: srs.lapses,
        dueAt: srs.dueAt,
        lastReviewedAt: reviewedAtIso,
        updatedAt: reviewedAtIso,
      })
      .where(eq(flashcards.id, id))
      .run();
  },

  addReview(flashcardId: string, rating: ReviewRating): void {
    db.insert(flashcardReviews)
      .values({ id: ids.flashcard(), flashcardId, rating })
      .run();
  },

  deleteCard(id: string): void {
    db.delete(flashcards).where(eq(flashcards.id, id)).run();
  },

  createSuggestion(input: {
    phrase: string;
    replacementFor?: string | null;
    meaning: string;
    example: string;
    reason: SuggestionReason;
    source: string;
  }): void {
    db.insert(phraseSuggestions)
      .values({
        id: ids.flashcard(),
        phrase: input.phrase,
        replacementFor: input.replacementFor,
        meaning: input.meaning,
        example: input.example,
        reason: input.reason,
        source: input.source,
        status: "pending",
      })
      .run();
  },

  getSuggestion(id: string): PhraseSuggestion | null {
    const row = db
      .select()
      .from(phraseSuggestions)
      .where(eq(phraseSuggestions.id, id))
      .get();
    return row ? mapSuggestion(row) : null;
  },

  listSuggestions(status?: SuggestionStatus): PhraseSuggestion[] {
    const rows = status
      ? db
          .select()
          .from(phraseSuggestions)
          .where(eq(phraseSuggestions.status, status))
          .orderBy(desc(phraseSuggestions.createdAt))
          .all()
      : db
          .select()
          .from(phraseSuggestions)
          .orderBy(desc(phraseSuggestions.createdAt))
          .all();
    return rows.map(mapSuggestion);
  },

  pendingSuggestionPhrases(): string[] {
    return db
      .select({ p: phraseSuggestions.phrase })
      .from(phraseSuggestions)
      .where(eq(phraseSuggestions.status, "pending"))
      .all()
      .map((r) => r.p);
  },

  setSuggestionStatus(id: string, status: SuggestionStatus): void {
    db.update(phraseSuggestions)
      .set({ status })
      .where(eq(phraseSuggestions.id, id))
      .run();
  },
};

function mapCard(row: typeof flashcards.$inferSelect): Flashcard {
  return {
    id: row.id,
    phrase: row.phrase,
    meaning: row.meaning,
    example: row.example,
    notes: row.notes,
    tags: safeArray(row.tags),
    state: row.state as FlashcardState,
    ease: row.ease,
    intervalDays: row.intervalDays,
    reps: row.reps,
    lapses: row.lapses,
    dueAt: row.dueAt,
    lastReviewedAt: row.lastReviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSuggestion(
  row: typeof phraseSuggestions.$inferSelect,
): PhraseSuggestion {
  return {
    id: row.id,
    phrase: row.phrase,
    replacementFor: row.replacementFor,
    meaning: row.meaning,
    example: row.example,
    reason: row.reason as SuggestionReason,
    source: row.source,
    status: row.status as SuggestionStatus,
    createdAt: row.createdAt,
  };
}

function safeArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
