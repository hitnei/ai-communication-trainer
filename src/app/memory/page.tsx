import { listMemoriesWithEvidence } from "@/application/memory/memory-service";
import { MemoryList } from "@/features/memory/memory-list";

export const dynamic = "force-dynamic";

export default function MemoryPage() {
  const items = listMemoriesWithEvidence();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Personal Memory</h1>
        <p className="text-muted-foreground">
          Recurring patterns the system has noticed across your sessions. These
          quietly shape future coaching - every one is traceable to where it came
          from, and you can remove any of them.
        </p>
      </header>
      <MemoryList items={items} />
    </div>
  );
}
