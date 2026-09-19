import { listQuestions } from "@/application/question/question-bank-service";
import { QuestionBank } from "@/features/question/question-bank";

export const dynamic = "force-dynamic";

export default function QuestionsPage() {
  const questions = listQuestions();
  return <QuestionBank initial={questions} />;
}
