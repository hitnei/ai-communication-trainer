# Solution Design

How the product requirements of the **AI Communication & Interview Trainer** map to the technical implementation. This document reflects the code as it exists today; anything not yet built is marked **Planned (Phase N)**.

Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4, SQLite via Drizzle ORM, Zod, Gemini through `@google/genai` with a deterministic mock fallback.

---

## 1. Architecture at a glance

The codebase is a strict four-layer architecture. Dependencies point **inward**: UI depends on application, application depends on domain, and infrastructure implements the interfaces the inner layers declare. The domain layer has no framework or vendor imports.

| Layer | Directory | Responsibility | Example files |
|-------|-----------|----------------|---------------|
| UI + server actions | `src/app`, `src/features`, `src/components` | Render, collect input, call server actions | `src/app/practice/vietnamese/page.tsx`, `.../actions.ts`, `src/features/practice/vietnamese/vietnamese-practice.tsx` |
| Application (workflow owner) | `src/application` | Owns the coaching loop: attempt numbering, stage selection, completion, persistence order | `src/application/practice/vietnamese-coach-service.ts` |
| Domain (pure rules) | `src/domain` | Types, Zod schemas, taxonomy, and the staged-coaching policy — no I/O | `src/domain/practice/coaching-stage.ts`, `.../vietnamese-feedback.ts`, `src/domain/feedback/taxonomy.ts` |
| Infrastructure (adapters) | `src/infrastructure`, `src/lib` | AI providers, DB, audio storage, speech, env, logging | `src/infrastructure/ai/*`, `src/infrastructure/db/*`, `src/infrastructure/audio/*` |

The key architectural inversion: the **application layer owns the workflow, the AI only supplies intelligence** (referred to in code as "Rule 3"). The AI never decides which attempt this is, which stage applies, or whether the session is done.

---

## 2. Requirement-to-implementation map

| Product requirement | Where it lives in code |
|---------------------|------------------------|
| Vietnamese communication coach that separates *thinking* from *communication* problems | `ROLE_RULES` in `src/infrastructure/ai/roles/vietnamese-coach.ts`; `category: "thinking" | "communication"` in `src/domain/practice/vietnamese-feedback.ts` |
| Staged coaching (diagnose → guide → improve; no full rewrite before attempt 3) | `src/domain/practice/coaching-stage.ts` + enforcement in `src/application/practice/vietnamese-coach-service.ts` |
| User controls completion ("I'm satisfied" / "Keep improving") | `completeVietnameseSession()` in the service; buttons in `vietnamese-practice.tsx` |
| User work is never lost, even on AI failure | Attempt persisted *before* the AI call in `submitVietnameseAttempt()` |
| Structured, validated AI output only | Zod schemas in `src/domain/practice/vietnamese-feedback.ts`, validated via `runStructured()` in `src/infrastructure/ai/structured.ts` |
| Normalized feedback taxonomy for future aggregation | `src/domain/feedback/taxonomy.ts` |
| Local-first storage, no cloud dependency to run | SQLite (`src/infrastructure/db/client.ts`), local audio files (`src/infrastructure/audio/local-audio-storage.ts`) |
| API keys server-only; runnable offline | `src/lib/env.ts` (`server-only`), mock fallback in `src/infrastructure/ai/mock-provider.ts` |
| Swappable AI vendor | `AIProvider` interface in `src/infrastructure/ai/types.ts`, factory `getAIProvider()` in `provider.ts` |
| Observability of AI calls | `logAiCall` in `src/lib/logger.ts` |

---

## 3. End-to-end request flow: one Vietnamese practice attempt

The following is the exact path a user's answer takes when they press **Submit** / **Try again**. Section references (§) are the acceptance-criteria markers used throughout the source comments.

```
UI (client component)
  src/features/practice/vietnamese/vietnamese-practice.tsx
        │  submitAttemptAction({ sessionId, answer })
        ▼
Server action ("use server")
  src/app/practice/vietnamese/actions.ts
        │  Zod-parses input (submitSchema), then delegates
        ▼
Application service (owns the workflow — Rule 3)
  src/application/practice/vietnamese-coach-service.ts  →  submitVietnameseAttempt()
        │  1. load session
        │  2. attemptNumber = countAttempts + 1        ← app decides, not AI
        │  3. policy = coachingPolicyForAttempt(n)     ← domain rule
        │  4. createAttempt(...)  PERSIST FIRST         ← work survives AI failure
        ▼
AI role
  src/infrastructure/ai/roles/vietnamese-coach.ts  →  runVietnameseCoach()
        │  builds system prompt (global + role rules)
        │  builds user prompt (context + memory + task + output contract)
        ▼
AIProvider (interface)
  src/infrastructure/ai/types.ts  →  generateStructured()
   ├─ GeminiAIProvider (gemini-provider.ts)   real vendor
   └─ MockAIProvider (mock-provider.ts)       offline fallback
        │  both delegate to ↓
        ▼
Structured-output loop + Zod validation
  src/infrastructure/ai/structured.ts  →  runStructured()
        │  extract JSON → JSON.parse → schema.safeParse
        │  retry → schema-repair → throw AIStructuredError
        ▼
Guardrail (domain)
  enforceCoachingPolicy(raw, policy)   strips improvedVersion if not allowed
        ▼
Repository (data access)
  src/infrastructure/db/repositories/practice-repository.ts  →  saveFeedback()
        ▼
SQLite (Drizzle)
  feedback_items row (payload = JSON of validated feedback)
        │
        ▼  SubmitAttemptResult returned to the action → revalidatePath → UI updates
```

Step-by-step:

1. **UI** — `VietnamesePractice` (a `"use client"` component) captures the textarea value and calls the server action inside a `useTransition`. Work-in-progress is held in local component state so nothing is lost on a round trip.
2. **Server action** — `submitAttemptAction` in `actions.ts` validates the payload with `submitSchema` (`z.object({ sessionId, answer })`) before doing anything else, then calls the application service and finally `revalidatePath("/practice/vietnamese")`.
3. **Application service** — `submitVietnameseAttempt`:
   - loads the session via `practiceRepository.getSession`;
   - computes `attemptNumber = practiceRepository.countAttempts(sessionId) + 1` — **the application, not the AI, owns numbering**;
   - derives the `CoachingPolicy` from `coachingPolicyForAttempt(attemptNumber)`;
   - **persists the attempt first** via `createAttempt(...)` so the user's text is durable before any network call;
   - looks up the previous attempt's text (for attempt ≥ 2) to give the coach comparison context.
4. **AI role** — `runVietnameseCoach` assembles the prompt from discrete sections and calls `provider.generateStructured` with the `vietnameseCoachFeedbackSchema`, `schemaName: "VietnameseCoachFeedback"`, `temperature: 0.5`, and call metadata (`role`, `promptVersion`, `sessionId`).
5. **Provider + validation** — the selected provider routes through `runStructured()`, which enforces the JSON contract (see §5). The mock provider produces canned, human-sounding Vietnamese output through the *same* validation loop as the real provider.
6. **Guardrail** — back in the service, `enforceCoachingPolicy(raw, policy)` strips `improvedVersion` if the policy forbids it, regardless of what the model returned.
7. **Persistence** — `saveFeedback(...)` writes a `feedback_items` row (the validated object serialized to JSON in `payload`) and back-links it onto the attempt via `feedbackId`.
8. **Return** — a discriminated `SubmitAttemptResult` (`ok: true | false`) flows back to the UI, which appends the new attempt + feedback to its loop history.

---

## 4. How each absolute rule is enforced in code

### Rule 3 — the application owns the workflow, the AI only supplies intelligence

`submitVietnameseAttempt` (application) computes the attempt number and stage and decides completion. The AI role (`runVietnameseCoach`) is a pure "analyze this answer" function; it has no state and no authority over the loop.

### Staged coaching — no full rewrite before attempt 3

Encoded as a pure function in `src/domain/practice/coaching-stage.ts`:

| Attempt | Stage | `canRevealImprovedVersion` | `canGiveDirection` |
|---------|-------|:--------------------------:|:------------------:|
| 1 | `diagnose` | false | false |
| 2 | `guide` | false | true |
| 3+ | `improve` | true | true |

The rule is enforced **twice**, defence-in-depth:

1. **Prompt-level** — the task text tells the model the current stage and to leave `improvedVersion` null unless in `improve`.
2. **Code-level guardrail** — `enforceCoachingPolicy()` deterministically strips the field even if the model disobeys:

```ts
export function enforceCoachingPolicy<T extends { improvedVersion?: string | null }>(
  feedback: T, policy: CoachingPolicy,
): T {
  if (!policy.canRevealImprovedVersion && feedback.improvedVersion) {
    return { ...feedback, improvedVersion: null };
  }
  return feedback;
}
```

The `MockAIProvider` deliberately *always* returns an `improvedVersion`, which makes this guardrail observable and testable: on attempts 1–2 the field is stripped before it reaches the DB or the UI.

### Thinking vs communication must never be conflated

The feedback schema forces each issue into exactly one category, drawn from disjoint code sets in `src/domain/feedback/taxonomy.ts`:

- `THINKING_CODES`: `unclear_idea`, `missing_point`, `weak_logic`, `poor_structure`
- `COMMUNICATION_CODES`: `too_long`, `repetitive`, `main_point_late`, `unclear`, `incomplete`

```ts
export const vietnameseIssueSchema = z.object({
  category: z.enum(["thinking", "communication"]),
  code: z.enum([...THINKING_CODES, ...COMMUNICATION_CODES]),
  title: z.string().min(1),
  detail: z.string().min(1),
});
```

### User controls completion

The service exposes `completeVietnameseSession` ("I'm satisfied" → status `completed`) and `abandonVietnameseSession` (status `abandoned`). Nothing auto-completes a session. The UI surfaces **I'm satisfied** and **Keep improving** buttons only after at least one attempt.

### User work is never lost (graceful AI failure)

`createAttempt` runs **before** the AI call. If the provider throws a known error (`AIStructuredError` or `AIProviderError`), the service returns `{ ok: false, attemptId, error: "ai_failed", message }` rather than throwing — the attempt row is already persisted. Unknown errors are re-thrown. The UI shows a non-destructive "your work was saved, try again" banner.

### Preserve the user's voice / don't overcorrect / sound human

Enforced at the prompt level in `GLOBAL_AI_RULES` (`src/infrastructure/ai/prompt/global-rules.ts`): keep 80–90% of the user's wording, surface only what matters most, sound like a real coach, and never invent the user's background.

---

## 5. Structured AI output and validation

Every structured AI call goes through `runStructured()` in `src/infrastructure/ai/structured.ts`, which implements a three-attempt contract:

1. **Attempt 1** — normal generation.
2. **Attempt 2** — retry with the same prompt.
3. **Attempt 3** — a **schema-repair** prompt that feeds the previous invalid output and the Zod error back to the model, asking for corrected JSON only.

Each candidate is passed through `extractJson()` (which defensively strips ```` ```json ```` fences and surrounding prose), then `JSON.parse`, then `schema.safeParse`. If all three attempts fail, it throws `AIStructuredError` (carrying `lastRaw` and `validationError`) so the caller can preserve user work. The Zod schema is the single source of truth for output shape; unvalidated output is never trusted or persisted.

Both providers delegate to the *same* loop, differing only in how they produce a raw completion:

- `GeminiAIProvider` calls `client.models.generateContent(...)` with `responseMimeType: "application/json"`.
- `MockAIProvider` returns canned Vietnamese fixtures keyed by `meta.role`, still routed through `runStructured` so the validation path is identical in tests and production.

The Vietnamese contract (`vietnameseCoachFeedbackSchema`) captures: `summary`, `strengths`, `issues[]`, `reflectionQuestions[]` (core of the diagnose stage), `suggestions[]` (from the guide stage on), `improvedVersion` (nullable; only from improve), and `nextAction`.

---

## 6. Prompt architecture

Prompts are composed from discrete sections rather than one monolithic string (`src/infrastructure/ai/prompt/builder.ts`):

```
System prompt  = GLOBAL_AI_RULES + "---" + role rules
User prompt     = [User context] + [Relevant memory] + Task + Output contract
```

- `buildSystemPrompt(roleRules)` — stable across a role's calls (global rules + role rules).
- `buildUserPrompt({ userContext?, relevantMemory?, task, outputContract })` — per-call.

The Vietnamese coach role (`src/infrastructure/ai/roles/vietnamese-coach.ts`) supplies its `ROLE_RULES`, a stage-specific `buildTask()`, and a JSON `OUTPUT_CONTRACT`. Its prompt version is pinned as `VIETNAMESE_COACH_PROMPT_VERSION = "vietnamese-coach@1.0"` and stored on every feedback row, so future prompt changes remain traceable. Only *relevant* context and memory are passed in — never the whole database. The `relevantMemory` slot is wired through the interface but not yet populated (**Planned (Phase 3)** — see roadmap).

---

## 7. Provider abstraction (future vendors)

The entire app depends on one interface, `AIProvider` (`src/infrastructure/ai/types.ts`):

```ts
export interface AIProvider {
  readonly name: string;
  generateText(params: GenerateTextParams, meta: AICallMeta): Promise<string>;
  generateStructured<T>(params: GenerateStructuredParams<T>, meta: AICallMeta): Promise<T>;
}
```

Selection is centralized in `getAIProvider()` (`provider.ts`), driven by `resolveAiProvider()` in `src/lib/env.ts`:

- `AI_PROVIDER=gemini` → Gemini (requires `GEMINI_API_KEY`)
- `AI_PROVIDER=mock` → mock
- `AI_PROVIDER=auto` (default) → Gemini if a key is present, otherwise mock

`GeminiAIProvider` is the **only** file that imports the Gemini SDK. Adding a new vendor means implementing `AIProvider` and adding one branch to the factory — no product, domain, or UI code changes. The provider is cached per server process. `AICallMeta` (`role`, `promptVersion`, `sessionId`) attaches observability and versioning metadata to every call.

The same pattern is pre-established for two other adapters, kept as interfaces so future loops plug in without touching product logic:

- `AudioStorage` — `LocalAudioStorage` (real, filesystem) in `src/infrastructure/audio/`.
- `SpeechProvider` — transcription + optional TTS interface in `src/infrastructure/speech/types.ts` (**Planned (Phase 2)**, no implementation yet).

---

## 8. Local-first and privacy design

Everything runs on the user's machine with no cloud dependency required.

- **Database** — SQLite via Drizzle (`src/infrastructure/db/client.ts`). A single connection is reused per process (`globalThis.__app_db__`). On boot it runs `journal_mode = WAL`, `foreign_keys = ON`, and **auto-applies migrations** from `./drizzle` so the app is always runnable from a clean checkout. Path is configurable via `DATABASE_PATH` (default `./.data/app.db`).
- **Audio** — stored as local files by `LocalAudioStorage` under `AUDIO_STORAGE_DIR` (default `./.data/audio`), **not** as blobs in the database. Rows reference audio by `audioRecordingId`.
- **Secrets** — `src/lib/env.ts` starts with `import "server-only"`, so it can never be bundled into the browser. `GEMINI_API_KEY` is read only on the server. Env is validated with Zod at startup and fails fast on misconfiguration.
- **Offline by design** — with no key configured, `resolveAiProvider()` returns `mock` and the full loop still works end to end.
- **Data access boundary** — the UI never touches the DB directly; all access goes through `practiceRepository`.
- **Observability without leakage** — `logAiCall` records `role`, `promptVersion`, `provider`, `latencyMs`, `ok`, and (on failure) `schemaError`, but never raw personal content or audio. `LOG_LEVEL` gates verbosity.

---

## 9. Data model

Defined in `src/infrastructure/db/schema.ts`. IDs are text primary keys generated in `src/lib/ids.ts`; timestamps are ISO-8601 strings.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `profiles` | `id`, `current_role`, `years_experience`, `target_role`, `target_markets`, `primary_skills`, `secondary_skills`, `english_goal`, `transcript_mode` | JSON-array columns stored as text; `transcript_mode` defaults `after` |
| `practice_sessions` | `id`, `mode`, `goal`, `exercise_type`, `prompt`, `question_id`, `status`, `started_at`, `completed_at` | `mode` = `vietnamese`/`english`; `status` = `active`/`completed`/`abandoned` |
| `practice_attempts` | `id`, `session_id` (FK, cascade), `attempt_number`, `text_answer`, `audio_recording_id`, `transcript_id`, `feedback_id`, `created_at` | audio/transcript columns unused until Phase 2 |
| `feedback_items` | `id`, `attempt_id` (FK, cascade), `role`, `prompt_version`, `stage`, `payload`, `created_at` | `payload` = JSON of the validated feedback; `role`/`prompt_version`/`stage` make each item traceable |

Foreign keys cascade on delete, so deleting a session or attempt cleans up its children. `deleteAttempt` (exposed via `deleteAttemptAction`) and `setSessionStatus` give the user control over their own data.

---

## 10. Testing and verification

- `src/domain/practice/coaching-stage.test.ts` — unit tests for the stage policy and the `enforceCoachingPolicy` guardrail (the critical business rule) in isolation from I/O.
- `src/application/practice/vietnamese-coach-service.test.ts` — an end-to-end loop test running the service against the `MockAIProvider` and a temporary SQLite database, confirming attempt numbering, stage progression, and that `improvedVersion` is stripped before attempt 3.

Both run under Vitest and are verified passing. `next build` passes; routes `/` and `/practice/vietnamese` return 200.

---

## 11. Phase roadmap mapping

| Phase | Scope | Status | Anchors in code |
|-------|-------|--------|-----------------|
| Phase 0/1 | Profile + Vietnamese coaching loop (text), local SQLite, provider abstraction, mock fallback, staged coaching | **Implemented** | `vietnamese-coach-service.ts`, `coaching-stage.ts`, `vietnamese-feedback.ts`, `practice-repository.ts`, `schema.ts` |
| Phase 2 | English voice loop: audio recording, transcription, pronunciation feedback/TTS | **Planned** — interfaces exist, no implementations | `SpeechProvider` (`speech/types.ts`), `AudioStorage`/`LocalAudioStorage`, unused `audio_recording_id`/`transcript_id` columns; `PRONUNCIATION_CODES`, `ENGLISH_CODES` in taxonomy; `src/app/practice/english/page.tsx` placeholder |
| Phase 3 | Cross-session memory: surface recurring weaknesses from past sessions into prompts | **Planned** — prompt slot exists, not populated | `relevantMemory` in `PromptSections` / `VietnameseCoachInput`, "Base recurring weakness on repeated evidence" in `GLOBAL_AI_RULES` |
| Later | Interview-answer scoring, progress/skill analytics, flashcards | **Planned** | `INTERVIEW_CODES` and `SKILL_DIMENSIONS` in `src/domain/feedback/taxonomy.ts`; schema comment notes memory/flashcard tables are added in their phases |

The schema and taxonomy are intentionally forward-looking (interview and pronunciation codes, skill dimensions, audio/transcript columns) so later phases extend rather than rewrite the foundation. Nothing in the current build reads or writes those columns/codes yet.
