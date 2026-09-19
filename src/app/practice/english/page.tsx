import { Mic } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function EnglishPracticePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          English Practice
        </h1>
        <p className="text-muted-foreground">Voice-first speaking practice.</p>
      </header>
      <Card>
        <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
          <Mic className="size-5 text-primary" />
          Voice recording, transcript, and spoken-English analysis arrive in
          Phase 2. The architecture (audio + speech provider interfaces) is
          already in place.
        </CardContent>
      </Card>
    </div>
  );
}
