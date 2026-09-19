import {
  englishCoachFeedbackSchema,
  type EnglishCoachFeedback,
} from "@/domain/practice/english-feedback";
import { EXERCISE_LABELS } from "@/domain/practice/types";
import type { VietnameseExerciseType } from "@/domain/practice/types";
import { buildSystemPrompt, buildUserPrompt } from "../prompt/builder";
import { getAIProvider } from "../provider";
import type { AIProvider } from "../types";

export const ENGLISH_COACH_PROMPT_VERSION = "english-coach@1.0";

const ROLE_RULES = `You are a spoken-English communication coach for a senior frontend engineer preparing for interviews in Australia and Europe. You analyze a TRANSCRIPT of the user speaking.

Weigh communication effectiveness and language EQUALLY - never automatically prefer grammar over clarity.

Judge two families of things:
- content: structure, clarity, conciseness, completeness, logic.
- english: grammar, vocabulary, naturalness, fluency, filler usage.

This is SPOKEN English, not written. Natural spoken fillers ("you know", "I mean", "yeah", "actually", "let me think") are NOT automatically wrong - rate them on the naturalness scale (natural / acceptable / context_dependent / awkward / incorrect). Only flag a filler when it genuinely hurts clarity or is a crutch. Clear mistakes like "you know what my mean" ARE incorrect and should be corrected to "you know what I mean".

Quote the user's exact words as evidence whenever you raise an issue. Do NOT dump every correction - choose the 2-3 highest-value focus areas.

If a previous attempt is provided, compare: name one concrete improvement and one thing still to work on, using their actual words.

Preserve the user's voice. Any improved version keeps ~80-90% of their wording and sounds like them, more natural - not like a textbook.`;

export interface EnglishCoachInput {
  exerciseType?: VietnameseExerciseType;
  prompt: string;
  transcript: string;
  previousTranscript?: string;
  /** Whether the app permits revealing an improved version this attempt (§28). */
  allowImprovedVersion: boolean;
  relevantMemory?: string;
  sessionId?: string;
}

const OUTPUT_CONTRACT = `Return ONLY JSON:
{
  "summary": string,                 // one honest, human sentence
  "strengths": string[],
  "issues": [ { "category": "content"|"english", "code": string, "title": string, "detail": string, "evidence": string|null, "naturalness": "natural"|"acceptable"|"context_dependent"|"awkward"|"incorrect"|null } ],
  "topFocusAreas": string[],         // 2-3 items, the most valuable to fix
  "improvedVersion": string | null,  // null unless explicitly allowed
  "comparison": { "improvement": string, "remainingIssue": string } | null
}`;

function buildTask(input: EnglishCoachInput): string {
  const exercise = input.exerciseType
    ? EXERCISE_LABELS[input.exerciseType]
    : "communication";
  return [
    `Exercise type: ${exercise}`,
    `Question the user answered by speaking:\n${input.prompt}`,
    input.previousTranscript
      ? `Their previous attempt (transcript):\n${input.previousTranscript}`
      : null,
    `Their current attempt (transcript):\n${input.transcript}`,
    "",
    input.allowImprovedVersion
      ? "You MAY fill improvedVersion (preserve their voice)."
      : "Do NOT fill improvedVersion yet - leave it null. Coach them to improve it themselves.",
    input.previousTranscript
      ? "Fill comparison with one improvement and one remaining issue."
      : "There is no previous attempt; set comparison to null.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function runEnglishCoach(
  input: EnglishCoachInput,
  provider: AIProvider = getAIProvider(),
): Promise<EnglishCoachFeedback> {
  const system = buildSystemPrompt(ROLE_RULES);
  const userPrompt = buildUserPrompt({
    roleRules: ROLE_RULES,
    relevantMemory: input.relevantMemory,
    task: buildTask(input),
    outputContract: OUTPUT_CONTRACT,
  });

  return provider.generateStructured(
    {
      system,
      prompt: userPrompt,
      schema: englishCoachFeedbackSchema,
      schemaName: "EnglishCoachFeedback",
      temperature: 0.5,
    },
    {
      role: "english-coach",
      promptVersion: ENGLISH_COACH_PROMPT_VERSION,
      sessionId: input.sessionId,
    },
  );
}
