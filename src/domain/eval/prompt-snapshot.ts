import { diffLines, type DiffLine } from "./diff";
import type { PromptSection, PromptSnapshot } from "./types";

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function makeSnapshot(sections: PromptSection[]): PromptSnapshot {
  return {
    hash: fnv1a(sections.map((s) => `${s.title}\n${s.text}`).join("\n\n")),
    sections,
  };
}

export interface SectionDiff {
  title: string;
  changed: boolean;
  lines: DiffLine[];
}

/** Per-section line diff; a null `before` means every line is new. */
export function diffSnapshots(
  before: PromptSnapshot | null,
  after: PromptSnapshot,
): SectionDiff[] {
  const titles = [
    ...after.sections.map((s) => s.title),
    ...(before?.sections ?? [])
      .map((s) => s.title)
      .filter((t) => !after.sections.some((s) => s.title === t)),
  ];
  return titles.map((title) => {
    const prev = before?.sections.find((s) => s.title === title)?.text ?? "";
    const next = after.sections.find((s) => s.title === title)?.text ?? "";
    return {
      title,
      changed: prev !== next,
      lines: diffLines(prev, next),
    };
  });
}
