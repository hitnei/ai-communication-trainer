import { NextResponse } from "next/server";
import { submitInterviewAnswer } from "@/application/interview/individual-interview-service";

export const maxDuration = 60;

/** Accept a spoken interview answer (FormData), transcribe, evaluate, respond. */
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
  try {
    const result = await submitInterviewAnswer({
      sessionId,
      audio: buffer,
      mimeType: audio.type || "audio/webm",
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
