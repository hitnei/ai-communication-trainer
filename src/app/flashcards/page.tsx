import {
  getDueCards,
  listCards,
  listPendingSuggestions,
} from "@/application/flashcard/flashcard-service";
import { FlashcardsView } from "@/features/flashcard/flashcards-view";

export const dynamic = "force-dynamic";

export default function FlashcardsPage() {
  const due = getDueCards();
  const suggestions = listPendingSuggestions();
  const cards = listCards();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Flashcards</h1>
        <p className="text-muted-foreground">
          Your speaking phrase bank - words, phrases, and expressions worth
          reusing. Review with spaced repetition and practice saying them.
        </p>
      </header>
      <FlashcardsView due={due} suggestions={suggestions} cards={cards} />
    </div>
  );
}
