# Development Phases

This project is built **phase by phase**. Each phase leaves the repository
runnable and green (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`)
and never replaces a core business rule with simplified behavior (see
`CLAUDE.md` / `AGENTS.md`).

Phase 0 (Foundation), Phase 1 (Vietnamese Coach), Phase 2 (English voice), and
Phase 3 (Individual Interview) are **complete and verified**. The remaining
phases are **planned**; their scope below reflects the infrastructure interfaces,
schema columns, feedback codes, and skill dimensions that already exist in the
codebase as seams for the work, but the product logic is **not yet built**.

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Foundation | ✅ Complete |
| 1 | Vietnamese Coach (staged coaching loop) | ✅ Complete |
| 2 | English speaking (voice + transcript) | ✅ Complete |
| 3 | Interview - Individual practice | ✅ Complete |
| 3b | Interview - Full simulation | Planned |
| 4 | Memory & adaptation | Planned |
| 5 | Question bank | Planned |
| 6 | Progress tracking | Planned |
| 7 | Flashcards & spaced review | Planned |
| 8 | CV / JD ingestion & tailoring | Planned |
| 9 | Polish, evaluation & hardening | Planned |

---

## Per-phase development process

Every phase follows the same loop:

1. **Read the spec.** Confirm scope against `docs/product-spec.md`,
   `docs/solution-design.md`, `docs/ux-spec.md`, and the architecture docs.
2. **Model the domain first.** Add pure types, Zod schemas, and rules under
   `src/domain` - no I/O, no vendor code. New AI output gets a Zod contract
   before any provider call is written.
3. **Extend infrastructure behind existing interfaces.** Implement against
   `AIProvider`, `AudioStorage`, `SpeechProvider`, and the Drizzle schema.
   Vendors stay swappable; the mock provider must keep the loop runnable
   offline.
4. **Grow the schema additively.** Add tables/columns via
   `pnpm db:generate`; migrations are auto-applied on boot from `./drizzle`.
   Do not rewrite prior migrations.
5. **Own the workflow in the application layer.** Attempt numbering, stage,
   what may be revealed, and completion are decided in `src/application` /
   `src/domain` - never by the AI.
6. **Wire the UI last.** Server actions in `src/app/**/actions.ts` call
   services; components never touch SQLite or Gemini directly.
7. **Verify before moving on.** Run `pnpm typecheck && pnpm lint && pnpm test`
   and `pnpm build`. Add at least one test that pins the phase's critical rule.
   Every AI role bumps/tags a `promptVersion` and logs via `logAiCall`.

A phase is "done" only when the repo builds, all checks pass, and the phase's
acceptance criteria are demonstrably met (ideally by an automated test).

---

## Phase 0 - Foundation ✅ Complete

**Goal.** Stand up a runnable, layered, local-first skeleton with the
non-negotiable seams in place so every later phase plugs in without touching
product logic.

**What was built.**

- **Layered architecture** with enforced dependency direction:
  `src/app` → `src/application` → `src/domain` → `src/infrastructure`.
- **Env validation** (`src/lib/env.ts`, `server-only`): Zod-validated
  `GEMINI_API_KEY` (optional), `GEMINI_MODEL`, `AI_PROVIDER`, `DATABASE_PATH`
  (`./.data/app.db`), `AUDIO_STORAGE_DIR` (`./.data/audio`), `LOG_LEVEL`.
  `resolveAiProvider()` selects `gemini` vs `mock`.
- **AI provider abstraction** (`src/infrastructure/ai/types.ts`): `AIProvider`
  with `generateText` + `generateStructured`. `GeminiAIProvider`,
  `MockAIProvider`, and the `getAIProvider()` factory (`provider.ts`).
- **Structured-output core** (`src/infrastructure/ai/structured.ts`):
  `runStructured()` does generate → retry → schema-repair, then throws
  `AIStructuredError` (`errors.ts`). All AI output is Zod-validated.
- **Prompt architecture** (`src/infrastructure/ai/prompt/*`): global rules +
  role rules + user context + memory + task + output contract.
- **Database** (`src/infrastructure/db/schema.ts`, `client.ts`): SQLite via
  `better-sqlite3` + Drizzle; migrations auto-run from `./drizzle` on boot;
  WAL + `foreign_keys` enabled. Tables: `profiles`, `practice_sessions`,
  `practice_attempts`, `feedback_items`.
- **Swappable infra seams** for later phases: `AudioStorage`
  (`LocalAudioStorage` - files, not blobs) and `SpeechProvider` interfaces.
- **Feedback taxonomy & skill dimensions** (`src/domain/feedback/taxonomy.ts`)
  covering thinking/communication/english/pronunciation/interview codes and 13
  skill dimensions, so aggregation is stable across phases.
- **Observability** (`src/lib/logger.ts`): `logAiCall` records role,
  `promptVersion`, provider, latency, ok, and schema error.
- **UI shell**: App Router layout, sidebar/nav, base UI components, and the
  `/` and `/practice` routes.

**Acceptance criteria - met.**

| Criterion | How verified |
| --- | --- |
| Repo builds and serves | `pnpm build` passes; routes `/` and `/practice/vietnamese` return 200 |
| Typecheck & lint clean | `pnpm typecheck`, `pnpm lint` pass |
| Runs offline with no API key | `resolveAiProvider()` falls back to `MockAIProvider` when `GEMINI_API_KEY` is absent |
| DB self-initializes | `client.ts` auto-applies `drizzle/0000_lowly_kronos.sql` on boot; WAL + FKs on |
| Layering respected | Components reach data only through services → repository/provider |

---

## Phase 1 - Vietnamese Coach (staged coaching loop) ✅ Complete

**Goal.** Deliver the core training loop in Vietnamese: the user submits a
messy thought, the AI diagnoses **thinking vs communication** problems, and the
user retries under **staged coaching** where a full rewrite is withheld until
the user has done their own thinking.

**What was built.**

- **Critical business rule - staged coaching**
  (`src/domain/practice/coaching-stage.ts`). `coachingPolicyForAttempt()`:
  - Attempt 1 → `diagnose` (no rewrite, no direction hints).
  - Attempt 2 → `guide` (direction/structure hints, no rewrite).
  - Attempt 3+ → `improve` (rewrite allowed).

  `enforceCoachingPolicy()` strips `improvedVersion` whenever the stage
  disallows it - a guardrail that holds **regardless of what the model
  returns**.
- **Application service owns the workflow (Rule 3)**
  (`src/application/practice/vietnamese-coach-service.ts`): decides the attempt
  number (`countAttempts + 1`), derives the stage, and controls completion
  (`completeVietnameseSession` / `abandonVietnameseSession`). The user's answer
  is persisted **before** the AI call, so work is never lost on AI failure;
  on `AIStructuredError` / `AIProviderError` the service returns
  `{ ok: false, error: "ai_failed" }` with the work still saved.
- **Validated feedback contract**
  (`src/domain/practice/vietnamese-feedback.ts`):
  `vietnameseCoachFeedbackSchema` separates `thinking` vs `communication`
  issues and carries `summary`, `strengths`, `issues`, `reflectionQuestions`,
  `suggestions`, `improvedVersion`, `nextAction`.
- **Coach role** (`src/infrastructure/ai/roles/vietnamese-coach.ts`),
  `promptVersion = "vietnamese-coach@1.0"`: Vietnamese-only role rules, stage
  instructions, and an explicit output contract; runs through the shared prompt
  builder and `generateStructured`.
- **Persistence**: attempts and validated feedback stored via
  `practice-repository.ts` into `practice_attempts` / `feedback_items`
  (feedback rows carry `role`, `promptVersion`, and `stage`).
- **UI**: `/practice/vietnamese` page, server actions
  (`src/app/practice/vietnamese/actions.ts`), and the practice/feedback
  components under `src/features/practice/vietnamese/`.
- **Session recovery seam**: `getActiveVietnameseSession()` surfaces an
  unfinished session on next launch.

**Acceptance criteria - met.**

| Criterion | How verified |
| --- | --- |
| Attempt 1 never reveals a full rewrite | `coaching-stage.test.ts` asserts `diagnose`, `canRevealImprovedVersion=false`; enforcement strips `improvedVersion` |
| Attempt 2 gives direction but no rewrite | `coaching-stage.test.ts` asserts `guide`, `canGiveDirection=true`, rewrite stripped |
| Attempt 3+ may reveal an improved version | `coaching-stage.test.ts` asserts `improve` for attempts 3/4/10; enforcement keeps `improvedVersion` |
| Rule holds end-to-end, not just in theory | `vietnamese-coach-service.test.ts` runs the loop against the mock provider + a temp SQLite DB: `improvedVersion` is null on attempts 1-2 and truthy on attempt 3 |
| User controls completion | e2e test: `completeVietnameseSession` sets status `completed` |
| Thinking vs communication kept separate | `vietnameseCoachFeedbackSchema` enum + role rules enforce the split |
| No user work lost on AI failure | Service persists the attempt before the AI call; returns `ai_failed` on known errors |
| Runs without an API key | e2e test forces `AI_PROVIDER=mock`; all checks green |

**Verification snapshot:** `pnpm test` → 2 files, 7 tests passing;
`pnpm build` passes; `/` and `/practice/vietnamese` return 200.

---

## Phase 2 - English speaking (voice + transcript) ✅ Complete

**Goal.** Add the spoken-English loop: record audio, transcribe, then coach on
grammar, vocabulary, naturalness, fluency, and fillers - treating **spoken**
English differently from written, and not auto-flagging natural fillers.

**What was built.**
- Recording via the MediaRecorder API with permission handling, pause/resume,
  replay, and delete/re-record (`src/features/practice/english/use-media-recorder.ts`,
  `audio-recorder.tsx`).
- Transcript modes (§21): live via the browser Web Speech API
  (`use-speech-recognition.ts`) or after finishing; preference persisted on
  `profiles.transcriptMode` and toggled in the UI.
- Transcription via `SpeechProvider` - `GeminiSpeechProvider` (Gemini audio) with
  a `MockSpeechProvider` fallback; browser transcript is preferred when present.
- Analysis runs content/English (`english-coach@1.0`) and pronunciation
  (`pronunciation-coach@1.0`) **in parallel** (§95); pronunciation is best-effort
  and degrades to `assessed:false` rather than inventing data (§26).
- Audio stored as local files (`LocalAudioStorage`), served via
  `/api/audio/[id]`; upload+analyze via `/api/practice/english/attempt`.
- Retry with attempt history and previous-vs-current comparison (§25); the
  improved version is gated to attempt 2+ and enforced server-side (§28).
- AI provider gained multimodal `attachments` so audio can be sent to Gemini.

**Acceptance - met and verified** (e2e test `english-practice-service.test.ts`,
HTTP smoke test of record→transcribe→analyze→replay):
- Record → store audio as a local file (never a DB blob) → transcribe. ✅
- Transcript shown per the user's `transcriptMode` (live/after). ✅
- English coaching weighs clarity and grammar equally, distinguishes spoken vs
  written, and preserves the user's voice. ✅
- Natural fillers rated on the naturalness scale, not auto-flagged. ✅
- English + pronunciation roles have tagged `promptVersion`; output Zod-validated;
  user work preserved on failure. ✅

**Known limitations.** Pronunciation is a coarse intelligibility read (no
phoneme-level scoring). Live transcript depends on browser Web Speech API
support (Chrome/Edge/Safari); elsewhere the server transcript is used after stop.

## Phase 3 - Interview: Individual practice ✅ Complete

**Goal.** Master one interview question at a time with an interviewer that
probes senior-level depth (why, trade-offs, alternatives, impact, metrics) and
asks a follow-up built from the candidate's actual answer.

**What was built.**
- Interview domain (`src/domain/interview/`): session/turn types, combinable
  categories (React-first + behavioral/leadership), `interview-feedback.ts` Zod
  schema (maps to `INTERVIEW_CODES`), and a seed opening-question bank.
- DB tables `interview_sessions` / `interview_turns` (each turn = question +
  answer + feedback JSON), with `pendingQuestion`/`pendingKind` on the session
  for resume (§78). `interview-repository.ts`.
- `interviewer@1.0` role with two calls: generate an opening question, and
  evaluate an answer + produce an adaptive follow-up. Mock fixtures included.
- Voice answers reuse the Phase 2 recorder + `SpeechProvider` transcription and
  local audio storage; `POST /api/interview/individual/answer`.
- `individual-interview-service.ts` owns the flow: it holds the pending
  question, chooses retry vs follow-up, evaluates, and advances state - the AI
  never controls progression (Rule 3). No grammar correction during interview
  (§32); feedback is substance-only.
- UI: category setup, sticky current question, voice answer, feedback view,
  adaptive follow-up (with a "why I'm asking" rationale), retry, and finish.

**Acceptance - met and verified** (e2e test `individual-interview-service.test.ts`
+ HTTP smoke test):
- Interviewer asks role-relevant questions and **follow-ups generated from the
  user's actual answer**. ✅
- Feedback maps to `INTERVIEW_CODES` with evidence quotes and top focus areas. ✅
- The application layer (not the AI) controls question progression/completion. ✅
- Same question can be retried, with a before/after comparison. ✅

**Not in this phase.** Full timed simulation (interviewer stays in role until the
end, review afterward) is Phase 3b. Depth-dimension scoring over time lands with
Progress (Phase 6).

## Phase 3b - Interview: Full simulation · Planned

**Goal.** A timed end-to-end mock interview where the AI stays strictly in the
interviewer role (no coaching mid-answer, §32) and delivers a full review only
at the end. Reuses the interview schema, adding a state machine and duration.

## Phase 4 - Memory & adaptation · Planned

**Goal.** Remember meaningful patterns across sessions so future practice
adapts (the "remember → adapt" tail of the core loop).

**Seams already present.** The prompt builder already accepts
`relevantMemory`; the coach role forwards it; feedback codes/skill dimensions
give stable keys to aggregate.

**Acceptance criteria (targets).**
- Recurring issues are distilled and stored (new memory table via migration).
- Relevant memory is injected into prompts (only the minimum needed).
- Adaptation is observable across sessions; no PII leaves the machine.

## Phase 5 - Question bank · Planned

**Goal.** A reusable bank of prompts/questions across exercise and interview
types, selectable and progress-aware.

**Seams already present.** `practice_sessions.questionId`,
`VIETNAMESE_EXERCISE_TYPES`, `EXERCISE_LABELS`.

**Acceptance criteria (targets).**
- Questions stored and referenced by `questionId`.
- Selection respects mode, exercise type, and (later) difficulty/history.

## Phase 6 - Progress tracking · Planned

**Goal.** Track and visualize improvement over time across the 13
`SKILL_DIMENSIONS`.

**Seams already present.** `SKILL_DIMENSIONS`, normalized feedback codes,
`feedback_items` history.

**Acceptance criteria (targets).**
- Per-dimension trends derived from stored feedback.
- Progress view surfaces strengths, recurring weaknesses, and trajectory.

## Phase 7 - Flashcards & spaced review · Planned

**Goal.** Turn recurring mistakes and useful phrasings into spaced-repetition
review items.

**Acceptance criteria (targets).**
- Flashcard + review-schedule tables (via migration).
- Cards generated from feedback/memory; a due-review flow.

## Phase 8 - CV / JD ingestion & tailoring · Planned

**Goal.** Ingest the user's CV and target job descriptions to tailor interview
questions and feedback to the target role/market.

**Seams already present.** `profiles` fields: `currentRole`,
`yearsExperience`, `targetRole`, `targetMarkets`, `primarySkills`,
`secondarySkills`, `englishGoal`.

**Acceptance criteria (targets).**
- CV/JD parsed into structured, Zod-validated profile/target data.
- Interview questions and feedback reflect the parsed target role/market.
- Uploaded documents stay local.

## Phase 9 - Polish, evaluation & hardening · Planned

**Goal.** Systematic AI-quality evaluation, UX polish, error hardening, and
performance work.

**Seams already present.** `logAiCall` observability, tagged `promptVersion`s,
`docs/ai-evaluation.md` (planned harness).

**Acceptance criteria (targets).**
- AI-quality evaluation harness with regression checks per `promptVersion`.
- Robust error/empty/failure states across the UI.
- Accessibility and performance passes; docs kept in sync with code.
