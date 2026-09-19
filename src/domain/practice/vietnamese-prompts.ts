import type { VietnameseExerciseType } from "./types";

/**
 * Seed prompts for Vietnamese practice, in Vietnamese (the user answers in
 * Vietnamese; §17 text-only in MVP). Focused on the user's real scenarios:
 * explaining blockers, technical decisions, projects, updates (§98).
 */
export const VIETNAMESE_PROMPTS: Record<VietnameseExerciseType, string[]> = {
  explain_problem: [
    "Giải thích một vấn đề kỹ thuật đang chặn tiến độ của bạn, trong khoảng 45 giây.",
    "Mô tả một bug khó mà bạn từng gặp và tại sao nó khó tìm ra.",
  ],
  tell_story: [
    "Kể lại một lần dự án của bạn gặp sự cố ngoài dự kiến và bạn đã xử lý thế nào.",
    "Kể về một lần bạn thuyết phục được team đổi hướng kỹ thuật.",
  ],
  give_opinion: [
    "Nêu quan điểm của bạn: khi nào nên dùng server components thay vì client components?",
    "Theo bạn, điều gì quan trọng nhất khi review code của người khác?",
  ],
  explain_concept: [
    "Giải thích cơ chế re-render của React cho một đồng nghiệp mới.",
    "Giải thích caching ở tầng frontend cho một người không chuyên kỹ thuật.",
  ],
  explain_experience: [
    "Mô tả một dự án bạn tự hào nhất và vai trò cụ thể của bạn trong đó.",
    "Kể về một quyết định kiến trúc bạn từng đưa ra và lý do đằng sau nó.",
  ],
  interview_answer: [
    "Trả lời: 'Hãy kể về một lần bạn cải thiện hiệu năng của một ứng dụng.'",
    "Trả lời: 'Điểm mạnh lớn nhất của bạn với tư cách một senior frontend là gì?'",
  ],
  casual_conversation: [
    "Một đồng nghiệp hỏi cuối tuần bạn làm gì. Trả lời tự nhiên trong vài câu.",
    "Giới thiệu ngắn gọn về bản thân trong một buổi gặp mặt team mới.",
  ],
  rewrite_messy: [
    "Viết ra suy nghĩ lộn xộn hiện tại của bạn về một vấn đề bất kỳ - sau đó ta sẽ cùng làm nó rõ ràng hơn.",
  ],
};

export function firstPromptFor(type: VietnameseExerciseType): string {
  return VIETNAMESE_PROMPTS[type][0];
}
