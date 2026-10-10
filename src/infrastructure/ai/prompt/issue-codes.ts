import {
  COMMUNICATION_CODES,
  ENGLISH_CODES,
  THINKING_CODES,
} from "@/domain/feedback/taxonomy";

type ThinkingCode = (typeof THINKING_CODES)[number];
type CommunicationCode = (typeof COMMUNICATION_CODES)[number];
type EnglishCode = (typeof ENGLISH_CODES)[number];

const THINKING_MEANING: Record<ThinkingCode, string> = {
  unclear_idea: "the idea itself is not clear yet",
  missing_point: "a key point that should be there is absent",
  weak_logic: "the reasoning does not support the conclusion",
  poor_structure: "the ideas come in a confusing order",
};

const COMMUNICATION_MEANING: Record<CommunicationCode, string> = {
  too_long: "more words than the point needs",
  repetitive: "the same idea is restated",
  main_point_late: "the key point arrives only after a long setup",
  unclear: "the explanation is hard to follow",
  incomplete: "the explanation stops before the listener has what they need",
};

const ENGLISH_MEANING: Record<EnglishCode, string> = {
  grammar: "a clear grammatical mistake",
  vocabulary: "a wrong or weak word choice",
  unnatural_phrase: "grammatical, but not how a native speaker would say it",
  fluency: "hesitation or breaks that hurt the flow",
  filler: "filler words used as a crutch",
};

function lines<T extends string>(codes: readonly T[], meaning: Record<T, string>): string {
  return codes.map((code) => `    ${code}: ${meaning[code]}`).join("\n");
}

const THINKING_LINES = lines(THINKING_CODES, THINKING_MEANING);
const COMMUNICATION_LINES = lines(COMMUNICATION_CODES, COMMUNICATION_MEANING);

/** Issue-code rules for the Vietnamese Coach: codes must match their category. */
export const VIETNAMESE_CODE_RULES = `Issue codes. Use ONLY these codes, and a code must belong to the category you give it:
- category "thinking", code is one of:
${THINKING_LINES}
- category "communication", code is one of:
${COMMUNICATION_LINES}`;

/** Issue-code rules for the English Coach. */
export const ENGLISH_CODE_RULES = `Issue codes. Use ONLY these codes, and a code must belong to the category you give it:
- category "content", code is one of:
${THINKING_LINES}
${COMMUNICATION_LINES}
- category "english", code is one of:
${lines(ENGLISH_CODES, ENGLISH_MEANING)}`;
