import { getSimulationState } from "@/application/interview/simulation-service";
import { StartSimulation } from "@/features/interview/simulation/start-simulation";
import { SimulationInterview } from "@/features/interview/simulation/simulation-interview";

export const dynamic = "force-dynamic";

export default async function SimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const sessionId = typeof params.session === "string" ? params.session : null;

  if (sessionId) {
    const state = getSimulationState(sessionId);
    if (state) {
      return (
        <SimulationInterview session={state.session} initialState={state} />
      );
    }
  }

  return <StartSimulation />;
}
