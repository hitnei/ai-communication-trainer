import { getSessionState } from "@/application/practice/vietnamese-coach-service";
import { getQuestion } from "@/application/question/question-bank-service";
import { StartPractice } from "@/features/practice/vietnamese/start-practice";
import { VietnamesePractice } from "@/features/practice/vietnamese/vietnamese-practice";

export const dynamic = "force-dynamic";

export default async function VietnamesePracticePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const sessionId = typeof params.session === "string" ? params.session : null;

  if (sessionId) {
    const state = getSessionState(sessionId);
    if (state) {
      return (
        <VietnamesePractice
          session={state.session}
          initialAttempts={state.attempts}
        />
      );
    }
  }

  const questionId =
    typeof params.questionId === "string" ? params.questionId : null;
  const question = questionId ? getQuestion(questionId) : null;

  return (
    <StartPractice
      seededQuestion={
        question ? { id: question.id, text: question.text } : undefined
      }
    />
  );
}
