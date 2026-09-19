import { getEnglishSessionState } from "@/application/practice/english-practice-service";
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

  return <StartEnglish />;
}
