import "server-only";
import { initialSrs, schedule, type SrsState } from "@/domain/flashcard/srs";
import type { Flashcard, ReviewRating } from "@/domain/flashcard/types";
import { isNearDuplicate } from "@/domain/question/dedup";
import { suggestPhrases } from "@/infrastructure/ai/roles/flashcard-suggestor";
import { flashcardRepository } from "@/infrastructure/db/repositories/flashcard-repository";
import { practiceRepository } from "@/infrastructure/db/repositories/practice-repository";
import { interviewRepository } from "@/infrastructure/db/repositories/interview-repository";
import { logger } from "@/lib/logger";

/**
 * Application service for the speaking phrase bank (§53-§57). Suggestions are
 * NEVER auto-added (§54): the AI proposes, they're stored as pending, and the
 * user decides. The SpacedRepetitionEngine lives in the domain (srs.ts).
 */

/** Pull the user's most recent spoken answers to mine for phrases (§55). */
function recentTranscripts(maxAnswers = 8): string {
  const out: string[] = [];

  const english = practiceRepository
    .listAllSessions()
    .filter((s) => s.mode === "english")
    .reverse();
  for (const s of english) {
    for (const a of practiceRepository.listAttempts(s.id)) {
      if (a.attempt.textAnswer) out.push(a.attempt.textAnswer);
    }
    if (out.length >= maxAnswers) break;
  }

  const interviews = interviewRepository.listAllSessions().reverse();
  for (const s of interviews) {
    for (const t of interviewRepository.listTurns(s.id)) {
      if (t.turn.answer) out.push(t.turn.answer);
    }
    if (out.length >= maxAnswers) break;
  }

  return out.slice(0, maxAnswers).join("\n\n");
}

export interface SuggestResult {
  added: number;
  message?: string;
}

async function runSuggestions(context: string): Promise<SuggestResult> {
  if (!context.trim()) {
    return {
      added: 0,
      message:
        "No recent spoken answers to learn from yet. Do some English or interview practice first, or add a phrase manually.",
    };
  }
  try {
    const suggestions = await suggestPhrases({ context });
    const avoid = [
      ...flashcardRepository.cardPhrases(),
      ...flashcardRepository.pendingSuggestionPhrases(),
    ];
    let added = 0;
    for (const s of suggestions) {
      if (avoid.some((a) => isNearDuplicate(s.phrase, a))) continue;
      flashcardRepository.createSuggestion({
        phrase: s.phrase,
        replacementFor: s.replacementFor,
        meaning: s.meaning,
        example: s.example,
        reason: s.reason,
        source: "ai",
      });
      avoid.push(s.phrase);
      added++;
    }
    return {
      added,
      message: added === 0 ? "No new phrases to suggest right now." : undefined,
    };
  } catch (e) {
    logger.error("flashcard_suggest_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { added: 0, message: "Couldn't generate suggestions just now." };
  }
}

export function generateSuggestionsFromRecent(): Promise<SuggestResult> {
  return runSuggestions(recentTranscripts());
}

export function generateSuggestionsFromText(text: string): Promise<SuggestResult> {
  return runSuggestions(text);
}

export function listPendingSuggestions() {
  return flashcardRepository.listSuggestions("pending");
}

/** User accepts a suggestion → it becomes a new card (§54). */
export function addSuggestion(id: string): Flashcard | null {
  const s = flashcardRepository.getSuggestion(id);
  if (!s || s.status !== "pending") return null;
  const card = flashcardRepository.createCard({
    phrase: s.phrase,
    meaning: s.meaning,
    example: s.example,
    srs: initialSrs(new Date()),
  });
  flashcardRepository.setSuggestionStatus(id, "added");
  return card;
}

export function dismissSuggestion(id: string): void {
  flashcardRepository.setSuggestionStatus(id, "dismissed");
}

export function addManualCard(input: {
  phrase: string;
  meaning: string;
  example: string;
}): Flashcard {
  return flashcardRepository.createCard({
    ...input,
    srs: initialSrs(new Date()),
  });
}

export function listCards(): Flashcard[] {
  return flashcardRepository.listCards();
}

export function getDueCards(): Flashcard[] {
  return flashcardRepository.listDue(new Date().toISOString());
}

export function reviewCard(id: string, rating: ReviewRating): Flashcard | null {
  const card = flashcardRepository.getCard(id);
  if (!card) return null;
  const prev: SrsState = {
    state: card.state,
    ease: card.ease,
    intervalDays: card.intervalDays,
    reps: card.reps,
    lapses: card.lapses,
    dueAt: card.dueAt,
  };
  const now = new Date();
  const next = schedule(prev, rating, now);
  flashcardRepository.applyReview(id, next, now.toISOString());
  flashcardRepository.addReview(id, rating);
  return flashcardRepository.getCard(id);
}

export function deleteCard(id: string): void {
  flashcardRepository.deleteCard(id);
}
