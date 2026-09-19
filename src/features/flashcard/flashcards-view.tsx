"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Plus,
  Trash2,
  Check,
  X,
  Mic,
  Volume2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type {
  Flashcard,
  PhraseSuggestion,
  ReviewRating,
} from "@/domain/flashcard/types";
import {
  FLASHCARD_STATE_LABEL,
  SUGGESTION_REASON_LABEL,
} from "@/domain/flashcard/types";
import type { PronunciationFeedback } from "@/domain/practice/english-feedback";
import { AudioRecorder } from "@/features/practice/english/audio-recorder";
import {
  suggestFromRecentAction,
  suggestFromTextAction,
  addSuggestionAction,
  dismissSuggestionAction,
  addManualCardAction,
  reviewCardAction,
  deleteCardAction,
} from "@/app/flashcards/actions";

const RATINGS: { rating: ReviewRating; label: string }[] = [
  { rating: "again", label: "Again" },
  { rating: "hard", label: "Hard" },
  { rating: "good", label: "Good" },
  { rating: "easy", label: "Easy" },
];

export function FlashcardsView({
  due,
  suggestions,
  cards,
}: {
  due: Flashcard[];
  suggestions: PhraseSuggestion[];
  cards: Flashcard[];
}) {
  return (
    <div className="space-y-8">
      <SuggestBar />
      <ReviewSection due={due} />
      <SuggestionsSection suggestions={suggestions} />
      <AllCards cards={cards} />
    </div>
  );
}

function SuggestBar() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ added: number; message?: string }>) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setMsg(
        r.added > 0
          ? `Added ${r.added} suggestion${r.added === 1 ? "" : "s"} to review below.`
          : (r.message ?? "No new suggestions."),
      );
      router.refresh();
    });
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Suggest phrases from your speaking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The coach mines your recent answers for useful phrases and more natural
          alternatives. You decide which become cards - nothing is added
          automatically.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => run(suggestFromRecentAction)}
            disabled={pending}
          >
            {pending ? <Spinner /> : <Sparkles className="size-4" />} From recent
            practice
          </Button>
        </div>
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="…or paste something you said / wrote to mine for phrases."
            className="min-h-16"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => run(() => suggestFromTextAction(text))}
            disabled={pending || !text.trim()}
          >
            <Sparkles className="size-4" /> Suggest from this text
          </Button>
        </div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}

function ReviewSection({ due }: { due: Flashcard[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  if (due.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Due for review
        </h2>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Nothing due right now. Add some phrases and come back later.
          </CardContent>
        </Card>
      </section>
    );
  }

  if (index >= due.length) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Due for review
        </h2>
        <Card className="border-success/40 bg-success/5">
          <CardContent className="pt-6 text-sm">
            All caught up for now. Nice.
          </CardContent>
        </Card>
      </section>
    );
  }

  const card = due[index];

  function rate(rating: ReviewRating) {
    startTransition(async () => {
      await reviewCardAction(card.id, rating);
      setRevealed(false);
      setIndex((i) => i + 1);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Due for review
        </h2>
        <span className="text-xs text-muted-foreground">
          {index + 1} / {due.length}
        </span>
      </div>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-lg font-medium">{card.phrase}</p>

          <SpeakCheck phrase={card.phrase} />

          {revealed ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              {card.meaning && (
                <p>
                  <span className="font-medium">Meaning: </span>
                  {card.meaning}
                </p>
              )}
              {card.example && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Example: </span>
                  {card.example}
                </p>
              )}
            </div>
          ) : (
            <Button variant="outline" onClick={() => setRevealed(true)}>
              Show meaning & example
            </Button>
          )}

          {revealed && (
            <div className="flex flex-wrap gap-2">
              {RATINGS.map((r) => (
                <Button
                  key={r.rating}
                  size="sm"
                  variant={r.rating === "again" ? "destructive" : "outline"}
                  onClick={() => rate(r.rating)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function SpeakCheck({ phrase }: { phrase: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PronunciationFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);

  async function submit(blob: Blob) {
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("phrase", phrase);
      form.set("audio", blob, "phrase.webm");
      const res = await fetch("/api/flashcards/speak", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (json.ok) setResult(json.pronunciation as PronunciationFeedback);
      else setError(json.message ?? "Couldn't analyze that.");
      setRecorderKey((k) => k + 1);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Mic className="size-4" /> Speak &amp; check pronunciation
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <AudioRecorder
        key={recorderKey}
        transcriptMode="after"
        submitting={submitting}
        onSubmit={(blob) => submit(blob)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="text-sm">
          <div className="mb-1 flex items-center gap-2">
            <Volume2 className="size-4 text-primary" />
            {result.intelligibility && (
              <Badge variant="secondary">
                {result.intelligibility.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{result.summary}</p>
          {result.flaggedWords.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {result.flaggedWords.map((w, i) => (
                <li key={i}>
                  <span className="font-medium">{w.word}</span>
                  <span className="text-muted-foreground"> - {w.note}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionsSection({
  suggestions,
}: {
  suggestions: PhraseSuggestion[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  if (suggestions.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Suggested phrases ({suggestions.length})
      </h2>
      <div className="space-y-3">
        {suggestions.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-2 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Badge variant="muted">
                    {SUGGESTION_REASON_LABEL[s.reason]}
                  </Badge>
                  {s.replacementFor && (
                    <p className="text-sm text-muted-foreground line-through">
                      {s.replacementFor}
                    </p>
                  )}
                  <p className="font-medium">{s.phrase}</p>
                  {s.meaning && (
                    <p className="text-sm text-muted-foreground">{s.meaning}</p>
                  )}
                  {s.example && (
                    <p className="text-sm italic text-muted-foreground">
                      &ldquo;{s.example}&rdquo;
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    startTransition(async () => {
                      await addSuggestionAction(s.id);
                      router.refresh();
                    })
                  }
                >
                  <Plus className="size-4" /> Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    startTransition(async () => {
                      await dismissSuggestionAction(s.id);
                      router.refresh();
                    })
                  }
                >
                  <X className="size-4" /> Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function AllCards({ cards }: { cards: Flashcard[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");

  function addManual() {
    if (!phrase.trim()) return;
    startTransition(async () => {
      await addManualCardAction({ phrase, meaning, example });
      setPhrase("");
      setMeaning("");
      setExample("");
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          All phrases ({cards.length})
        </h2>
        <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
          <Plus className="size-4" /> Add manually
        </Button>
      </div>

      {adding && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="Phrase"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="Meaning (optional)"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="Example (optional)"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button size="sm" onClick={addManual} disabled={!phrase.trim()}>
              <Check className="size-4" /> Add card
            </Button>
          </CardContent>
        </Card>
      )}

      {cards.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No phrases yet. Generate suggestions above or add one manually.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {cards.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-start justify-between gap-3 pt-6">
                <div className="space-y-1">
                  <p className="font-medium">{c.phrase}</p>
                  {c.meaning && (
                    <p className="text-sm text-muted-foreground">{c.meaning}</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="muted">
                      {FLASHCARD_STATE_LABEL[c.state]}
                    </Badge>
                    {c.reps > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <RotateCcw className="size-3" /> {c.reps} review
                        {c.reps === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteCardAction(c.id);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
