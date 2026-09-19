import { logAiCall } from "@/lib/logger";
import { AIProviderError } from "./errors";
import { runStructured } from "./structured";
import type {
  AICallMeta,
  AIProvider,
  GenerateStructuredParams,
  GenerateTextParams,
} from "./types";

/**
 * Deterministic offline provider used when no GEMINI_API_KEY is configured, so
 * the whole product loop is runnable and testable without a live vendor (§109
 * "isolate stubs behind provider interfaces"). It is role-aware: it returns
 * believable canned structured output keyed by AICallMeta.role.
 *
 * Note on the coaching stage: this mock may return a full object (including an
 * improved version). Enforcing "no full rewrite before attempt 3" is the
 * APPLICATION layer's job (Rule 3), not the provider's - so canned output here
 * does not violate the staged-coaching rule.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generateText(
    params: GenerateTextParams,
    meta: AICallMeta,
  ): Promise<string> {
    logAiCall({
      role: meta.role,
      promptVersion: meta.promptVersion,
      provider: this.name,
      sessionId: meta.sessionId,
      latencyMs: 0,
      ok: true,
    });
    return `【mock:${meta.role}】 ${params.prompt.slice(0, 80)}`;
  }

  async generateStructured<T>(
    params: GenerateStructuredParams<T>,
    meta: AICallMeta,
  ): Promise<T> {
    const canned = mockResponses[meta.role];
    if (!canned) {
      throw new AIProviderError(
        `Mock AI provider has no canned response for role "${meta.role}". ` +
          `Add one in mock-provider.ts or configure GEMINI_API_KEY.`,
      );
    }
    // Route through the same validation loop the real provider uses.
    const result = await runStructured<T>({
      schema: params.schema,
      schemaName: params.schemaName ?? "response",
      basePrompt: params.prompt,
      generate: async () => JSON.stringify(canned(params.prompt)),
    });
    logAiCall({
      role: meta.role,
      promptVersion: meta.promptVersion,
      provider: this.name,
      sessionId: meta.sessionId,
      latencyMs: 0,
      ok: true,
    });
    return result;
  }
}

/**
 * Canned outputs per AI role. Deliberately human-sounding (Rule 5) and in the
 * right language per role. These are fixtures, not product logic.
 */
const mockResponses: Record<string, (prompt: string) => unknown> = {
  "vietnamese-coach": () => ({
    summary:
      "Ý chính của bạn có ở đó, nhưng mình phải đọc đến gần cuối mới hiểu vấn đề thật sự là gì.",
    strengths: [
      "Bạn có đủ thông tin cần thiết, không thiếu dữ kiện quan trọng.",
    ],
    issues: [
      {
        category: "communication",
        code: "main_point_late",
        title: "Ý chính xuất hiện quá muộn",
        detail:
          "Bạn dành 2-3 câu đầu để kể bối cảnh trước khi nói ra vấn đề. Người nghe phải chờ mới nắm được điều quan trọng nhất.",
      },
      {
        category: "communication",
        code: "too_long",
        title: "Hơi dài dòng",
        detail:
          "Một vài câu lặp lại ý đã nói. Nếu gọn hơn, thông điệp sẽ mạnh hơn.",
      },
    ],
    reflectionQuestions: [
      "Nếu chỉ được nói MỘT câu, bạn sẽ tóm vấn đề này thế nào?",
      "Người nghe cần biết điều gì đầu tiên để hiểu ngay?",
    ],
    suggestions: [
      "Mở đầu bằng một câu nêu thẳng vấn đề, rồi mới bổ sung bối cảnh nếu cần.",
    ],
    // The mock always returns a rewrite; the APPLICATION layer strips it before
    // attempt 3 (enforceCoachingPolicy). This makes the guardrail observable.
    improvedVersion:
      "Vấn đề chính là API trả về chậm ở màn hình danh sách. Nguyên nhân là mình đang gọi tuần tự nhiều request; mình định gộp lại thành một request để giảm thời gian tải.",
    nextAction: "satisfied_or_retry",
  }),

  "english-coach": () => ({
    summary:
      "Your point comes through, but it takes a while to land, and a couple of fillers pull focus.",
    strengths: ["You gave a concrete cause and a clear next step."],
    issues: [
      {
        category: "content",
        code: "main_point_late",
        title: "Main point arrives late",
        detail:
          "You open with 'So the main issue is that our list screen loads slowly' but then stack context before the fix.",
        evidence: "So the main issue is that our list screen loads slowly",
        naturalness: null,
      },
      {
        category: "english",
        code: "filler",
        title: "\"basically\" and \"you know\" as crutches",
        detail:
          "A couple of fillers are fine in speech, but here they break the rhythm right before your key point.",
        evidence: "basically it's because we're making a lot of API calls",
        naturalness: "context_dependent",
      },
    ],
    topFocusAreas: [
      "State the problem and the fix in the first sentence",
      "Trim filler right before your main point",
    ],
    // App gates this to attempt 2+; mock always provides it.
    improvedVersion:
      "The list screen loads slowly because we make several API calls in sequence. I'd batch them into one request to cut the load time.",
    comparison: null,
  }),

  "pronunciation-coach": () => ({
    assessed: true,
    intelligibility: "mostly_clear",
    summary:
      "You're easy to follow overall. A couple of longer words could be a touch clearer.",
    flaggedWords: [
      { word: "sequential", note: "Land each syllable: se-quen-tial." },
    ],
  }),

  "interview-question": () => ({
    question:
      "Walk me through a time you improved the performance of a React app - what was slow, what you changed, and how you knew it worked.",
  }),

  "interview-coach": () => ({
    summary:
      "Solid direction, but it stays at the 'what' level - I don't yet hear the reasoning or the numbers behind it.",
    strengths: ["You named a concrete change (batching requests)."],
    issues: [
      {
        code: "missing_metric",
        title: "No measurement",
        detail:
          "You say it got faster but don't say by how much or how you measured it.",
        evidence: "to make it faster",
      },
      {
        code: "weak_tradeoff",
        title: "No trade-off discussed",
        detail:
          "Batching has costs (latency coupling, error handling). A senior answer names what you gave up.",
        evidence: null,
      },
    ],
    topFocusAreas: [
      "Quantify the impact with a before/after number",
      "Name the trade-off you accepted",
    ],
    followUpQuestion:
      "You said it got faster - how did you measure that, and what was the before/after number?",
    followUpRationale:
      "The answer claimed a performance win (unsupported_claim / missing_metric), so I'm probing for measurement.",
    comparison: null,
  }),

  "interview-next": () => ({
    question:
      "Let's go a level deeper - what alternatives did you consider, and why did you rule them out?",
  }),

  "interview-review": () => ({
    overallSummary:
      "You communicate clearly and give concrete examples, but senior signal comes from the reasoning and numbers behind decisions, which were thin here.",
    readiness: "developing",
    strengths: [
      "Clear structure and concrete examples",
      "Comfortable talking through your work",
    ],
    areasToImprove: [
      {
        code: "missing_metric",
        title: "Quantify impact",
        detail:
          "Several answers claimed improvements without numbers. Anchor claims with before/after metrics.",
        evidence: null,
      },
      {
        code: "weak_tradeoff",
        title: "Name the trade-offs",
        detail:
          "Decisions were presented as obviously correct. Show the alternatives and what you gave up.",
        evidence: null,
      },
    ],
    perQuestion: [
      {
        question: "Opening question",
        note: "Good start; add the measurement you used.",
      },
    ],
    recommendedPractice: [
      "Practice a 45-second 'decision + trade-off + metric' framing for your top 3 projects.",
    ],
    topFocusAreas: ["Quantify impact", "Articulate trade-offs"],
  }),

  // A varied pool so "Generate More" keeps returning fresh items offline.
  "question-generator": () => ({
    questions: [
      { text: "How would you stop unnecessary re-renders in a large React list, and what are the trade-offs?", categories: ["react", "performance"], difficulty: "senior", questionType: "tradeoff" },
      { text: "Walk me through migrating a big class-component codebase to hooks safely.", categories: ["react"], difficulty: "senior", questionType: "scenario" },
      { text: "When do server components help, and when do they add complexity?", categories: ["nextjs"], difficulty: "senior", questionType: "tradeoff" },
      { text: "Describe how you'd design a caching layer for a data-heavy dashboard.", categories: ["performance", "frontend_architecture"], difficulty: "staff", questionType: "decision" },
      { text: "How do you decide where state should live in a growing app?", categories: ["state_management"], difficulty: "senior", questionType: "application" },
      { text: "Tell me about a time you led a risky refactor and how you managed it.", categories: ["leadership", "behavioral"], difficulty: "senior", questionType: "scenario" },
      { text: "How would you debug a memory leak in a long-running SPA?", categories: ["javascript", "performance"], difficulty: "senior", questionType: "scenario" },
      { text: "Explain a TypeScript typing decision that improved a team's velocity.", categories: ["typescript"], difficulty: "senior", questionType: "decision" },
      { text: "Design the frontend for a collaborative editor - where are the hard parts?", categories: ["system_design"], difficulty: "staff", questionType: "scenario" },
      { text: "How do you keep a Node.js API responsive under a slow dependency?", categories: ["nodejs"], difficulty: "senior", questionType: "application" },
      { text: "How would you introduce performance budgets without slowing the team?", categories: ["performance", "leadership"], difficulty: "staff", questionType: "decision" },
      { text: "Describe how you handled disagreement on an architecture decision.", categories: ["behavioral", "frontend_architecture"], difficulty: "senior", questionType: "scenario" },
      { text: "How do you measure whether a frontend performance change actually helped users?", categories: ["performance"], difficulty: "senior", questionType: "application" },
      { text: "When would you choose a state machine over ad-hoc component state?", categories: ["state_management"], difficulty: "senior", questionType: "tradeoff" },
      { text: "Walk me through your approach to accessible, reusable component APIs.", categories: ["react", "frontend_architecture"], difficulty: "senior", questionType: "application" },
      { text: "How would you roll out a breaking change across many teams' frontends?", categories: ["frontend_architecture", "leadership"], difficulty: "staff", questionType: "scenario" },
      { text: "Explain how you'd cut initial bundle size on a large Next.js app.", categories: ["nextjs", "performance"], difficulty: "senior", questionType: "application" },
      { text: "Tell me about mentoring an engineer through a hard technical problem.", categories: ["leadership"], difficulty: "senior", questionType: "scenario" },
      { text: "How do you reason about error handling and retries on the client?", categories: ["javascript", "frontend_architecture"], difficulty: "senior", questionType: "decision" },
      { text: "What's your approach to testing a complex, stateful React feature?", categories: ["react"], difficulty: "senior", questionType: "application" },
    ],
  }),

  "flashcard-suggestor": () => ({
    suggestions: [
      {
        phrase: "I'm running into an issue with…",
        replacementFor: "I have a problem about…",
        meaning: "A natural way to introduce a problem you're facing.",
        example: "I'm running into an issue with slow list rendering.",
        reason: "natural_alternative",
      },
      {
        phrase: "to give you some context",
        replacementFor: null,
        meaning: "Signals you're about to set up background - briefly.",
        example: "To give you some context, this was a high-traffic dashboard.",
        reason: "interview_phrase",
      },
      {
        phrase: "the trade-off there was…",
        replacementFor: null,
        meaning: "Introduces the cost of a decision - strong senior signal.",
        example: "The trade-off there was more memory for faster reads.",
        reason: "useful_phrase",
      },
    ],
  }),
};
