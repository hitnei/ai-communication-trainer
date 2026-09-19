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
};
