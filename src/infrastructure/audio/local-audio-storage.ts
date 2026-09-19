import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import type { AudioStorage, StoredAudio } from "./types";

const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** Local-filesystem audio storage. Real implementation, used from Phase 2 on. */
export class LocalAudioStorage implements AudioStorage {
  private readonly root = path.resolve(env.AUDIO_STORAGE_DIR);

  async save(id: string, data: Buffer, mimeType: string): Promise<StoredAudio> {
    await mkdir(this.root, { recursive: true });
    const ext = EXT[mimeType] ?? "bin";
    const relativePath = `${id}.${ext}`;
    await writeFile(path.join(this.root, relativePath), data);
    return { id, relativePath, mimeType, bytes: data.byteLength };
  }

  async read(relativePath: string): Promise<Buffer> {
    return readFile(path.join(this.root, relativePath));
  }

  async delete(relativePath: string): Promise<void> {
    await rm(path.join(this.root, relativePath), { force: true });
  }
}
