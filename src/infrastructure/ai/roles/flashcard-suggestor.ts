import {
  suggestedPhrasesBatchSchema,
  type SuggestedPhrase,
} from "@/domain/flashcard/schema";
import { buildSystemPrompt, buildUserPrompt } from "../prompt/builder";
import { getAIProvider } from "../provider";
import type { AIProvider } from "../types";

export const FLASHCARD_SUGGESTOR_PROMPT_VERSION = "flashcard-suggestor@1.0";

const ROLE_RULES = `You build a SPEAKING PHRASE BANK for a senior frontend engineer - useful words, phrases, chunks, and expressions for interviews and the workplace. This is NOT a vocabulary drill.

From the user's own transcript, suggest a small number (up to 6) of high-value phrases to learn, each of these kinds when present:
- natural_alternative: a smoother way to say something they said awkwardly. Set replacementFor to THEIR exact wording. (e.g. they said "I have a problem about..." → suggest "I'm running into an issue with...").
- awkward_phrase / repeated_phrase: fix a clunky or over-used phrasing.
- interview_phrase / useful_phrase: a strong expression worth reusing.
- vocab_gap: a precise word they reached for but missed.

Keep phrases short and reusable. Ground the meaning and example in the user's actual technical context. Do not suggest phrases that are already natural and fine.`;

export interface SuggestPhrasesInput {
  context: string;
  sessionId?: string;
}

export async function suggestPhrases(
  input: SuggestPhrasesInput,
  provider: AIProvider = getAIProvider(),
): Promise<SuggestedPhrase[]> {
  const system = buildSystemPrompt(ROLE_RULES);
  const prompt = buildUserPrompt({
    roleRules: ROLE_RULES,
    task: `Here is the user's recent speaking transcript. Suggest phrases worth adding to their speaking bank.\n\n${input.context}`,
    outputContract: `Return ONLY JSON:
{ "suggestions": [ { "phrase": string, "replacementFor": string|null, "meaning": string, "example": string, "reason": "useful_phrase"|"vocab_gap"|"awkward_phrase"|"repeated_phrase"|"interview_phrase"|"natural_alternative" } ] }`,
  });

  const result = await provider.generateStructured(
    {
      system,
      prompt,
      schema: suggestedPhrasesBatchSchema,
      schemaName: "SuggestedPhrases",
      temperature: 0.6,
    },
    {
      role: "flashcard-suggestor",
      promptVersion: FLASHCARD_SUGGESTOR_PROMPT_VERSION,
      sessionId: input.sessionId,
    },
  );
  return result.suggestions;
}
