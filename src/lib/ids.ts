import { randomUUID } from "node:crypto";

/**
 * Prefixed, sortable-enough identifiers. Prefix makes IDs self-describing in
 * logs and the DB without coupling to a specific table.
 */
export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export const ids = {
  session: () => createId("ses"),
  attempt: () => createId("att"),
  feedback: () => createId("fb"),
  question: () => createId("q"),
  memory: () => createId("mem"),
  evidence: () => createId("ev"),
  flashcard: () => createId("card"),
  recording: () => createId("rec"),
  transcript: () => createId("txt"),
  project: () => createId("proj"),
  profile: () => createId("prof"),
  jd: () => createId("jd"),
} as const;
