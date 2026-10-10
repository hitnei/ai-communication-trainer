import {
  COMMUNICATION_CODES,
  ENGLISH_CODES,
  THINKING_CODES,
} from "@/domain/feedback/taxonomy";
import type { EnglishCoachFeedback } from "@/domain/practice/english-feedback";
import type { VietnameseCoachFeedback } from "@/domain/practice/vietnamese-feedback";
import type { CheckResult, ObservedFeedback } from "./types";

export type { CheckResult };

export interface VietnameseCase {
  id: string;
  prompt: string;
  answer: string;
  attemptNumber: number;
  previousAnswer?: string;
  expect: {
    anyCode?: string[];
    maxIssues?: number;
    /** No issue may use these categories (e.g. language slips are not thinking problems). */
    noCategory?: string[];
    /** Overrides the default voice-overlap floor for the improved version. */
    minVoiceOverlap?: number;
    /** The improved version must be shorter than the user's answer. */
    rewriteShorterThanInput?: boolean;
  };
}

export interface EnglishCase {
  id: string;
  prompt: string;
  transcript: string;
  previousTranscript?: string;
  allowImprovedVersion: boolean;
  expect: {
    anyCode?: string[];
    mustFlag?: string[];
    mustNotFlag?: string[];
    maxIssues?: number;
    minVoiceOverlap?: number;
  };
}

const VI_DIACRITICS =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/giu;

const THINKING = new Set<string>(THINKING_CODES);
const COMMUNICATION = new Set<string>(COMMUNICATION_CODES);
const ENGLISH = new Set<string>(ENGLISH_CODES);

const MIN_VOICE_OVERLAP = 0.4;
const MIN_VI_DIACRITIC_RATIO = 0.12;

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

function normalize(text: string): string {
  return words(text).join(" ");
}

export function voiceOverlap(original: string, rewritten: string): number {
  const originalWords = new Set(words(original));
  if (originalWords.size === 0) return 1;
  const rewrittenWords = new Set(words(rewritten));
  let kept = 0;
  for (const w of originalWords) if (rewrittenWords.has(w)) kept += 1;
  return kept / originalWords.size;
}

export function vietnameseRatio(text: string): number {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return 0;
  return (text.match(VI_DIACRITICS)?.length ?? 0) / letters;
}

function isQuoteOf(evidence: string, source: string): boolean {
  const haystack = normalize(source);
  return evidence
    .split(/\.{3}|…/)
    .map(normalize)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}

function check(name: string, pass: boolean, detail?: string): CheckResult {
  return { name, pass, detail: pass ? undefined : detail };
}

export function evaluateVietnamese(
  c: VietnameseCase,
  fb: VietnameseCoachFeedback,
): CheckResult[] {
  const results: CheckResult[] = [];
  const maxIssues = c.expect.maxIssues ?? 4;

  const mismatched = fb.issues.filter((i) =>
    i.category === "thinking"
      ? !THINKING.has(i.code)
      : !COMMUNICATION.has(i.code),
  );
  results.push(
    check(
      "category_matches_code",
      mismatched.length === 0,
      mismatched.map((i) => `${i.category}/${i.code}`).join(", "),
    ),
  );

  results.push(
    check(
      "issue_count",
      fb.issues.length <= maxIssues,
      `${fb.issues.length} > ${maxIssues}`,
    ),
  );

  const prose = [
    fb.summary,
    ...fb.issues.map((i) => i.detail),
    ...fb.reflectionQuestions,
    ...fb.suggestions,
  ].join(" ");
  const ratio = vietnameseRatio(prose);
  results.push(
    check(
      "responds_in_vietnamese",
      ratio >= MIN_VI_DIACRITIC_RATIO,
      `diacritic ratio ${ratio.toFixed(2)}`,
    ),
  );

  if (c.attemptNumber <= 2) {
    results.push(
      check(
        "no_rewrite_before_attempt_3",
        !fb.improvedVersion,
        "improvedVersion present",
      ),
    );
  }
  if (c.attemptNumber <= 1) {
    results.push(
      check(
        "has_reflection_questions",
        fb.reflectionQuestions.length > 0,
        "no reflection questions",
      ),
    );
  }
  if (c.attemptNumber === 2) {
    results.push(
      check("has_suggestions", fb.suggestions.length > 0, "no suggestions"),
    );
  }
  if (c.attemptNumber >= 3) {
    const rewrite = fb.improvedVersion;
    results.push(
      check("has_improved_version", Boolean(rewrite), "improvedVersion missing"),
    );
    if (rewrite) {
      const overlap = voiceOverlap(c.answer, rewrite);
      const floor = c.expect.minVoiceOverlap ?? MIN_VOICE_OVERLAP;
      results.push(
        check(
          "keeps_user_voice",
          overlap >= floor,
          `overlap ${overlap.toFixed(2)} < ${floor}`,
        ),
      );
      if (c.expect.rewriteShorterThanInput) {
        const before = words(c.answer).length;
        const after = words(rewrite).length;
        results.push(
          check("rewrite_is_tighter", after < before, `${after} words vs ${before}`),
        );
      }
    }
  }

  for (const category of c.expect.noCategory ?? []) {
    const hit = fb.issues.filter((i) => i.category === category);
    results.push(
      check(
        `no_${category}_issues`,
        hit.length === 0,
        hit.map((i) => i.code).join(", "),
      ),
    );
  }

  if (c.expect.anyCode) {
    const wanted = c.expect.anyCode;
    results.push(
      check(
        "diagnoses_expected_problem",
        fb.issues.some((i) => wanted.includes(i.code)),
        `wanted one of [${wanted.join(", ")}], got [${fb.issues.map((i) => i.code).join(", ")}]`,
      ),
    );
  }

  return results;
}

function flagsPhrase(
  fb: EnglishCoachFeedback,
  phrase: string,
  harsh: boolean,
): boolean {
  const target = normalize(phrase);
  return fb.issues.some((i) => {
    if (!i.evidence || !normalize(i.evidence).includes(target)) return false;
    if (!harsh) return true;
    return (
      i.naturalness === "awkward" ||
      i.naturalness === "incorrect" ||
      i.code === "grammar" ||
      i.code === "unnatural_phrase"
    );
  });
}

export function evaluateEnglish(
  c: EnglishCase,
  fb: EnglishCoachFeedback,
): CheckResult[] {
  const results: CheckResult[] = [];
  const maxIssues = c.expect.maxIssues ?? 5;
  const sources = [c.transcript, c.previousTranscript ?? ""].join(" ");

  const mismatched = fb.issues.filter((i) =>
    i.category === "english"
      ? !ENGLISH.has(i.code)
      : !THINKING.has(i.code) && !COMMUNICATION.has(i.code),
  );
  results.push(
    check(
      "category_matches_code",
      mismatched.length === 0,
      mismatched.map((i) => `${i.category}/${i.code}`).join(", "),
    ),
  );

  const fabricated = fb.issues.filter(
    (i) => i.evidence && !isQuoteOf(i.evidence, sources),
  );
  results.push(
    check(
      "evidence_is_real_quote",
      fabricated.length === 0,
      fabricated.map((i) => `"${i.evidence}"`).join(", "),
    ),
  );

  results.push(
    check(
      "issue_count",
      fb.issues.length <= maxIssues,
      `${fb.issues.length} > ${maxIssues}`,
    ),
  );
  results.push(
    check(
      "focus_areas_2_to_3",
      fb.topFocusAreas.length >= 1 && fb.topFocusAreas.length <= 3,
      `${fb.topFocusAreas.length} focus areas`,
    ),
  );

  if (c.allowImprovedVersion) {
    const rewrite = fb.improvedVersion;
    results.push(
      check("has_improved_version", Boolean(rewrite), "improvedVersion missing"),
    );
    if (rewrite) {
      const overlap = voiceOverlap(c.transcript, rewrite);
      const floor = c.expect.minVoiceOverlap ?? MIN_VOICE_OVERLAP;
      results.push(
        check(
          "keeps_user_voice",
          overlap >= floor,
          `overlap ${overlap.toFixed(2)} < ${floor}`,
        ),
      );
    }
  } else {
    results.push(
      check(
        "no_rewrite_when_not_allowed",
        !fb.improvedVersion,
        "improvedVersion present",
      ),
    );
  }

  results.push(
    check(
      "comparison_matches_history",
      c.previousTranscript ? fb.comparison !== null : fb.comparison === null,
      c.previousTranscript
        ? "comparison missing despite previous attempt"
        : "comparison present without previous attempt",
    ),
  );

  if (c.expect.anyCode) {
    const wanted = c.expect.anyCode;
    results.push(
      check(
        "flags_expected_problem",
        fb.issues.some((i) => wanted.includes(i.code)),
        `wanted one of [${wanted.join(", ")}], got [${fb.issues.map((i) => i.code).join(", ")}]`,
      ),
    );
  }
  for (const phrase of c.expect.mustFlag ?? []) {
    results.push(
      check(
        `flags "${phrase}"`,
        flagsPhrase(fb, phrase, false),
        "no issue quotes it",
      ),
    );
  }
  for (const phrase of c.expect.mustNotFlag ?? []) {
    results.push(
      check(
        `leaves "${phrase}" alone`,
        !flagsPhrase(fb, phrase, true),
        "flagged as wrong or unnatural",
      ),
    );
  }

  return results;
}

export function observeVietnamese(fb: VietnameseCoachFeedback): ObservedFeedback {
  return {
    summary: fb.summary,
    improvedVersion: fb.improvedVersion,
    issues: fb.issues.map((i) => ({
      category: i.category,
      code: i.code,
      evidence: null,
      naturalness: null,
      title: i.title,
      detail: i.detail,
    })),
  };
}

export function observeEnglish(fb: EnglishCoachFeedback): ObservedFeedback {
  return {
    summary: fb.summary,
    improvedVersion: fb.improvedVersion,
    issues: fb.issues.map((i) => ({
      category: i.category,
      code: i.code,
      evidence: i.evidence,
      naturalness: i.naturalness,
      title: i.title,
      detail: i.detail,
    })),
  };
}
