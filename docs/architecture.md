# Architecture

The AI Communication & Interview Trainer is a **local-first** application built on
Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4, SQLite +
Drizzle, and Zod. AI runs through a provider abstraction - Gemini via
`@google/genai` when a key is present, otherwise a deterministic mock - so the
whole product loop is runnable and testable offline.

This document describes the layered architecture, the dependency rules that keep
it honest, the data- and AI-access rules, the server-only boundaries, the folder
layout, and code-quality conventions. Everything below reflects the code as it
exists today under `src/`. Items not yet built are marked **Planned (Phase N)**.

---

## 1. Layered architecture

Code is organized into four layers with a strict, one-way dependency direction:

```
src/app          UI + server actions        (delivery / framework)
      │  depends on
      ▼
src/application  services own the workflow   (use cases / orchestration)
      │  depends on
      ▼
src/domain       pure rules, types, schemas  (business core - no I/O)
      ▲  depends on
      │
src/infrastructure  ai / db / audio / speech / file-storage  (adapters)
```

| Layer | Directory | Responsibility | May import from |
| --- | --- | --- | --- |
| UI / delivery | `src/app`, `src/features`, `src/components` | React components, pages, server actions, layout | application, domain, infrastructure *types* |
| Application | `src/application` | Owns each use case: attempt numbering, staging, completion, persistence order, error handling | domain, infrastructure |
| Domain | `src/domain` | Pure business rules, entity types, Zod schemas, taxonomy. No I/O, no framework, no DB, no AI SDK | (nothing outside domain) |
| Infrastructure | `src/infrastructure` | Adapters to the outside world: AI providers, SQLite/Drizzle, audio storage, speech | domain (for types/schemas), `src/lib` |

Cross-cutting helpers live in `src/lib` (`env.ts`, `logger.ts`, `ids.ts`,
`utils.ts`) and may be used by any layer.

### The domain is pure

`src/domain` contains no imports of Next.js, Drizzle, the Gemini SDK, or `node:*`
I/O. It holds:

- Entity types - `src/domain/practice/types.ts` (`PracticeSession`,
  `PracticeAttempt`, `VIETNAMESE_EXERCISE_TYPES`, `EXERCISE_LABELS`).
- The **staged-coaching rule** - `src/domain/practice/coaching-stage.ts`.
- Output contracts / Zod schemas - `src/domain/practice/vietnamese-feedback.ts`.
- The feedback taxonomy and skill dimensions -
  `src/domain/feedback/taxonomy.ts`.

Because it is pure, the domain is trivially unit-testable
(`src/domain/practice/coaching-stage.test.ts`).

### The application layer owns the workflow

The rule "**the application controls the workflow; the AI only provides
intelligence**" is enforced in
`src/application/practice/vietnamese-coach-service.ts`. That service - not the AI,
not the UI - decides:

- the attempt number (`practiceRepository.countAttempts(...) + 1`),
- the coaching stage/policy (`coachingPolicyForAttempt(attemptNumber)`),
- that the user's answer is persisted **before** the AI call so it survives any
  AI failure,
- that the staged-coaching guardrail is applied to whatever the AI returns
  (`enforceCoachingPolicy(raw, policy)`),
- when a session completes (`completeVietnameseSession` - user-driven).

---

## 2. Dependency-direction rules

1. **Inward and downward only.** `app → application → domain`. Infrastructure
   depends on the domain for its types and schemas; the domain never depends on
   infrastructure.
2. **The domain depends on nothing outside itself.** No framework, no DB, no AI
   SDK, no filesystem.
3. **Adapters hide vendors behind interfaces.** The only files that import a
   vendor SDK are the adapters themselves:
   - `src/infrastructure/ai/gemini-provider.ts` is the *only* file that imports
     `@google/genai`.
   - `src/infrastructure/db/client.ts` is the *only* file that opens the SQLite
     connection.
   Adding a new AI vendor or swapping the datastore means writing a new adapter -
   no product logic changes.
4. **UI may import infrastructure *types*, never infrastructure *behavior*.**
   Components import types such as `AttemptWithFeedback` from the repository
   module for typing props, but never call the DB or AI directly (see §3, §4).

---

## 3. Data-access rule: component → service → repository (never component → SQLite)

**UI code never touches SQLite.** All persistence goes through the repository,
and all workflow goes through the application service.

```
Server Component / Server Action
        │
        ▼
Application service (src/application/practice/vietnamese-coach-service.ts)
        │
        ▼
Repository (src/infrastructure/db/repositories/practice-repository.ts)
        │
        ▼
Drizzle + better-sqlite3 (src/infrastructure/db/client.ts, schema.ts)
```

- The repository is the single place that builds Drizzle queries and maps rows to
  domain types (`mapSession`, `mapAttempt`). Its module comment states the rule
  directly: *"Data access for the practice loop. UI never touches the DB
  directly."*
- The DB connection module (`client.ts`) is marked `import "server-only"`, so any
  attempt to pull it into a client bundle is a build error.
- Server actions in `src/app/practice/vietnamese/actions.ts` call the service for
  the coaching loop. A few thin, non-workflow mutations (e.g.
  `deleteAttemptAction`) call the repository directly from the action - still
  server-side, still never from a component.

### Database

`src/infrastructure/db/schema.ts` defines the SQLite schema via Drizzle:

| Table | Purpose | Notable columns |
| --- | --- | --- |
| `profiles` | User profile / preferences | `current_role`, `target_role`, `target_markets` (JSON), `primary_skills` (JSON), `transcript_mode` |
| `practice_sessions` | One practice session | `mode`, `goal`, `exercise_type`, `prompt`, `status` (`active`/`completed`/`abandoned`), `started_at`, `completed_at` |
| `practice_attempts` | One attempt within a session | `session_id` (FK, cascade), `attempt_number`, `text_answer`, `audio_recording_id`, `transcript_id`, `feedback_id` |
| `feedback_items` | Validated AI feedback for an attempt | `attempt_id` (FK, cascade), `role`, `prompt_version`, `stage`, `payload` (JSON of the validated feedback object) |

Conventions in the schema:

- IDs are prefixed strings from `src/lib/ids.ts` (e.g. `ses_…`, `att_…`,
  `fb_…`), not autoincrement integers.
- Timestamps are ISO-8601 strings, defaulted in SQL, for readability and to match
  the domain types.
- `client.ts` opens one connection per server process (cached on `globalThis` in
  dev), enables **WAL** journaling and **`foreign_keys = ON`**, and
  **auto-runs migrations** from `./drizzle` on boot so the app is always runnable
  locally.
- Audio is **not** stored as a SQLite blob. `feedback_items.payload` holds a JSON
  string; audio lives on the filesystem (§5) and the DB stores only metadata
  pointers (`audio_recording_id`, `transcript_id`).

---

## 4. AI-access rule: component → service → provider (never component → Gemini)

**UI code never calls Gemini (or any AI SDK).** AI access flows through the
service and an AI *role*, which in turn depends only on the `AIProvider`
interface.

```
Server Action (src/app/.../actions.ts)
        │
        ▼
Application service (vietnamese-coach-service.ts)
        │
        ▼
AI role (src/infrastructure/ai/roles/vietnamese-coach.ts)  → runVietnameseCoach()
        │
        ▼
AIProvider interface (src/infrastructure/ai/types.ts)
        │
        ├── GeminiAIProvider  (gemini-provider.ts - only file importing @google/genai)
        └── MockAIProvider    (mock-provider.ts - deterministic offline fallback)
```

### Provider abstraction

`src/infrastructure/ai/types.ts` defines the one interface every layer above
depends on:

```ts
export interface AIProvider {
  readonly name: string;
  generateText(params: GenerateTextParams, meta: AICallMeta): Promise<string>;
  generateStructured<T>(params: GenerateStructuredParams<T>, meta: AICallMeta): Promise<T>;
}
```

The factory `getAIProvider()` in `src/infrastructure/ai/provider.ts` is the
single access point. It selects the implementation via `resolveAiProvider()`
(`src/lib/env.ts`): Gemini when `AI_PROVIDER=gemini` or a `GEMINI_API_KEY` is
present, otherwise the mock. The choice is cached and made in exactly one place,
so no other module knows which provider is active.

### Structured output is Zod-validated

Untrusted model output is never used directly. `generateStructured` delegates to
`runStructured()` in `src/infrastructure/ai/structured.ts`, which enforces the
failure policy:

| Attempt | Behavior |
| --- | --- |
| 1 | Normal generation |
| 2 | Retry with the same prompt |
| 3 | **Schema-repair** prompt: feed the validation error and previous response back and ask for corrected JSON |
| still invalid | Throw `AIStructuredError` (from `src/infrastructure/ai/errors.ts`) so the caller can preserve the user's work |

`extractJson()` defensively strips code fences / surrounding prose before parsing.
The **Zod schema is the single source of truth** for the shape - for the
Vietnamese coach that is `vietnameseCoachFeedbackSchema` in
`src/domain/practice/vietnamese-feedback.ts`.

Two error types are distinguished in `errors.ts`:

- `AIProviderError` - the provider was unreachable (network/quota).
- `AIStructuredError` - the provider replied but never produced schema-valid
  output.

The service catches both and returns a soft-failure result
(`{ ok: false, error: "ai_failed" }`) while keeping the persisted attempt;
unknown errors are re-thrown.

### Prompt architecture

Prompts are composed from discrete sections, not one giant string
(`src/infrastructure/ai/prompt/`):

```
GLOBAL_AI_RULES + Role Rules + User Context + Relevant Memory + Task + Output Contract
```

- `global-rules.ts` - `GLOBAL_AI_RULES`, shared by every role (composed once,
  never duplicated per role).
- `builder.ts` - `buildSystemPrompt(roleRules)` and `buildUserPrompt(sections)`.
- `roles/vietnamese-coach.ts` - the role module. It carries a **prompt version**
  (`VIETNAMESE_COACH_PROMPT_VERSION = "vietnamese-coach@1.0"`), its role rules,
  the per-attempt task builder, and the output contract. Only *relevant*
  context/memory is passed in - never the whole DB.

### The staged-coaching business rule (critical)

This is the product's core acceptance guarantee, enforced in code regardless of
what the model returns:

| Attempt | Stage | Rewrite allowed? | Direction hints? |
| --- | --- | --- | --- |
| 1 | `diagnose` | No | No - diagnosis + reflection questions |
| 2 | `guide` | No | Yes - direction / structure hints |
| 3+ | `improve` | **Yes** - improved version may be revealed | Yes |

`coachingPolicyForAttempt(attemptNumber)` computes the policy;
`enforceCoachingPolicy(feedback, policy)` **strips `improvedVersion` whenever the
policy forbids it** - even if the AI (or the mock) returned one. The prompt asks
the model to obey the stage, but the guarantee does not depend on the model
complying: it is enforced deterministically in the pure domain module and applied
by the service.

### Observability

Every AI call is logged via `logAiCall()` in `src/lib/logger.ts` with
operational metadata only - `role`, `promptVersion`, `provider`, `sessionId`,
`latencyMs`, `ok`, and `schemaError`. Raw personal content and audio are never
logged.

---

## 5. Server-only boundaries

Server-only concerns are fenced off with the `server-only` package so they can
never be bundled into client code. Files that begin with `import "server-only"`:

- `src/lib/env.ts` - validates `process.env` with Zod. **`GEMINI_API_KEY` is
  read here and must never reach the browser.** If the key is absent, the app
  falls back to the mock provider, so it stays runnable end-to-end.
- `src/infrastructure/ai/provider.ts` - the provider factory.
- `src/infrastructure/db/client.ts` - the SQLite connection.
- `src/infrastructure/db/repositories/practice-repository.ts` - all queries.
- `src/infrastructure/audio/local-audio-storage.ts` - filesystem audio storage.
- `src/application/practice/vietnamese-coach-service.ts` - the workflow service.

Complementary boundaries:

- **Server Actions** - `src/app/practice/vietnamese/actions.ts` starts with
  `"use server"`. Actions validate their inputs with Zod, call the service, and
  `revalidatePath(...)` afterwards.
- **Client Components** - interactive UI such as
  `src/features/practice/vietnamese/vietnamese-practice.tsx` starts with
  `"use client"`. Client components import server actions and *types* only; they
  never import the DB client, provider factory, or repository behavior.
- **Server Components** - pages such as
  `src/app/practice/vietnamese/page.tsx` run on the server, call the service to
  load state (`getSessionState`), and pass plain data to client components.

### Audio storage

Recordings are stored as local files by `LocalAudioStorage`
(`src/infrastructure/audio/local-audio-storage.ts`), rooted at
`AUDIO_STORAGE_DIR`, behind the `AudioStorage` interface
(`src/infrastructure/audio/types.ts`). SQLite holds only metadata (`StoredAudio`:
`id`, `relativePath`, `mimeType`, `bytes`) that points at these files. The audio
and speech interfaces exist today; the voice loop that uses them is
**Planned (Phase 2)** (see the English page, which renders a placeholder).

---

## 6. Folder structure

```
src/
├── app/                        # Next.js App Router: pages, layouts, server actions
│   ├── layout.tsx
│   ├── page.tsx
│   └── practice/
│       ├── page.tsx
│       ├── vietnamese/
│       │   ├── page.tsx        # Server Component - loads session state
│       │   └── actions.ts      # "use server" - validated server actions
│       └── english/page.tsx    # Placeholder - Planned (Phase 2)
│
├── application/                # Use cases / workflow orchestration
│   └── practice/
│       ├── vietnamese-coach-service.ts
│       └── vietnamese-coach-service.test.ts   # e2e loop vs mock + temp SQLite
│
├── domain/                     # Pure business core (no I/O)
│   ├── feedback/taxonomy.ts
│   └── practice/
│       ├── types.ts
│       ├── coaching-stage.ts   # CRITICAL staged-coaching rule
│       ├── coaching-stage.test.ts
│       └── vietnamese-feedback.ts   # Zod output contract
│
├── infrastructure/             # Adapters to the outside world
│   ├── ai/
│   │   ├── types.ts            # AIProvider interface
│   │   ├── provider.ts         # getAIProvider() factory (server-only)
│   │   ├── gemini-provider.ts  # only file importing @google/genai
│   │   ├── mock-provider.ts    # deterministic offline fallback
│   │   ├── structured.ts       # runStructured() + retry/repair
│   │   ├── errors.ts
│   │   ├── prompt/             # global-rules.ts, builder.ts
│   │   └── roles/vietnamese-coach.ts
│   ├── db/
│   │   ├── client.ts           # SQLite connection (server-only)
│   │   ├── schema.ts           # Drizzle tables
│   │   └── repositories/practice-repository.ts
│   ├── audio/                  # AudioStorage interface + LocalAudioStorage
│   └── speech/                 # SpeechProvider interface - Planned (Phase 2)
│
├── features/                   # Feature-scoped client UI (composed views)
│   └── practice/vietnamese/    # vietnamese-practice, start-practice, feedback-view
│
├── components/                 # Shared, reusable UI
│   ├── ui/                     # button, card, badge, textarea, spinner
│   └── layout/                 # sidebar, nav
│
└── lib/                        # Cross-cutting helpers
    ├── env.ts                  # Zod-validated env (server-only)
    ├── logger.ts               # structured logger + logAiCall
    ├── ids.ts                  # prefixed ID generators
    └── utils.ts
```

Migrations live in `./drizzle` (generated by `drizzle-kit`, applied at boot).
The local database and audio default to `./.data/` (`DATABASE_PATH`,
`AUDIO_STORAGE_DIR`).

---

## 7. Environment configuration

All environment access is centralized and validated in `src/lib/env.ts`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | *(optional)* | Server-only. Absent → mock provider |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model used by `GeminiAIProvider` |
| `AI_PROVIDER` | `auto` | `gemini` / `mock` / `auto` (auto = key-based) |
| `DATABASE_PATH` | `./.data/app.db` | SQLite file location |
| `AUDIO_STORAGE_DIR` | `./.data/audio` | Local audio storage root |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

Invalid configuration fails fast at startup with a readable message.

---

## 8. Code-quality conventions

- **TypeScript strict mode** (`tsconfig.json` `"strict": true`), path alias
  `@/*` → `src/*`. Type-check with `pnpm typecheck` (`tsc --noEmit`).
- **Zod is the single source of truth** for both external inputs (server-action
  payloads) and AI output shapes; domain types are inferred from schemas
  (`z.infer`) rather than duplicated.
- **Vendors behind interfaces.** Exactly one file imports each external SDK; the
  rest of the codebase depends on interfaces (`AIProvider`, `AudioStorage`,
  `SpeechProvider`).
- **Server-only fencing.** Secrets, DB access, and workflow code carry
  `import "server-only"`; client components carry `"use client"` and import only
  actions and types.
- **Prefixed IDs and ISO timestamps** everywhere (`src/lib/ids.ts`), for
  self-describing logs and readable rows.
- **Structured logging without PII.** Only operational metadata is logged; no raw
  answers or audio.
- **Persist user work before risky operations.** The service writes the attempt
  before calling the AI, so a failure never loses input.
- **Testing (Vitest).** Pure rules are unit-tested (`coaching-stage.test.ts`);
  the workflow is exercised end-to-end against the mock provider and a temporary
  SQLite database (`vietnamese-coach-service.test.ts`). Run with `pnpm test`.
- **Linting** via `eslint` with `eslint-config-next` (core-web-vitals +
  typescript) - `pnpm lint`.
- **Prompt versioning.** Each AI role exports a version string (e.g.
  `vietnamese-coach@1.0`) that is persisted with every `feedback_items` row and
  logged with every call, so feedback is traceable to the prompt that produced
  it.

---

## 9. Roadmap markers

- **English voice loop** - `src/app/practice/english/page.tsx` is a placeholder.
  The `AudioStorage` and `SpeechProvider` interfaces exist; recording,
  transcription, and spoken-English analysis are **Planned (Phase 2)**.
- **Memory / progress / flashcards** - the taxonomy defines `SKILL_DIMENSIONS`
  and the `ids` helper reserves prefixes (`mem_`, `card_`, `ev_`), but the
  corresponding tables and services are **Planned (later phases)**; the schema
  comment notes these tables are added per phase.
