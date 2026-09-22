"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquareText, UsersRound, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EXERCISE_LABELS } from "@/domain/practice/types";
import {
  CATEGORY_LABEL,
  INTERVIEW_TYPE_LABEL,
} from "@/domain/interview/types";
import type {
  PracticeHistoryItem,
  InterviewHistoryItem,
} from "@/application/history/history-service";

type Tab = "practice" | "interviews";

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge variant="success">Completed</Badge>;
  return <Badge variant="muted">Abandoned</Badge>;
}

export function HistoryView({
  practice,
  interviews,
}: {
  practice: PracticeHistoryItem[];
  interviews: InterviewHistoryItem[];
}) {
  const [tab, setTab] = useState<Tab>("practice");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "practice", label: "Practice", count: practice.length },
    { key: "interviews", label: "Interviews", count: interviews.length },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-muted-foreground">
          Every session you&apos;ve done. Open one to review your attempts and
          the feedback you got.
        </p>
      </header>

      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "practice" ? (
        practice.length === 0 ? (
          <EmptyState label="No practice sessions yet." />
        ) : (
          <div className="space-y-3">
            {practice.map((item) => (
              <PracticeRow key={item.session.id} item={item} />
            ))}
          </div>
        )
      ) : interviews.length === 0 ? (
        <EmptyState label="No interviews yet." />
      ) : (
        <div className="space-y-3">
          {interviews.map((item) => (
            <InterviewRow key={item.session.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="pt-6 text-sm text-muted-foreground">
        {label}
      </CardContent>
    </Card>
  );
}

function PracticeRow({ item }: { item: PracticeHistoryItem }) {
  const { session, attemptCount, startedAtLabel } = item;
  const modeLabel = session.mode === "vietnamese" ? "Vietnamese" : "English";
  const href = `/practice/${session.mode}?session=${session.id}`;

  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex items-start gap-3 pt-6">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{modeLabel}</Badge>
              {session.exerciseType && (
                <Badge variant="muted">
                  {EXERCISE_LABELS[session.exerciseType]}
                </Badge>
              )}
              <StatusBadge status={session.status} />
            </div>
            <p className="truncate text-sm">{session.prompt}</p>
            <p className="text-xs text-muted-foreground">
              {startedAtLabel} · {attemptCount}{" "}
              {attemptCount === 1 ? "attempt" : "attempts"}
            </p>
          </div>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

function InterviewRow({ item }: { item: InterviewHistoryItem }) {
  const { session, turnCount, startedAtLabel } = item;
  const modeLabel =
    session.mode === "individual" ? "Individual" : "Full Simulation";
  const href = `/interview/${session.mode}?session=${session.id}`;
  const descriptor = session.interviewType
    ? INTERVIEW_TYPE_LABEL[session.interviewType] ?? session.interviewType
    : session.categories.map((c) => CATEGORY_LABEL[c] ?? c).join(", ");

  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex items-start gap-3 pt-6">
          <UsersRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{modeLabel}</Badge>
              <StatusBadge status={session.status} />
            </div>
            {descriptor && <p className="truncate text-sm">{descriptor}</p>}
            <p className="text-xs text-muted-foreground">
              {startedAtLabel} · {turnCount}{" "}
              {turnCount === 1 ? "question" : "questions"}
            </p>
          </div>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
