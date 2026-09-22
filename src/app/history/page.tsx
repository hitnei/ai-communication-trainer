import {
  listPracticeHistory,
  listInterviewHistory,
} from "@/application/history/history-service";
import { HistoryView } from "@/features/history/history-view";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  return (
    <HistoryView
      practice={listPracticeHistory()}
      interviews={listInterviewHistory()}
    />
  );
}
