# Development Phases

This project is built **phase by phase**. Each phase leaves the repository
runnable and green (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`)
and never replaces a core business rule with simplified behavior (see
`CLAUDE.md` / `AGENTS.md`).

Phase 0 (Foundation) and Phase 1 (Vietnamese Coach) are **complete and
verified**. Phases 2–9 are **planned**; their scope below reflects the
infrastructure interfaces, schema columns, feedback codes, and skill dimensions
that already exist in the codebase as seams for the work, but the product logic
for those phases is **not yet built**.

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Foundation | ✅ Complete |
| 1 | Vietnamese Coach (staged coaching loop) | ✅ Complete |
| 2 | English speaking (voice + transcript) | Planned |
| 3 | Interview mode | Planned |
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
   `src/domain` — no I/O, no vendor code. New AI output gets a Zod contract
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
   `src/domain` — never by the AI.
6. **Wire the UI last.** Server actions in `src/app/**/actions.ts` call
   services; components never touch SQLite or Gemini directly.
7. **Verify before moving on.** Run `pnpm typecheck && pnpm lint && pnpm test`
   and `pnpm build`. Add at least one test that pins the phase's critical rule.
   Every AI role bumps/tags a `promptVersion` and logs via `logAiCall`.

A phase is "done" only when the repo builds, all checks pass, and the phase's
acceptance criteria are demonstrably met (ideally by an automated test).

---

## Phase 0 — Foundation ✅ Complete

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
  (`LocalAudioStorage` — files, not blobs) and `SpeechProvider` interfaces.
- **Feedback taxonomy & skill dimensions** (`src/domain/feedback/taxonomy.ts`)
  covering thinking/communication/english/pronunciation/interview codes and 13
  skill dimensions, so aggregation is stable across phases.
- **Observability** (`src/lib/logger.ts`): `logAiCall` records role,
  `promptVersion`, provider, latency, ok, and schema error.
- **UI shell**: App Router layout, sidebar/nav, base UI components, and the
  `/` and `/practice` routes.

**Acceptance criteria — met.**

| Criterion | How verified |
| --- | --- |
| Repo builds and serves | `pnpm build` passes; routes `/` and `/practice/vietnamese` return 200 |
| Typecheck & lint clean | `pnpm typecheck`, `pnpm lint` pass |
| Runs offline with no API key | `resolveAiProvider()` falls back to `MockAIProvider` when `GEMINI_API_KEY` is absent |
| DB self-initializes | `client.ts` auto-applies `drizzle/0000_lowly_kronos.sql` on boot; WAL + FKs on |
| Layering respected | Components reach data only through services → repository/provider |

---

## Phase 1 — Vietnamese Coach (staged coaching loop) ✅ Complete

**Goal.** Deliver the core training loop in Vietnamese: the user submits a
messy thought, the AI diagnoses **thinking vs communication** problems, and the
user retries under **staged coaching** where a full rewrite is withheld until
the user has done their own thinking.

**What was built.**

- **Critical business rule — staged coaching**
  (`src/domain/practice/coaching-stage.ts`). `coachingPolicyForAttempt()`:
  - Attempt 1 → `diagnose` (no rewrite, no direction hints).
  - Attempt 2 → `guide` (direction/structure hints, no rewrite).
  - Attempt 3+ → `improve` (rewrite allowed).

  `enforceCoachingPolicy()` strips `improvedVersion` whenever the stage
  disallows it — a guardrail that holds **regardless of what the model
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

**Acceptance criteria — met.**

| Criterion | How verified |
| --- | --- |
| Attempt 1 never reveals a full rewrite | `coaching-stage.test.ts` asserts `diagnose`, `canRevealImprovedVersion=false`; enforcement strips `improvedVersion` |
| Attempt 2 gives direction but no rewrite | `coaching-stage.test.ts` asserts `guide`, `canGiveDirection=true`, rewrite stripped |
| Attempt 3+ may reveal an improved version | `coaching-stage.test.ts` asserts `improve` for attempts 3/4/10; enforcement keeps `improvedVersion` |
| Rule holds end-to-end, not just in theory | `vietnamese-coach-service.test.ts` runs the loop against the mock provider + a temp SQLite DB: `improvedVersion` is null on attempts 1–2 and truthy on attempt 3 |
| User controls completion | e2e test: `completeVietnameseSession` sets status `completed` |
| Thinking vs communication kept separate | `vietnameseCoachFeedbackSchema` enum + role rules enforce the split |
| No user work lost on AI failure | Service persists the attempt before the AI call; returns `ai_failed` on known errors |
| Runs without an API key | e2e test forces `AI_PROVIDER=mock`; all checks green |

**Verification snapshot:** `pnpm test` → 2 files, 7 tests passing;
`pnpm build` passes; `/` and `/practice/vietnamese` return 200.

---

## Phase 2 — English speaking (voice + transcript) · Planned

**Goal.** Add the spoken-English loop: record audio, transcribe, then coach on
grammar, vocabulary, naturalness, fluency, and fillers — treating **spoken**
English differently from written, and not auto-flagging natural fillers.

**Seams already present.** `SpeechProvider` (`src/infrastructure/speech/types.ts`),
`AudioStorage` / `LocalAudioStorage`, `practice_attempts.audioRecordingId` &
`transcriptId`, `profiles.transcriptMode` (`before`/`after`/etc.), the
`english`/`pronunciation` feedback codes, and `PracticeMode = "english"`.

**Acceptance criteria (targets).**
- Record → store audio as a local file (never a DB blob) → transcribe.
- Transcript shown per the user's `transcriptMode`.
- English coaching distinguishes spoken vs written and preserves ~80–90% of
  the user's voice.
- Natural fillers are not automatically flagged.
- New English coach role has a tagged `promptVersion`; output Zod-validated.

## Phase 3 — Interview mode · Planned

**Goal.** Structured interview practice (technical + behavioral) with an
interviewer role that probes depth, tradeoffs, examples, metrics, and
unsupported claims.

**Seams already present.** `INTERVIEW_CODES`
(`too_generic`, `insufficient_depth`, `weak_tradeoff`, `weak_example`,
`unsupported_claim`, `missing_metric`), `interview_answer` exercise type,
`technical_depth` / `behavioral_depth` skill dimensions,
`practice_sessions.questionId`.

**Acceptance criteria (targets).**
- Interviewer role asks role-relevant questions and follow-ups.
- Feedback maps to `INTERVIEW_CODES`; depth dimensions scored.
- Application layer (not the AI) controls question progression/completion.

## Phase 4 — Memory & adaptation · Planned

**Goal.** Remember meaningful patterns across sessions so future practice
adapts (the "remember → adapt" tail of the core loop).

**Seams already present.** The prompt builder already accepts
`relevantMemory`; the coach role forwards it; feedback codes/skill dimensions
give stable keys to aggregate.

**Acceptance criteria (targets).**
- Recurring issues are distilled and stored (new memory table via migration).
- Relevant memory is injected into prompts (only the minimum needed).
- Adaptation is observable across sessions; no PII leaves the machine.

## Phase 5 — Question bank · Planned

**Goal.** A reusable bank of prompts/questions across exercise and interview
types, selectable and progress-aware.

**Seams already present.** `practice_sessions.questionId`,
`VIETNAMESE_EXERCISE_TYPES`, `EXERCISE_LABELS`.

**Acceptance criteria (targets).**
- Questions stored and referenced by `questionId`.
- Selection respects mode, exercise type, and (later) difficulty/history.

## Phase 6 — Progress tracking · Planned

**Goal.** Track and visualize improvement over time across the 13
`SKILL_DIMENSIONS`.

**Seams already present.** `SKILL_DIMENSIONS`, normalized feedback codes,
`feedback_items` history.

**Acceptance criteria (targets).**
- Per-dimension trends derived from stored feedback.
- Progress view surfaces strengths, recurring weaknesses, and trajectory.

## Phase 7 — Flashcards & spaced review · Planned

**Goal.** Turn recurring mistakes and useful phrasings into spaced-repetition
review items.

**Acceptance criteria (targets).**
- Flashcard + review-schedule tables (via migration).
- Cards generated from feedback/memory; a due-review flow.

## Phase 8 — CV / JD ingestion & tailoring · Planned

**Goal.** Ingest the user's CV and target job descriptions to tailor interview
questions and feedback to the target role/market.

**Seams already present.** `profiles` fields: `currentRole`,
`yearsExperience`, `targetRole`, `targetMarkets`, `primarySkills`,
`secondarySkills`, `englishGoal`.

**Acceptance criteria (targets).**
- CV/JD parsed into structured, Zod-validated profile/target data.
- Interview questions and feedback reflect the parsed target role/market.
- Uploaded documents stay local.

## Phase 9 — Polish, evaluation & hardening · Planned

**Goal.** Systematic AI-quality evaluation, UX polish, error hardening, and
performance work.

**Seams already present.** `logAiCall` observability, tagged `promptVersion`s,
`docs/ai-evaluation.md` (planned harness).

**Acceptance criteria (targets).**
- AI-quality evaluation harness with regression checks per `promptVersion`.
- Robust error/empty/failure states across the UI.
- Accessibility and performance passes; docs kept in sync with code.
