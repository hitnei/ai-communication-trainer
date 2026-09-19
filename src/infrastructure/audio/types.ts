/**
 * Audio storage abstraction. Recordings are stored as local files (§8), never
 * as large SQLite blobs - SQLite holds only metadata that points here.
 */
export interface StoredAudio {
  id: string;
  /** Filesystem path relative to the audio storage dir. */
  relativePath: string;
  mimeType: string;
  bytes: number;
}

export interface AudioStorage {
  save(id: string, data: Buffer, mimeType: string): Promise<StoredAudio>;
  read(relativePath: string): Promise<Buffer>;
  delete(relativePath: string): Promise<void>;
}
