import { NextResponse } from "next/server";
import { LocalAudioStorage } from "@/infrastructure/audio/local-audio-storage";
import { practiceRepository } from "@/infrastructure/db/repositories/practice-repository";

const storage = new LocalAudioStorage();

/** Serve a locally-stored audio recording for playback/replay (§22). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = practiceRepository.getAudioRecording(id);
  if (!row) return new NextResponse("Not found", { status: 404 });

  try {
    const buffer = await storage.read(row.relativePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Length": String(row.bytes),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
