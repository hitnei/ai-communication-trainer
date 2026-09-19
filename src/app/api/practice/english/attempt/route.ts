import { NextResponse } from "next/server";
import { submitEnglishAttempt } from "@/application/practice/english-practice-service";

export const maxDuration = 60;

/**
 * Accepts an audio recording (FormData) for an English attempt, transcribes and
 * analyzes it, and returns the structured result. A route handler is used
 * (rather than a server action) because it streams a binary upload.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const sessionId = form.get("sessionId");
  const audio = form.get("audio");
  const clientTranscript = form.get("clientTranscript");
  const durationMs = form.get("durationMs");

  if (typeof sessionId !== "string" || !(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "sessionId and audio are required" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mimeType = audio.type || "audio/webm";

  try {
    const result = await submitEnglishAttempt({
      sessionId,
      audio: buffer,
      mimeType,
      durationMs:
        typeof durationMs === "string" ? Number(durationMs) || undefined : undefined,
      clientTranscript:
        typeof clientTranscript === "string" ? clientTranscript : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
