import { notFound } from "next/navigation";
import { getEvalOverview } from "@/application/eval/eval-service";
import { EvalDashboard } from "@/features/eval/eval-dashboard";

export const dynamic = "force-dynamic";

export default async function EvalPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const overview = await getEvalOverview();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Prompt Eval</h1>
        <p className="text-muted-foreground">
          Runs the coaching prompts against fixed test cases and checks the
          output with deterministic rules. Change a prompt, run again, and see
          whether it got better or worse than the saved baseline.
        </p>
      </header>
      <EvalDashboard overview={overview} />
    </div>
  );
}
