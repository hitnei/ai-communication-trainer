import "server-only";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Local SQLite connection (§8 local-first). A single connection is reused
 * across the server process. WAL mode for concurrent reads during writes.
 */
function createDb() {
  const dbPath = path.resolve(env.DATABASE_PATH);
  const dir = path.dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const instance = drizzle(sqlite, { schema });
  // Local-first: apply migrations on startup so the app is always runnable.
  try {
    migrate(instance, { migrationsFolder: path.resolve("drizzle") });
  } catch (e) {
    console.error("Database migration failed", e);
  }
  return instance;
}

declare global {
  var __app_db__: ReturnType<typeof createDb> | undefined;
}

export const db = globalThis.__app_db__ ?? createDb();
if (process.env.NODE_ENV !== "production") globalThis.__app_db__ = db;
