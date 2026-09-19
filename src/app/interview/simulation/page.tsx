import { UsersRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function SimulationPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Full Interview Simulation
        </h1>
        <p className="text-muted-foreground">
          A timed, end-to-end mock interview.
        </p>
      </header>
      <Card>
        <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
          <UsersRound className="size-5 text-primary" />
          Full simulation (the interviewer stays in role until the end, with a
          detailed review afterward) arrives in the next phase. For now, use
          Individual practice to master one question at a time.
        </CardContent>
      </Card>
    </div>
  );
}
