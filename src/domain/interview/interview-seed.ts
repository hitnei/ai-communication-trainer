import type { InterviewCategoryKey } from "./types";

/**
 * Seed opening questions per category, used as the offline/mock fallback and as
 * grounding when the AI generates the first question. Senior-level, scenario- and
 * trade-off-oriented (§34, §35) rather than definition recall.
 */
export const INTERVIEW_SEED: Record<InterviewCategoryKey, string[]> = {
  react: [
    "Walk me through how you'd stop unnecessary re-renders in a large React list, and the trade-offs of each approach.",
    "When would you reach for useMemo/useCallback, and when is it premature? How do you decide?",
  ],
  javascript: [
    "Explain how the event loop handles a mix of promises and setTimeout, with a concrete example.",
    "How would you debug a memory leak in a long-running single-page app?",
  ],
  typescript: [
    "How do you type a reusable, polymorphic component well, and where do generics start to hurt readability?",
    "Tell me about a time TypeScript's type system caught, or missed, a real bug.",
  ],
  nextjs: [
    "How do you decide between server components, client components, and route handlers for a feature?",
    "Walk me through your caching strategy in the Next.js App Router and its failure modes.",
  ],
  nodejs: [
    "How would you design a Node.js API to stay responsive under a slow downstream dependency?",
  ],
  frontend_architecture: [
    "How would you structure a large frontend codebase so multiple teams can ship without stepping on each other?",
    "Describe a frontend architecture decision you made and the trade-off you accepted.",
  ],
  performance: [
    "A page feels slow on mid-range mobile. Walk me through how you'd find and fix the biggest wins.",
    "How do you measure whether a performance change actually helped users?",
  ],
  state_management: [
    "How do you decide what state lives local, lifted, in context, or in a store? Give an example.",
  ],
  system_design: [
    "Design the frontend for a collaborative document editor. Where are the hard parts?",
  ],
  behavioral: [
    "Tell me about a time a project didn't go as planned and what you did.",
    "Describe a technical decision you disagreed with and how you handled it.",
  ],
  leadership: [
    "Tell me about a time you raised the bar for your team's engineering quality.",
  ],
};

export function seedOpeningQuestion(categories: string[]): string {
  for (const key of categories) {
    const list = INTERVIEW_SEED[key as InterviewCategoryKey];
    if (list && list.length) return list[0];
  }
  return INTERVIEW_SEED.react[0];
}
