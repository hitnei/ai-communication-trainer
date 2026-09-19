import {
  generatedQuestionsBatchSchema,
  type GeneratedQuestion,
} from "@/domain/question/schema";
import { CATEGORY_LABEL } from "@/domain/interview/types";
import { buildSystemPrompt, buildUserPrompt } from "../prompt/builder";
import { getAIProvider } from "../provider";
import type { AIProvider } from "../types";

export const QUESTION_GENERATOR_PROMPT_VERSION = "question-generator@1.0";

const ROLE_RULES = `You generate interview questions for a Senior Frontend Engineer (React-first; also Next.js, Node.js, TypeScript, architecture, performance, state, system design) targeting Australian/European companies.

Questions must be:
- Relevant to the requested categories, and when several categories are given, MIX them - some questions may combine categories (e.g. a React + Leadership scenario).
- Senior-level and useful: test reasoning, scenarios, trade-offs, and decisions - NOT trivial definition recall.
- Distinct from each other and from the "existing questions" list - no exact or near-identical questions.
- Aware of the candidate's known weak areas (probe them a bit more) without being repetitive.
- Never a duplicate of anything in the "avoid" lists.

Tag each question with the categories it covers (from the requested set), a difficulty, and a questionType (recall/understanding/application/scenario/tradeoff/decision).`;

export interface GenerateQuestionsInput {
  categories: string[];
  technologies: string[];
  difficulty: string;
  count: number;
  targetRole: string;
  existingQuestions: string[];
  removedFeedback: { text: string; reason: string }[];
  weaknessSummary?: string;
  /** Candidate's projects, to ground questions in real experience (§43, §73). */
  projectContext?: string;
  /** A specific job description to tailor a track to (§44). */
  jobContext?: string;
}

export async function generateQuestions(
  input: GenerateQuestionsInput,
  provider: AIProvider = getAIProvider(),
): Promise<GeneratedQuestion[]> {
  const system = buildSystemPrompt(ROLE_RULES);
  const cats = input.categories.map((c) => CATEGORY_LABEL[c] ?? c).join(", ");

  const task = [
    `Target role: ${input.targetRole}.`,
    `Generate ${input.count} interview questions.`,
    `Categories to cover (combine them): ${cats}.`,
    input.technologies.length ? `Emphasise: ${input.technologies.join(", ")}.` : "",
    `Preferred difficulty: ${input.difficulty}.`,
    input.existingQuestions.length
      ? `Existing questions to NOT duplicate (avoid these and anything similar):\n${input.existingQuestions
          .slice(0, 40)
          .map((q) => `- ${q}`)
          .join("\n")}`
      : "",
    input.removedFeedback.length
      ? `The user removed these questions - avoid this kind:\n${input.removedFeedback
          .slice(0, 20)
          .map((r) => `- "${r.text}" (${r.reason})`)
          .join("\n")}`
      : "",
    input.projectContext
      ? `Ground some questions in the candidate's real projects (ask about their actual decisions/challenges, don't invent):\n${input.projectContext}`
      : "",
    input.jobContext
      ? `Tailor this batch to the following job description - prioritise its requirements and likely gaps:\n${input.jobContext}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await provider.generateStructured(
    {
      system,
      prompt: buildUserPrompt({
        roleRules: ROLE_RULES,
        relevantMemory: input.weaknessSummary,
        task,
        outputContract: `Return ONLY JSON:
{ "questions": [ { "text": string, "categories": string[], "difficulty": "junior"|"mid"|"senior"|"staff", "questionType": "recall"|"understanding"|"application"|"scenario"|"tradeoff"|"decision" } ] }`,
      }),
      schema: generatedQuestionsBatchSchema,
      schemaName: "GeneratedQuestions",
      temperature: 0.8,
    },
    { role: "question-generator", promptVersion: QUESTION_GENERATOR_PROMPT_VERSION },
  );
  return result.questions;
}
