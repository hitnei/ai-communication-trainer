"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Project, ProjectInput } from "@/domain/profile/types";
import { EMPTY_PROJECT } from "@/domain/profile/types";
import {
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from "@/app/profile/actions";

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const toCsv = (a: string[]) => a.join(", ");
const fromCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

const MORE_FIELDS: { key: keyof ProjectInput; label: string }[] = [
  { key: "responsibilities", label: "Responsibilities" },
  { key: "challenges", label: "Challenges" },
  { key: "solutions", label: "Solutions" },
  { key: "architecture", label: "Architecture" },
  { key: "performance", label: "Performance" },
  { key: "leadership", label: "Leadership" },
  { key: "collaboration", label: "Collaboration" },
  { key: "conflicts", label: "Conflicts" },
  { key: "achievements", label: "Achievements" },
];

function ProjectForm({
  initial,
  onSave,
  onCancel,
  busy,
}: {
  initial: ProjectInput;
  onSave: (p: ProjectInput) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [p, setP] = useState<ProjectInput>(initial);
  const [tech, setTech] = useState(toCsv(initial.techStack));
  const [more, setMore] = useState(false);
  function set<K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={inputCls} placeholder="Project name" value={p.name} onChange={(e) => set("name", e.target.value)} />
          <input className={inputCls} placeholder="Company" value={p.company} onChange={(e) => set("company", e.target.value)} />
          <input className={inputCls} placeholder="Your role" value={p.role} onChange={(e) => set("role", e.target.value)} />
        </div>
        <input className={inputCls} placeholder="Tech stack (comma-separated)" value={tech} onChange={(e) => setTech(e.target.value)} />
        <Textarea placeholder="Overview" value={p.overview} onChange={(e) => set("overview", e.target.value)} />

        <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setMore((m) => !m)}>
          {more ? "Hide" : "More"} details
        </button>
        {more && (
          <div className="space-y-2">
            {MORE_FIELDS.map((f) => (
              <Textarea
                key={f.key}
                placeholder={f.label}
                value={p[f.key] as string}
                onChange={(e) => set(f.key, e.target.value)}
                className="min-h-16"
              />
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" disabled={busy || !p.name.trim()} onClick={() => onSave({ ...p, techStack: fromCsv(tech) })}>
            <Check className="size-4" /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="size-4" /> Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectsManager({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Projects ({projects.length})
        </h2>
        <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
          <Plus className="size-4" /> Add project
        </Button>
      </div>

      {adding && (
        <ProjectForm
          initial={EMPTY_PROJECT}
          busy={busy}
          onCancel={() => setAdding(false)}
          onSave={(p) =>
            startTransition(async () => {
              await createProjectAction(p);
              setAdding(false);
              router.refresh();
            })
          }
        />
      )}

      {projects.map((proj) =>
        editingId === proj.id ? (
          <ProjectForm
            key={proj.id}
            initial={proj}
            busy={busy}
            onCancel={() => setEditingId(null)}
            onSave={(p) =>
              startTransition(async () => {
                await updateProjectAction(proj.id, p);
                setEditingId(null);
                router.refresh();
              })
            }
          />
        ) : (
          <Card key={proj.id}>
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div className="space-y-1">
                <p className="font-medium">
                  {proj.name}
                  {proj.company ? (
                    <span className="text-muted-foreground"> @ {proj.company}</span>
                  ) : null}
                </p>
                {proj.overview && (
                  <p className="text-sm text-muted-foreground">{proj.overview}</p>
                )}
                {proj.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {proj.techStack.map((t) => (
                      <Badge key={t} variant="muted">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditingId(proj.id)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteProjectAction(proj.id);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ),
      )}
    </section>
  );
}
