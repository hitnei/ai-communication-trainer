/**
 * Near-duplicate detection for generated questions (§38, §39). Generation must
 * avoid exact AND semantically near-identical questions. We use a lightweight
 * token-overlap (Jaccard) measure over content words - cheap, deterministic, and
 * good enough to catch "How does React re-render?" vs "Explain React re-rendering".
 */

const STOPWORDS = new Set([
  "a","an","the","of","to","in","on","for","and","or","is","are","do","does",
  "you","your","how","what","why","when","which","would","could","can","with",
  "about","that","this","it","me","i","we","they","your","tell","explain",
  "describe","walk","through","give","example","time","using","use",
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Very light stemming so "render"/"rendering" and "work"/"works" match. */
function stem(w: string): string {
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
  return w;
}

export function contentTokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(stem),
  );
}

export function similarity(a: string, b: string): number {
  if (normalize(a) === normalize(b)) return 1;
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return inter / union;
}

export function isNearDuplicate(a: string, b: string, threshold = 0.6): boolean {
  return similarity(a, b) >= threshold;
}

/**
 * Keep only candidates that are not near-duplicates of `existing` texts or of
 * each other. Returns kept candidates and the dropped ones (with the match).
 */
export function dedupeCandidates<T>(
  candidates: T[],
  getText: (c: T) => string,
  existing: string[],
  threshold = 0.6,
): { kept: T[]; dropped: T[] } {
  const kept: T[] = [];
  const dropped: T[] = [];
  const seen = [...existing];
  for (const c of candidates) {
    const text = getText(c);
    const dup = seen.some((s) => isNearDuplicate(text, s, threshold));
    if (dup) {
      dropped.push(c);
    } else {
      kept.push(c);
      seen.push(text);
    }
  }
  return { kept, dropped };
}
