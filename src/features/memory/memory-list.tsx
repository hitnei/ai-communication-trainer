"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MEMORY_STATUS_LABEL,
  MEMORY_TYPE_LABEL,
  type MemoryStatus,
  type MemoryType,
} from "@/domain/memory/types";
import type { MemoryWithEvidence } from "@/application/memory/memory-service";
import {
  deleteMemoryAction,
  clearAllMemoryAction,
} from "@/app/memory/actions";

const STATUS_VARIANT: Record<
  MemoryStatus,
  "secondary" | "warning" | "success" | "muted"
> = {
  candidate: "secondary",
  confirmed: "warning",
  improving: "success",
  stable: "muted",
};

function MemoryCard({ item }: { item: MemoryWithEvidence }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">
                {MEMORY_TYPE_LABEL[item.type as MemoryType] ?? item.type}
              </Badge>
              <Badge variant={STATUS_VARIANT[item.liveStatus]}>
                {MEMORY_STATUS_LABEL[item.liveStatus]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                seen in {item.occurrenceCount} session
                {item.occurrenceCount === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-sm">{item.description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete pattern"
            onClick={() => {
              setRemoved(true);
              startTransition(() => deleteMemoryAction(item.id));
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {item.evidence.length > 0 && (
          <div>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {open ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              Where this came from ({item.evidence.length})
            </button>
            {open && (
              <ul className="mt-2 space-y-2 border-l pl-3">
                {item.evidence.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {e.source}
                    </span>
                    <p className="text-muted-foreground">&ldquo;{e.evidence}&rdquo;</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MemoryList({ items }: { items: MemoryWithEvidence[] }) {
  const [, startTransition] = useTransition();
  const [cleared, setCleared] = useState(false);

  if (cleared || items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          No patterns yet. As you finish practice and interview sessions, the
          system remembers recurring issues here - and only recurring ones, not
          one-offs.
        </CardContent>
      </Card>
    );
  }

  const confirmedCount = items.filter(
    (i) => i.liveStatus === "confirmed",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} pattern{items.length === 1 ? "" : "s"}
          {confirmedCount > 0 && ` · ${confirmedCount} recurring`}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className={cn("text-destructive")}
          onClick={() => {
            setCleared(true);
            startTransition(() => clearAllMemoryAction());
          }}
        >
          <Trash2 className="size-4" /> Clear all
        </Button>
      </div>
      {items.map((item) => (
        <MemoryCard key={item.id} item={item} />
      ))}
    </div>
  );
}
