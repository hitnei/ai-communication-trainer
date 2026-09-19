# Database

The AI Communication & Interview Trainer stores all data in a **local SQLite
database** accessed through **Drizzle ORM**. The design is *local-first* (§8):
the app runs entirely on the user's machine with no external database service,
and it is always runnable out of the box because migrations are applied
automatically on boot.

- **Schema definition:** `src/infrastructure/db/schema.ts`
- **Connection / bootstrap:** `src/infrastructure/db/client.ts`
- **Data access (practice loop):** `src/infrastructure/db/repositories/practice-repository.ts`
- **Migrations output:** `./drizzle`
- **Drizzle Kit config:** `drizzle.config.ts`

## Design principles

| Principle | How it is realized |
| --- | --- |
| Local-first | Single SQLite file on disk, path from `DATABASE_PATH` (default `./.data/app.db`). |
| Always runnable | `client.ts` runs pending migrations from `./drizzle` on startup. |
| No DB access from UI | Only repositories touch `db`; server actions/services call repositories (§87). |
| Readable timestamps | All timestamps are ISO-8601 strings via `strftime('%Y-%m-%dT%H:%M:%fZ','now')`, matching domain types. |
| Self-describing IDs | Primary keys are prefixed UUIDs from `src/lib/ids.ts` (e.g. `ses_…`, `att_…`, `fb_…`). |
| Audio as files, not blobs | Recordings live on the filesystem; SQLite stores only metadata/pointers. |

## Connection and pragmas

`createDb()` in `client.ts`:

1. Resolves `DATABASE_PATH`, creates the parent directory if missing.
2. Opens the file with `better-sqlite3`.
3. Sets pragmas:
   - `journal_mode = WAL` — write-ahead logging so reads are not blocked by writes.
   - `foreign_keys = ON` — foreign-key constraints (and `ON DELETE CASCADE`) are enforced.
4. Wraps the connection with Drizzle (`drizzle(sqlite, { schema })`).
5. Runs `migrate(instance, { migrationsFolder: path.resolve("drizzle") })`.
   Migration failures are logged (`"Database migration failed"`) but do not crash the process.

The Drizzle instance is a **singleton**: it is cached on `globalThis.__app_db__`
in non-production so hot reloads reuse one connection. The module is marked
`import "server-only"` — the database is never bundled into the client.

## Current tables

The schema currently covers Phase 0/1: the user profile and the Vietnamese
practice loop. Four tables exist today.

### `profiles`

The single-user profile driving prompt personalization.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | text | Primary key. |
| `current_role` | text | Nullable. |
| `years_experience` | integer | Nullable. |
| `target_role` | text | Nullable. |
| `target_markets` | text | Nullable; JSON array. |
| `primary_skills` | text | Nullable; JSON array. |
| `secondary_skills` | text | Nullable; JSON array. |
| `english_goal` | text | Nullable. |
| `transcript_mode` | text | NOT NULL, default `"after"` (§21). |
| `created_at` | text | NOT NULL, default now (ISO-8601). |
| `updated_at` | text | NOT NULL, default now (ISO-8601). |

Row type: `ProfileRow` (`typeof profiles.$inferSelect`).

### `practice_sessions`

One row per practice session. A session holds one prompt and accumulates
multiple attempts.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | text | Primary key (`ses_…`). |
| `mode` | text | NOT NULL; `"vietnamese"` \| `"english"`. |
| `goal` | text | NOT NULL. |
| `exercise_type` | text | Nullable; one of the Vietnamese exercise types (see `src/domain/practice/types.ts`). |
| `prompt` | text | NOT NULL. |
| `question_id` | text | Nullable; forward reference to a future `questions` table (Planned). |
| `status` | text | NOT NULL, default `"active"`; `active` \| `completed` \| `abandoned`. |
| `started_at` | text | NOT NULL, default now. |
| `completed_at` | text | Nullable; set when status becomes `completed`. |

Row type: `PracticeSessionRow`. Maps to domain `PracticeSession`
(`src/domain/practice/types.ts`).

### `practice_attempts`

One row per attempt within a session. Attempt numbering, coaching stage, and
completion are owned by the application service
`src/application/practice/vietnamese-coach-service.ts` (Rule 3), not the DB.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | text | Primary key (`att_…`). |
| `session_id` | text | NOT NULL; FK → `practice_sessions.id`, `ON DELETE CASCADE`. |
| `attempt_number` | integer | NOT NULL. |
| `text_answer` | text | Nullable. |
| `audio_recording_id` | text | Nullable; pointer to a future `audio_recordings` row (Planned). |
| `transcript_id` | text | Nullable; pointer to a future `transcripts` row (Planned). |
| `feedback_id` | text | Nullable; set to the `feedback_items.id` after feedback is saved. |
| `created_at` | text | NOT NULL, default now. |

Row type: `PracticeAttemptRow`. Maps to domain `PracticeAttempt`.

> Note: `audio_recording_id` and `transcript_id` columns exist now but are not
> populated in Phase 0/1 — the tables they reference are Planned (see below).

### `feedback_items`

The validated AI feedback produced for an attempt, stored as JSON alongside the
provenance needed for observability and auditing.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | text | Primary key (`fb_…`). |
| `attempt_id` | text | NOT NULL; FK → `practice_attempts.id`, `ON DELETE CASCADE`. |
| `role` | text | NOT NULL; AI role that produced the feedback (e.g. `vietnamese-coach`). |
| `prompt_version` | text | NOT NULL (e.g. `vietnamese-coach@1.0`). |
| `stage` | text | NOT NULL; coaching stage at time of feedback (`diagnose` / `guide` / `improve`). |
| `payload` | text | NOT NULL; JSON of the validated feedback object. |
| `created_at` | text | NOT NULL, default now. |

Row type: `FeedbackItemRow`. The `payload` is a serialized
`VietnameseCoachFeedback` (`src/domain/practice/vietnamese-feedback.ts`), which
separates *thinking* from *communication* feedback. On save,
`practiceRepository.saveFeedback()` inserts the row **and** back-fills
`practice_attempts.feedback_id` in the same call.

## Relationships

```
profiles                (standalone; single-user profile)

practice_sessions 1 ──< practice_attempts 1 ──< feedback_items
        │  (session_id, ON DELETE CASCADE)  │  (attempt_id, ON DELETE CASCADE)
```

- Deleting a session cascades to its attempts, and deleting an attempt cascades
  to its feedback items (enforced by `foreign_keys = ON`).
- `practice_attempts.feedback_id` is a convenience denormalized pointer to the
  latest `feedback_items` row for that attempt.
- `question_id`, `audio_recording_id`, and `transcript_id` are plain text
  columns today (no FK) that anticipate Planned tables.

## Migration workflow

Migrations are generated with **Drizzle Kit** and applied automatically at
runtime.

1. **Edit the schema** in `src/infrastructure/db/schema.ts`.
2. **Generate a migration:**

   ```bash
   npm run db:generate      # runs: drizzle-kit generate
   ```

   This writes a new SQL file and updated snapshot into `./drizzle`
   (current baseline: `drizzle/0000_lowly_kronos.sql`, snapshot under
   `drizzle/meta/`).
3. **Run the app.** On boot, `client.ts` calls `migrate(...)` against
   `./drizzle`, applying any pending migrations to the SQLite file. There is no
   separate "migrate" command in normal use — startup handles it.

`drizzle.config.ts` points at the schema, outputs to `./drizzle`, uses the
`sqlite` dialect, and reads the DB URL from `DATABASE_PATH`.

## Audio storage decision (files, not blobs)

Audio recordings are **not** stored in SQLite. They are written to the local
filesystem, and the database holds only metadata that points to them (§8). This
keeps the SQLite file small and avoids large-blob write amplification under WAL.

- Interface: `AudioStorage` / `StoredAudio` in `src/infrastructure/audio/types.ts`.
- Implementation: `LocalAudioStorage` in
  `src/infrastructure/audio/local-audio-storage.ts` (used from Phase 2 on).
  - Files are written under `AUDIO_STORAGE_DIR` (default `./.data/audio`).
  - Filenames are `${id}.${ext}`, with extension derived from MIME type
    (`webm`, `ogg`, `m4a`, `mp3`, `wav`, else `bin`).
  - `StoredAudio` records `relativePath`, `mimeType`, and `bytes` — the metadata
    a future `audio_recordings` table will persist.

## Deletion and privacy controls

Because everything is local, privacy is primarily a function of what lives on the
user's disk and how it is removed.

- **Repository deletions** (`practice-repository.ts`):
  - `deleteAttempt(attemptId)` — removes an attempt (cascades to its feedback items).
  - `deleteSession(sessionId)` — removes a session (cascades to attempts, then feedback items).
- **Cascade guarantees:** enabled by `foreign_keys = ON`, so deleting a parent
  never orphans children.
- **Audio deletion:** `LocalAudioStorage.delete(relativePath)` removes the file
  from disk (force-unlink). Audio files are not covered by SQL cascades and must
  be deleted alongside their metadata.
- **Secrets never in the DB:** `GEMINI_API_KEY` is validated server-side in
  `src/lib/env.ts` (`import "server-only"`) and never stored or shipped to the
  client. With no key, the app falls back to the deterministic mock provider.

## Environment variables

Validated by the Zod schema in `src/lib/env.ts`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_PATH` | `./.data/app.db` | SQLite file location. |
| `AUDIO_STORAGE_DIR` | `./.data/audio` | Directory for audio files. |

## Planned tables (future phases)

The following entities are anticipated by existing ID prefixes in
`src/lib/ids.ts` and by forward-reference columns already present in the schema,
but the tables **do not exist yet**. They are marked Planned and will be added in
their respective phases.

| Table | Status | Anticipated by | Purpose |
| --- | --- | --- | --- |
| `questions` | Planned | `practice_sessions.question_id`, `ids.question` (`q_…`) | Reusable practice/interview question bank. |
| `audio_recordings` | Planned (Phase 2) | `practice_attempts.audio_recording_id`, `ids.recording` (`rec_…`), `LocalAudioStorage` | Metadata for stored audio files (path, MIME type, bytes). |
| `transcripts` | Planned (Phase 2) | `practice_attempts.transcript_id`, `ids.transcript` (`txt_…`) | Speech-to-text transcripts of recordings. |
| `communication_memories` | Planned | `ids.memory` (`mem_…`) | Long-term learner memory feeding the prompt's memory section. |
| `memory_evidence` | Planned | `ids.evidence` (`ev_…`) | Evidence/citations backing each memory entry. |
| `skill_progress` | Planned | Feedback taxonomy / skill dimensions (`src/domain/feedback/taxonomy.ts`) | Per-skill progress tracking over time. |
| `flashcards` | Planned | `ids.flashcard` (`card_…`) | Spaced-repetition review items derived from feedback. |
| `projects` | Planned | `ids.project` (`proj_…`) | User projects/experiences referenced in answers. |
| `job_descriptions` | Planned | `ids.jd` (`jd_…`) | Target job descriptions for interview tailoring. |

> The `ids` map already defines prefixes for these entities so IDs are
> consistent and self-describing before the tables land. When a Planned table is
> implemented, its forward-reference column (where one exists) should be upgraded
> to a real foreign key with an appropriate `ON DELETE` policy.
