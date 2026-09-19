import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { questionFeedback, questions } from "../schema";
import type {
  Difficulty,
  Question,
  QuestionStatus,
  QuestionType,
} from "@/domain/question/types";
import { ids } from "@/lib/ids";

/** Data access for the question bank (§36-§40). */
export const questionRepository = {
  create(input: {
    text: string;
    categories: string[];
    technologies: string[];
    difficulty: Difficulty;
    questionType: QuestionType;
    status: QuestionStatus;
    source: string;
  }): Question {
    const id = ids.question();
    db.insert(questions)
      .values({
        id,
        text: input.text,
        categories: JSON.stringify(input.categories),
        technologies: JSON.stringify(input.technologies),
        difficulty: input.difficulty,
        questionType: input.questionType,
        status: input.status,
        source: input.source,
      })
      .run();
    return this.get(id)!;
  },

  get(id: string): Question | null {
    const row = db.select().from(questions).where(eq(questions.id, id)).get();
    return row ? mapQuestion(row) : null;
  },

  list(): Question[] {
    return db
      .select()
      .from(questions)
      .orderBy(desc(questions.createdAt))
      .all()
      .map(mapQuestion);
  },

  allTexts(): string[] {
    return db
      .select({ text: questions.text })
      .from(questions)
      .all()
      .map((r) => r.text);
  },

  update(
    id: string,
    patch: { text?: string; status?: QuestionStatus },
  ): void {
    db.update(questions)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(questions.id, id))
      .run();
  },

  remove(id: string): void {
    db.delete(questions).where(eq(questions.id, id)).run();
  },

  addRemovalFeedback(input: {
    questionText: string;
    reason: string;
    note?: string;
    categories: string[];
  }): void {
    db.insert(questionFeedback)
      .values({
        id: ids.question(),
        questionText: input.questionText,
        reason: input.reason,
        note: input.note,
        categories: JSON.stringify(input.categories),
      })
      .run();
  },

  recentRemovalFeedback(limit = 20): { text: string; reason: string }[] {
    return db
      .select()
      .from(questionFeedback)
      .orderBy(desc(questionFeedback.createdAt))
      .limit(limit)
      .all()
      .map((r) => ({ text: r.questionText, reason: r.reason }));
  },
};

function mapQuestion(row: typeof questions.$inferSelect): Question {
  return {
    id: row.id,
    text: row.text,
    categories: safeArray(row.categories),
    technologies: safeArray(row.technologies),
    difficulty: row.difficulty as Difficulty,
    questionType: row.questionType as QuestionType,
    status: row.status as QuestionStatus,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function safeArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
