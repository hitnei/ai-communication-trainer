"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import type { Profile } from "@/domain/profile/types";
import { EMPTY_PROJECT } from "@/domain/profile/types";
import type { CvExtraction } from "@/domain/profile/schema";
import {
  updateProfileAction,
  extractCvAction,
  createProjectAction,
} from "@/app/profile/actions";

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const toCsv = (a: string[]) => a.join(", ");
const fromCsv = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

export function ProfileEditor({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    currentRole: profile.currentRole,
    yearsExperience: profile.yearsExperience?.toString() ?? "",
    targetRole: profile.targetRole,
    targetMarkets: toCsv(profile.targetMarkets),
    primarySkills: toCsv(profile.primarySkills),
    secondarySkills: toCsv(profile.secondarySkills),
    englishGoal: profile.englishGoal,
  });
  const [saved, setSaved] = useState(false);

  // CV import
  const [cvText, setCvText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<CvExtraction | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [addedProjects, setAddedProjects] = useState<Set<number>>(new Set());

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await updateProfileAction({
        currentRole: form.currentRole,
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : null,
        targetRole: form.targetRole,
        targetMarkets: fromCsv(form.targetMarkets),
        primarySkills: fromCsv(form.primarySkills),
        secondarySkills: fromCsv(form.secondarySkills),
        englishGoal: form.englishGoal,
      });
      setSaved(true);
      router.refresh();
    });
  }

  async function extract() {
    setExtracting(true);
    setCvError(null);
    const r = await extractCvAction(cvText);
    if (r.ok) {
      setExtraction(r.extraction);
      // Prefill the form so the user can review + edit before saving (§42).
      setForm((f) => ({
        ...f,
        currentRole: r.extraction.currentRole || f.currentRole,
        yearsExperience:
          r.extraction.yearsExperience?.toString() ?? f.yearsExperience,
        primarySkills: toCsv(r.extraction.primarySkills) || f.primarySkills,
        secondarySkills:
          toCsv(r.extraction.secondarySkills) || f.secondarySkills,
      }));
    } else {
      setCvError(r.message);
    }
    setExtracting(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Import from CV (optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste your CV. The extraction is a draft - review and edit everything
            below before saving. Nothing is taken as fact automatically.
          </p>
          <Textarea
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            placeholder="Paste your CV / résumé text here…"
            className="min-h-24"
          />
          <Button size="sm" onClick={extract} disabled={extracting || !cvText.trim()}>
            {extracting ? <Spinner /> : <Sparkles className="size-4" />} Extract
          </Button>
          {cvError && <p className="text-sm text-destructive">{cvError}</p>}
          {extraction && extraction.projects.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Projects found - add the ones you want
              </p>
              {extraction.projects.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {p.name}
                    {p.company ? ` @ ${p.company}` : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={addedProjects.has(i)}
                    onClick={() =>
                      startTransition(async () => {
                        await createProjectAction({
                          ...EMPTY_PROJECT,
                          name: p.name,
                          company: p.company,
                          role: p.role,
                          overview: p.overview,
                          techStack: p.techStack,
                        });
                        setAddedProjects((s) => new Set(s).add(i));
                        router.refresh();
                      })
                    }
                  >
                    {addedProjects.has(i) ? (
                      <>
                        <Check className="size-4" /> Added
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" /> Add
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Your profile
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Current role">
            <input className={inputCls} value={form.currentRole} onChange={(e) => set("currentRole", e.target.value)} />
          </Field>
          <Field label="Years of experience">
            <input className={inputCls} type="number" value={form.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} />
          </Field>
          <Field label="Target role">
            <input className={inputCls} value={form.targetRole} onChange={(e) => set("targetRole", e.target.value)} />
          </Field>
          <Field label="Target markets (comma-separated)">
            <input className={inputCls} value={form.targetMarkets} onChange={(e) => set("targetMarkets", e.target.value)} />
          </Field>
          <Field label="Primary skills (comma-separated)">
            <input className={inputCls} value={form.primarySkills} onChange={(e) => set("primarySkills", e.target.value)} />
          </Field>
          <Field label="Secondary skills (comma-separated)">
            <input className={inputCls} value={form.secondarySkills} onChange={(e) => set("secondarySkills", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="English goal">
              <input className={inputCls} value={form.englishGoal} onChange={(e) => set("englishGoal", e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button onClick={save}>
              <Check className="size-4" /> Save profile
            </Button>
            {saved && <span className="text-sm text-success">Saved</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
