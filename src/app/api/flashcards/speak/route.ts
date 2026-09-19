import { NextResponse } from "next/server";
import { runPronunciationCoach } from "@/infrastructure/ai/roles/pronunciation-coach";

export const maxDuration = 45;

/**
 * Speaking review for a flashcard (§56): the user says the phrase, we analyze
 * pronunciation. Audio is analyzed in-memory and not stored - this is a quick
 * check, not a saved attempt.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const phrase = form.get("phrase");
  const audio = form.get("audio");
  if (typeof phrase !== "string" || !(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "phrase and audio are required" },
      { status: 400 },
    );
  }
  const buffer = Buffer.from(await audio.arrayBuffer());
  try {
    const pronunciation = await runPronunciationCoach({
      audioBase64: buffer.toString("base64"),
      mimeType: audio.type || "audio/webm",
      transcript: phrase,
    });
    return NextResponse.json({ ok: true, pronunciation });
  } catch {
    return NextResponse.json({
      ok: false,
      message: "Couldn't analyze that recording. Try again.",
    });
  }
}
