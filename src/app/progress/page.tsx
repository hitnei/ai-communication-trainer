import { getProgressOverview } from "@/application/progress/progress-service";
import { ProgressView } from "@/features/progress/progress-view";

export const dynamic = "force-dynamic";

export default function ProgressPage() {
  const data = getProgressOverview();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">
          How your communication is trending - by dimension, with evidence, not a
          single score.
        </p>
      </header>
      <ProgressView data={data} />
    </div>
  );
}
