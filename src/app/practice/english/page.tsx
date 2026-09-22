import { getEnglishSessionState } from "@/application/practice/english-practice-service";
import { getQuestion } from "@/application/question/question-bank-service";
import { StartEnglish } from "@/features/practice/english/start-english";
import { EnglishPractice } from "@/features/practice/english/english-practice";

export const dynamic = "force-dynamic";

export default async function EnglishPracticePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const sessionId = typeof params.session === "string" ? params.session : null;

  if (sessionId) {
    const state = getEnglishSessionState(sessionId);
    if (state) {
      return (
        <EnglishPractice
          session={state.session}
          initialAttempts={state.attempts}
          initialTranscriptMode={state.transcriptMode}
        />
      );
    }
  }

  const questionId =
    typeof params.questionId === "string" ? params.questionId : null;
  const question = questionId ? getQuestion(questionId) : null;
  const seededText =
    question?.text ??
    (typeof params.prompt === "string" ? params.prompt : undefined);

  return (
    <StartEnglish
      seed={
        seededText
          ? { text: seededText, questionId: question?.id }
          : undefined
      }
    />
  );
}
