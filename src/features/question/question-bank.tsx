"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Trash2, Pencil, Check, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { INTERVIEW_CATEGORIES, CATEGORY_LABEL } from "@/domain/interview/types";
import {
  DIFFICULTIES,
  QUESTION_STATUSES,
  QUESTION_STATUS_LABEL,
  REMOVAL_REASONS,
  REMOVAL_REASON_LABEL,
  type Difficulty,
  type Question,
  type QuestionCandidate,
} from "@/domain/question/types";
import {
  generateQuestionsAction,
  addQuestionsAction,
  updateQuestionTextAction,
  setQuestionStatusAction,
  removeQuestionAction,
  type GenerateActionResult,
} from "@/app/questions/actions";

const selectCls =
  "h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function QuestionBank({ initial }: { initial: Question[] }) {
  const router = useRouter();
  const [showGenerate, setShowGenerate] = useState(initial.length === 0);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filtered = useMemo(() => {
    return initial.filter((q) => {
      if (search && !q.text.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filterCategory && !q.categories.includes(filterCategory)) return false;
      if (filterStatus && q.status !== filterStatus) return false;
      return true;
    });
  }, [initial, search, filterCategory, filterStatus]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Question Bank</h1>
          <p className="text-muted-foreground">
            Build a personalized set of interview questions. Combine categories,
            generate in batches, and keep only the ones worth practicing.
          </p>
        </div>
        <Button onClick={() => setShowGenerate((s) => !s)}>
          <Sparkles className="size-4" /> Generate
        </Button>
      </header>

      {showGenerate && (
        <GeneratePanel
          onAdded={() => {
            setShowGenerate(false);
            router.refresh();
          }}
        />
      )}

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions…"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className={selectCls + " h-9"}
        >
          <option value="">All categories</option>
          {INTERVIEW_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={selectCls + " h-9"}
        >
          <option value="">All statuses</option>
          {QUESTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {QUESTION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {initial.length === 0
              ? "No questions yet. Generate a batch to get started."
              : "No questions match your search."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <QuestionRow key={q.id} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function GeneratePanel({ onAdded }: { onAdded: () => void }) {
  const [, startTransition] = useTransition();
  const [categories, setCategories] = useState<string[]>(["react", "behavioral"]);
  const [difficulty, setDifficulty] = useState<Difficulty>("senior");
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateActionResult | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);

  function toggleCat(key: string) {
    setCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function generate() {
    setGenerating(true);
    setResult(null);
    const r = await generateQuestionsAction({ categories, difficulty, count });
    setResult(r);
    if (r.ok) setChecked(new Set(r.candidates.map((_, i) => i)));
    setGenerating(false);
  }

  function add() {
    if (!result?.ok) return;
    const chosen = result.candidates.filter((_, i) => checked.has(i));
    if (chosen.length === 0) return;
    setAdding(true);
    startTransition(async () => {
      await addQuestionsAction(chosen as QuestionCandidate[]);
      setAdding(false);
      onAdded();
    });
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Generate questions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {INTERVIEW_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => toggleCat(c.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                categories.includes(c.key)
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            Difficulty
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className={selectCls}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Count
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className={selectCls}
            >
              {[5, 10, 15].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            onClick={generate}
            disabled={generating || categories.length === 0}
          >
            {generating ? (
              <>
                <Spinner /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Generate {count}
              </>
            )}
          </Button>
        </div>

        {result && !result.ok && (
          <p className="text-sm text-destructive">{result.message}</p>
        )}

        {result?.ok && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {result.candidates.length} to review · select the ones to keep
              </span>
              {result.duplicatesFiltered > 0 && (
                <span>{result.duplicatesFiltered} near-duplicate(s) filtered</span>
              )}
            </div>

            {result.candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Everything generated was too similar to what you already have.
                Try different categories or generate again.
              </p>
            ) : (
              <div className="space-y-2">
                {result.candidates.map((c, i) => (
                  <label
                    key={i}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/20 p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(i)}
                      onChange={(e) => {
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          return next;
                        });
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span>{c.text}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {c.categories.map((cat) => (
                          <Badge key={cat} variant="muted">
                            {CATEGORY_LABEL[cat] ?? cat}
                          </Badge>
                        ))}
                        <Badge variant="secondary">{c.difficulty}</Badge>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={add} disabled={adding || checked.size === 0}>
                {adding ? (
                  <>
                    <Spinner /> Adding…
                  </>
                ) : (
                  <>
                    <Plus className="size-4" /> Add selected ({checked.size})
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={generate}
                disabled={generating}
              >
                Generate more
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionRow({ q }: { q: Question }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.text);
  const [removing, setRemoving] = useState(false);

  function save() {
    setEditing(false);
    startTransition(async () => {
      await updateQuestionTextAction(q.id, text);
      router.refresh();
    });
  }

  function changeStatus(status: string) {
    startTransition(async () => {
      await setQuestionStatusAction(q.id, status);
      router.refresh();
    });
  }

  function remove(reason: string) {
    setRemoving(false);
    startTransition(async () => {
      await removeQuestionAction(q.id, reason);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {editing ? (
          <div className="space-y-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={save}>
                <Check className="size-4" /> Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setText(q.text);
                  setEditing(false);
                }}
              >
                <X className="size-4" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm">{q.text}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {q.categories.map((c) => (
            <Badge key={c} variant="muted">
              {CATEGORY_LABEL[c] ?? c}
            </Badge>
          ))}
          <Badge variant="secondary">{q.difficulty}</Badge>
          <select
            value={q.status}
            onChange={(e) => changeStatus(e.target.value)}
            className={selectCls + " ml-auto"}
          >
            {QUESTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUESTION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {!editing && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Edit"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remove"
            onClick={() => setRemoving((r) => !r)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {removing && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Why remove it? (helps future generation)
            </p>
            <div className="flex flex-wrap gap-2">
              {REMOVAL_REASONS.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant="outline"
                  onClick={() => remove(r)}
                >
                  {REMOVAL_REASON_LABEL[r]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
