import type { VietnameseExerciseType } from "./types";

/**
 * English speaking prompts, in English. Voice-first practice (§20). Focused on
 * the user's real scenarios and Senior Frontend interview material.
 */
export const ENGLISH_PROMPTS: Record<VietnameseExerciseType, string[]> = {
  explain_problem: [
    "Explain a technical blocker you're facing right now, in about 45 seconds. Lead with the main issue.",
    "Describe a tricky production bug and how you narrowed it down.",
  ],
  tell_story: [
    "Tell me about a time a project didn't go as planned and how you handled it.",
    "Walk me through a time you changed the team's technical direction.",
  ],
  give_opinion: [
    "When would you reach for server components over client components, and why?",
    "What matters most to you when reviewing someone else's pull request?",
  ],
  explain_concept: [
    "Explain how React rendering and re-rendering works, to a mid-level engineer.",
    "Explain frontend caching to a non-technical stakeholder.",
  ],
  explain_experience: [
    "Describe the project you're most proud of and your specific role in it.",
    "Walk me through an architecture decision you made and the reasoning behind it.",
  ],
  interview_answer: [
    "Answer: 'Tell me about a time you improved the performance of an app.'",
    "Answer: 'What's your biggest strength as a senior frontend engineer?'",
  ],
  casual_conversation: [
    "A teammate asks what you did on the weekend. Answer naturally in a few sentences.",
    "Introduce yourself briefly to a new team.",
  ],
  rewrite_messy: [
    "Say out loud, unrehearsed, what's on your mind about a current problem - we'll make it clearer together.",
  ],
};

export function firstEnglishPromptFor(type: VietnameseExerciseType): string {
  return ENGLISH_PROMPTS[type][0];
}
