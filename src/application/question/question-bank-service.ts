import "server-only";
import {
  dedupeCandidates,
} from "@/domain/question/dedup";
import type {
  Difficulty,
  Question,
  QuestionCandidate,
  QuestionStatus,
  QuestionType,
  RemovalReason,
} from "@/domain/question/types";
import { generateQuestions } from "@/infrastructure/ai/roles/question-generator";
import { questionRepository } from "@/infrastructure/db/repositories/question-repository";
import { profileRepository } from "@/infrastructure/db/repositories/profile-repository";
import { buildMemorySummary } from "@/application/memory/memory-service";
import { buildProjectsSummary } from "@/application/profile/project-service";

/**
 * Application service for the question bank (§36-§40). It owns generation,
 * near-duplicate filtering, review-before-save, and removal feedback - the AI
 * only proposes candidates (Rule 3).
 */

export interface GenerateResult {
  candidates: QuestionCandidate[];
  duplicatesFiltered: number;
}

export async function generateQuestionCandidates(input: {
  categories: string[];
  technologies?: string[];
  difficulty?: Difficulty;
  count?: number;
  /** Personalize to a specific job description (§44). */
  jobContext?: string;
}): Promise<GenerateResult> {
  const count = input.count ?? 10;
  const existing = questionRepository.allTexts();
  const removedFeedback = questionRepository.recentRemovalFeedback();
  const targetRole =
    profileRepository.getOrCreate().targetRole ?? "Senior Frontend Engineer";
  const projectContext = buildProjectsSummary();

  const generated = await generateQuestions({
    categories: input.categories,
    technologies: input.technologies ?? [],
    difficulty: input.difficulty ?? "senior",
    count,
    targetRole,
    existingQuestions: existing,
    removedFeedback,
    weaknessSummary: buildMemorySummary([
      "interview_pattern",
      "communication_pattern",
    ]),
    // Ground questions in real projects when we have them (§43, §73).
    projectContext:
      projectContext === "(no projects on file)" ? undefined : projectContext,
    jobContext: input.jobContext,
  });

  // Filter exact + near-duplicates against existing questions, previously
  // removed questions (§40), and each other - deterministic, so it holds
  // regardless of whether the model honored the "avoid" lists.
  const avoid = [...existing, ...removedFeedback.map((r) => r.text)];
  const { kept, dropped } = dedupeCandidates(generated, (q) => q.text, avoid);

  const candidates: QuestionCandidate[] = kept.slice(0, count).map((q) => ({
    text: q.text,
    categories: q.categories.length ? q.categories : input.categories,
    difficulty: q.difficulty,
    questionType: q.questionType,
  }));

  return { candidates, duplicatesFiltered: dropped.length };
}

/** Save the candidates the user chose to keep (§39). */
export function addQuestions(candidates: QuestionCandidate[]): Question[] {
  return candidates.map((c) =>
    questionRepository.create({
      text: c.text,
      categories: c.categories,
      technologies: [],
      difficulty: c.difficulty,
      questionType: c.questionType,
      status: "suggested",
      source: "ai",
    }),
  );
}

export function addManualQuestion(input: {
  text: string;
  categories: string[];
  difficulty: Difficulty;
  questionType: QuestionType;
}): Question {
  return questionRepository.create({
    ...input,
    technologies: [],
    status: "selected",
    source: "manual",
  });
}

export function listQuestions(): Question[] {
  return questionRepository.list();
}

export function updateQuestionText(id: string, text: string): void {
  questionRepository.update(id, { text });
}

export function setQuestionStatus(id: string, status: QuestionStatus): void {
  questionRepository.update(id, { status });
}

/** Remove a question, capturing the reason so future generation improves (§40). */
export function removeQuestion(
  id: string,
  reason: RemovalReason,
  note?: string,
): void {
  const q = questionRepository.get(id);
  if (!q) return;
  questionRepository.addRemovalFeedback({
    questionText: q.text,
    reason,
    note,
    categories: q.categories,
  });
  questionRepository.remove(id);
}
