import { getIndividualInterviewState } from "@/application/interview/individual-interview-service";
import { StartInterview } from "@/features/interview/individual/start-interview";
import { IndividualInterview } from "@/features/interview/individual/individual-interview";

export const dynamic = "force-dynamic";

export default async function IndividualInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const sessionId = typeof params.session === "string" ? params.session : null;

  if (sessionId) {
    const state = getIndividualInterviewState(sessionId);
    if (state) {
      return (
        <IndividualInterview session={state.session} initialState={state} />
      );
    }
  }

  return <StartInterview />;
}
