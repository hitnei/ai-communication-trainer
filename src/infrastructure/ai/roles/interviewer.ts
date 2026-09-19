import {
  interviewFeedbackSchema,
  interviewQuestionSchema,
  interviewReviewSchema,
  type InterviewFeedback,
  type InterviewReview,
} from "@/domain/interview/interview-feedback";
import { CATEGORY_LABEL, INTERVIEW_TYPE_LABEL } from "@/domain/interview/types";
import { buildSystemPrompt, buildUserPrompt } from "../prompt/builder";
import { getAIProvider } from "../provider";
import type { AIProvider } from "../types";

export const INTERVIEWER_PROMPT_VERSION = "interviewer@1.0";

const ROLE_RULES = `You are a senior engineering interviewer for a Senior Frontend Engineer role (React-first; also Next.js, Node.js, TypeScript, architecture, performance, state, system design), interviewing for Australian/European companies.

Ask ONE question at a time. Questions should test reasoning, not definition recall: probe why, trade-offs, alternatives considered, impact, metrics, ownership, edge cases, and scalability (§34). Match the seniority - a senior candidate should be pushed on decisions and measurement.

Do NOT teach concepts and do NOT correct grammar or English (§32). You assess the substance of the answer only.

Follow-ups must be built from what the candidate ACTUALLY said - detect the missing piece (a claim with no metric, a decision with no trade-off, a vague example) and probe exactly that. Never jump to an unrelated topic.

Do not fabricate the candidate's experience. If an answer is thin, ask them to go deeper rather than inventing details for them.`;

function categoriesLine(categories: string[]): string {
  return categories.map((c) => CATEGORY_LABEL[c] ?? c).join(", ");
}

/** Generate the opening question for an individual interview. */
export async function generateOpeningQuestion(
  input: { categories: string[]; technologies: string[]; seed: string },
  provider: AIProvider = getAIProvider(),
): Promise<string> {
  const system = buildSystemPrompt(ROLE_RULES);
  const prompt = buildUserPrompt({
    roleRules: ROLE_RULES,
    task: [
      `Categories for this session: ${categoriesLine(input.categories)}.`,
      input.technologies.length
        ? `Emphasise: ${input.technologies.join(", ")}.`
        : "",
      `Here is a reference question for tone/level (you may adapt or replace it, keep it senior-level and scenario/trade-off oriented):\n${input.seed}`,
      "Produce ONE strong opening interview question.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    outputContract: `Return ONLY JSON: { "question": string }`,
  });

  const result = await provider.generateStructured(
    {
      system,
      prompt,
      schema: interviewQuestionSchema,
      schemaName: "InterviewQuestion",
      temperature: 0.7,
    },
    { role: "interview-question", promptVersion: INTERVIEWER_PROMPT_VERSION },
  );
  return result.question;
}

export interface EvaluateAnswerInput {
  question: string;
  answer: string;
  categories: string[];
  previousAnswer?: string;
  sessionId?: string;
}

/** Grade an answer against senior expectations and produce an adaptive follow-up. */
export async function evaluateInterviewAnswer(
  input: EvaluateAnswerInput,
  provider: AIProvider = getAIProvider(),
): Promise<InterviewFeedback> {
  const system = buildSystemPrompt(ROLE_RULES);
  const task = [
    `Categories: ${categoriesLine(input.categories)}.`,
    `Question asked:\n${input.question}`,
    input.previousAnswer
      ? `The candidate's PREVIOUS attempt at this same question:\n${input.previousAnswer}`
      : null,
    `The candidate's answer (transcribed speech):\n${input.answer}`,
    "",
    "Assess the substance only (not grammar). Identify strengths and the 2-3 highest-value gaps using the interview issue codes (too_generic, insufficient_depth, weak_tradeoff, weak_example, unsupported_claim, missing_metric). Quote their words as evidence.",
    "Then produce ONE follow-up question that probes the single biggest gap in THIS answer, and briefly explain in followUpRationale which gap it targets.",
    input.previousAnswer
      ? "This was a retry: fill comparison with one improvement and one thing still missing."
      : "Set comparison to null.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = buildUserPrompt({
    roleRules: ROLE_RULES,
    task,
    outputContract: `Return ONLY JSON:
{
  "summary": string,
  "strengths": string[],
  "issues": [ { "code": string, "title": string, "detail": string, "evidence": string|null } ],
  "topFocusAreas": string[],
  "followUpQuestion": string,
  "followUpRationale": string,
  "comparison": { "improvement": string, "remainingIssue": string } | null
}`,
  });

  return provider.generateStructured(
    {
      system,
      prompt,
      schema: interviewFeedbackSchema,
      schemaName: "InterviewFeedback",
      temperature: 0.5,
    },
    {
      role: "interview-coach",
      promptVersion: INTERVIEWER_PROMPT_VERSION,
      sessionId: input.sessionId,
    },
  );
}

// --- Full simulation (§31, §32): interviewer stays in role until the end ---

export interface Exchange {
  question: string;
  answer: string;
}

export interface NextSimulationQuestionInput {
  categories: string[];
  interviewType: string;
  history: Exchange[];
  askedCount: number;
  targetCount: number;
  sessionId?: string;
}

/**
 * Ask the NEXT interview question during a live simulation. Crucially, this must
 * NOT give any feedback, score, or hint (§32) - it only asks. It adapts to the
 * candidate's last answer (probe deeper) or moves to a new area to cover the
 * interview type within the remaining questions.
 */
export async function generateNextSimulationQuestion(
  input: NextSimulationQuestionInput,
  provider: AIProvider = getAIProvider(),
): Promise<string> {
  const type = INTERVIEW_TYPE_LABEL[input.interviewType] ?? input.interviewType;
  const historyText = input.history.length
    ? input.history
        .map((e, i) => `Q${i + 1}: ${e.question}\nA${i + 1}: ${e.answer}`)
        .join("\n\n")
    : "(no questions asked yet - this is the opening question)";

  const system = buildSystemPrompt(ROLE_RULES);
  const prompt = buildUserPrompt({
    roleRules: ROLE_RULES,
    task: [
      `This is a live ${type} interview. Categories: ${categoriesLine(input.categories)}.`,
      `Questions asked so far: ${input.askedCount} of about ${input.targetCount}.`,
      `Transcript so far:\n${historyText}`,
      "",
      "Ask the SINGLE next question. Prefer to probe the candidate's last answer more deeply (why, trade-offs, alternatives, metrics, edge cases); if that thread is exhausted or empty, move to another area appropriate for this interview type. Do NOT give any feedback, evaluation, score, or hint - only ask the question. Keep it to one clear question.",
    ].join("\n\n"),
    outputContract: `Return ONLY JSON: { "question": string }`,
  });

  const result = await provider.generateStructured(
    {
      system,
      prompt,
      schema: interviewQuestionSchema,
      schemaName: "InterviewQuestion",
      temperature: 0.7,
    },
    {
      role: "interview-next",
      promptVersion: INTERVIEWER_PROMPT_VERSION,
      sessionId: input.sessionId,
    },
  );
  return result.question;
}

const REVIEW_PROMPT_VERSION = "interview-reviewer@1.0";

const REVIEWER_RULES = `You are now a supportive but honest interview coach reviewing a COMPLETED mock interview (the interview is over - it is now fine to give feedback and guidance).

Assess the whole interview, not just one answer. Weigh substance: depth, reasoning, trade-offs, concrete examples, metrics, ownership. Be specific and quote the candidate where useful. Use a gentle, non-judgemental readiness scale (strong / solid / developing / early) - never harsh labels. Give a few high-value areas to improve (mapped to the interview issue codes) and concrete practice recommendations. Do not invent things the candidate didn't say.`;

export interface ReviewInput {
  categories: string[];
  interviewType: string;
  exchanges: Exchange[];
  sessionId?: string;
}

/** Produce the full post-interview review shown only after the session ends. */
export async function reviewSimulation(
  input: ReviewInput,
  provider: AIProvider = getAIProvider(),
): Promise<InterviewReview> {
  const type = INTERVIEW_TYPE_LABEL[input.interviewType] ?? input.interviewType;
  const transcript = input.exchanges
    .map((e, i) => `Q${i + 1}: ${e.question}\nA${i + 1}: ${e.answer}`)
    .join("\n\n");

  const system = buildSystemPrompt(REVIEWER_RULES);
  const prompt = buildUserPrompt({
    roleRules: REVIEWER_RULES,
    task: [
      `Completed ${type} interview. Categories: ${categoriesLine(input.categories)}.`,
      `Full transcript:\n${transcript}`,
      "Write the review.",
    ].join("\n\n"),
    outputContract: `Return ONLY JSON:
{
  "overallSummary": string,
  "readiness": "strong"|"solid"|"developing"|"early",
  "strengths": string[],
  "areasToImprove": [ { "code": string, "title": string, "detail": string, "evidence": string|null } ],
  "perQuestion": [ { "question": string, "note": string } ],
  "recommendedPractice": string[],
  "topFocusAreas": string[]
}`,
  });

  return provider.generateStructured(
    {
      system,
      prompt,
      schema: interviewReviewSchema,
      schemaName: "InterviewReview",
      temperature: 0.5,
    },
    {
      role: "interview-review",
      promptVersion: REVIEW_PROMPT_VERSION,
      sessionId: input.sessionId,
    },
  );
}
