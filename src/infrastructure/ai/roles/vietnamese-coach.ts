import {
  vietnameseCoachFeedbackSchema,
  type VietnameseCoachFeedback,
} from "@/domain/practice/vietnamese-feedback";
import type { CoachingPolicy } from "@/domain/practice/coaching-stage";
import { EXERCISE_LABELS } from "@/domain/practice/types";
import type { VietnameseExerciseType } from "@/domain/practice/types";
import { buildSystemPrompt, buildUserPrompt } from "../prompt/builder";
import { getAIProvider } from "../provider";
import type { AIProvider } from "../types";

export const VIETNAMESE_COACH_PROMPT_VERSION = "vietnamese-coach@1.0";

const ROLE_RULES = `You are a Vietnamese-speaking communication coach. Your job is to help the user turn messy thoughts into clear, structured, concise, complete communication (thinking + communication — this is NOT an English lesson).

Respond entirely in natural Vietnamese.

Separate two kinds of problems and never confuse them:
- THINKING problems: unclear idea, missing point, weak logic, poor structure.
- COMMUNICATION problems: too long, repetitive, main point comes too late, unclear explanation, incomplete explanation.

Staged coaching — obey the stage you are told:
- diagnose (attempt 1): identify the real problems, explain why they matter, and ask a few useful reflection questions. DO NOT provide a full rewritten answer. DO NOT give a finished structure.
- guide (attempt 2): give direction and structural hints so the user can improve it themselves. Still DO NOT provide a full rewritten answer.
- improve (attempt 3+): you MAY provide an improved version. Preserve ~80-90% of the user's own style and wording.

Always identify the single most important thing to fix first. Do not dump 15 corrections.`;

export interface VietnameseCoachInput {
  exerciseType?: VietnameseExerciseType;
  prompt: string;
  answer: string;
  attemptNumber: number;
  policy: CoachingPolicy;
  previousAnswer?: string;
  relevantMemory?: string;
  sessionId?: string;
}

function buildTask(input: VietnameseCoachInput): string {
  const exercise = input.exerciseType
    ? EXERCISE_LABELS[input.exerciseType]
    : "communication";
  const stageInstruction: Record<CoachingPolicy["stage"], string> = {
    diagnose:
      "This is attempt 1 (stage: diagnose). Diagnose and ask reflection questions. Do NOT write the improved version — leave improvedVersion null and suggestions empty or minimal.",
    guide:
      "This is attempt 2 (stage: guide). Give direction and structural hints in `suggestions`. Do NOT write the full improved version — leave improvedVersion null.",
    improve:
      "This is attempt 3 or later (stage: improve). You MAY fill `improvedVersion`, preserving the user's voice (~80-90% of their wording).",
  };

  return [
    `Exercise type: ${exercise}`,
    `Prompt the user was answering:\n${input.prompt}`,
    input.previousAnswer
      ? `The user's previous attempt (for comparison):\n${input.previousAnswer}`
      : null,
    `The user's current answer (attempt ${input.attemptNumber}):\n${input.answer}`,
    "",
    stageInstruction[input.policy.stage],
  ]
    .filter(Boolean)
    .join("\n\n");
}

const OUTPUT_CONTRACT = `Return ONLY JSON with this shape:
{
  "summary": string,                // one honest, human sentence
  "strengths": string[],
  "issues": [ { "category": "thinking"|"communication", "code": string, "title": string, "detail": string } ],
  "reflectionQuestions": string[],  // rich in diagnose stage
  "suggestions": string[],          // direction/hints from guide stage on
  "improvedVersion": string | null, // null unless improve stage
  "nextAction": "retry" | "satisfied_or_retry"
}`;

/** Run the Vietnamese Coach for one attempt and return validated feedback. */
export async function runVietnameseCoach(
  input: VietnameseCoachInput,
  provider: AIProvider = getAIProvider(),
): Promise<VietnameseCoachFeedback> {
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
      schema: vietnameseCoachFeedbackSchema,
      schemaName: "VietnameseCoachFeedback",
      temperature: 0.5,
    },
    {
      role: "vietnamese-coach",
      promptVersion: VIETNAMESE_COACH_PROMPT_VERSION,
      sessionId: input.sessionId,
    },
  );
}
