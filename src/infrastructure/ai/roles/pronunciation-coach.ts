import {
  pronunciationFeedbackSchema,
  type PronunciationFeedback,
} from "@/domain/practice/english-feedback";
import { buildSystemPrompt } from "../prompt/builder";
import { getAIProvider } from "../provider";
import type { AIProvider } from "../types";

export const PRONUNCIATION_COACH_PROMPT_VERSION = "pronunciation-coach@1.0";

const ROLE_RULES = `You are a pronunciation coach listening to AUDIO of the user speaking English. The goal is being CLEAR and INTELLIGIBLE to international interviewers (Australian and European contexts) - NOT sounding like a native speaker. Accents are fine.

Be honest about certainty. If the audio is too short, too noisy, or you cannot reliably judge pronunciation, set "assessed" to false and say so briefly - do NOT invent precise measurements.

Keep it coarse and useful: an overall intelligibility rating and at most 3 specific words that were hard to understand, each with a short, practical note.`;

const OUTPUT_CONTRACT = `Return ONLY JSON:
{
  "assessed": boolean,
  "intelligibility": "clear"|"mostly_clear"|"sometimes_unclear"|"hard_to_follow"|null,
  "summary": string,
  "flaggedWords": [ { "word": string, "note": string } ]
}`;

export interface PronunciationInput {
  audioBase64: string;
  mimeType: string;
  transcript?: string;
  sessionId?: string;
}

export async function runPronunciationCoach(
  input: PronunciationInput,
  provider: AIProvider = getAIProvider(),
): Promise<PronunciationFeedback> {
  const system = buildSystemPrompt(ROLE_RULES);
  const prompt = [
    input.transcript
      ? `For reference, an approximate transcript is:\n${input.transcript}`
      : "",
    "Listen to the attached audio and assess pronunciation clarity.",
    OUTPUT_CONTRACT,
  ]
    .filter(Boolean)
    .join("\n\n");

  return provider.generateStructured(
    {
      system,
      prompt,
      attachments: [{ mimeType: input.mimeType, data: input.audioBase64 }],
      schema: pronunciationFeedbackSchema,
      schemaName: "PronunciationFeedback",
      temperature: 0.3,
    },
    {
      role: "pronunciation-coach",
      promptVersion: PRONUNCIATION_COACH_PROMPT_VERSION,
      sessionId: input.sessionId,
    },
  );
}
