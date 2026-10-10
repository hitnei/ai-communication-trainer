import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvalHistory } from "@/application/eval/eval-service";
import { EvalTimeline } from "@/features/eval/eval-timeline";

export const dynamic = "force-dynamic";

export default async function EvalHistoryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const history = await getEvalHistory();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Eval Progress</h1>
        <p className="text-muted-foreground">
          How each prompt performed over time: which version was measured,
          what changed in its text, and which test cases started passing or
          broke. To run a new eval, go to{" "}
          <Link href="/dev/eval" className="text-primary underline-offset-4 hover:underline">
            Prompt Eval
          </Link>
          .
        </p>
      </header>
      <EvalTimeline history={history} />
    </div>
  );
}
