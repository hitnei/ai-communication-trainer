# Development Phases

This project is built **phase by phase**. Each phase leaves the repository
runnable and green (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`)
and never replaces a core business rule with simplified behavior (see
`CLAUDE.md` / `AGENTS.md`).

Phases 0-7 are **complete and verified**: Foundation, Vietnamese Coach, English
voice, Individual Interview, Full Interview Simulation, Personal Memory, the
Question Bank, Progress tracking, and Flashcards. Only Phase 8 (CV / Projects /
JD) remains **planned**; its scope below reflects the infrastructure and schema
seams that exist, but the product logic is **not yet built**.

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Foundation | ✅ Complete |
| 1 | Vietnamese Coach (staged coaching loop) | ✅ Complete |
| 2 | English speaking (voice + transcript) | ✅ Complete |
| 3 | Interview - Individual practice | ✅ Complete |
| 3b | Interview - Full simulation | ✅ Complete |
| 4 | Memory & adaptation | ✅ Complete |
| 5 | Question bank | ✅ Complete |
| 6 | Progress tracking | ✅ Complete |
| 7 | Flashcards & spaced review | ✅ Complete |
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

## Phase 3b - Interview: Full simulation ✅ Complete

**Goal.** A timed end-to-end mock interview where the AI stays strictly in the
interviewer role (no coaching mid-answer, §32) and delivers a full review only
at the end.

**What was built.**
- Setup: interview type (recruiter / behavioral / technical / system design /
  mixed), combinable focus categories, and duration (10/20/30/45 min → a target
  question count).
- `simulation-service.ts` state machine: generates the opening question, then on
  each answer stores the turn (no feedback), asks the next adaptive question, and
  wraps at the target count - the app decides progression, not the AI (Rule 3).
- Interviewer AI additions (`interviewer.ts`): `generateNextSimulationQuestion`
  (asks only, never evaluates, §32) and `reviewSimulation` (`interview-reviewer@1.0`)
  for the end-of-interview review. Mock fixtures included.
- Voice answers reuse the recorder + `SpeechProvider`; `POST /api/interview/simulation/answer`.
- Timed UI with a countdown that auto-finishes at 0, live question progress,
  answered-questions transcript (no scores shown), and a final review view with a
  gentle readiness scale (§44, §49) plus recommended practice. Review stored on
  `interview_sessions.review_payload`.

**Acceptance - met and verified** (e2e test `simulation-service.test.ts` + HTTP
smoke test):
- The AI remains an interviewer until the session ends - answers return only the
  next question, never feedback/score/hint. ✅
- Adaptive questions build on prior answers; the app wraps at the target. ✅
- A detailed review is produced only after the interview finishes. ✅

## Phase 4 - Memory & adaptation ✅ Complete

**Goal.** Remember meaningful patterns across sessions so future practice
adapts (the "remember → adapt" tail of the core loop).

**What was built.**
- Memory domain (`src/domain/memory/types.ts`): the five memory types (§45), a
  `CODE_MEMORY` registry mapping feedback codes to a memory type + human
  description, and the confidence/status lifecycle (candidate → confirmed →
  improving → stable) derived from occurrence count and recency.
- DB tables `communication_memories` + `memory_evidence` (§46), with every
  memory traceable to the sessions it came from.
- `memory-service.ts`: extraction runs on session completion for all four flows
  (Vietnamese, English, individual interview, simulation review) and counts **at
  most one occurrence per session** so a single slip stays a candidate, never a
  weakness (§47). Retrieval (`getRelevantMemories` / `buildMemorySummary`)
  returns only the top few relevant patterns as a concise summary (§48).
- Adaptation: the summary is injected via the existing `relevantMemory` prompt
  slot into the Vietnamese coach, English coach, and interviewer - so recurring
  issues shape future coaching.
- UI: a Memory page to inspect each pattern, expand its evidence, delete one, or
  clear all (§9); a dashboard "Your focus right now" card; a Memory nav entry.

**Acceptance - met and verified** (e2e test `memory-service.test.ts`):
- A single occurrence stays a candidate; the same issue across 3 sessions becomes
  a confirmed recurring pattern. ✅
- Relevant memory is injected into prompts (minimum needed, not full history). ✅
- Patterns are traceable to sessions, deletable, and never leave the machine. ✅
- Repeated communication issues demonstrably affect future practice. ✅

**Note on the "MemoryExtractor AI" (§72).** Recurrence detection is deterministic
(counting distinct sessions per coded issue) rather than an LLM call - this is
more reliable for "did this recur?" and keeps the weakness decision in the app
layer (Rule 3). Descriptions come from the `CODE_MEMORY` registry.

## Phase 5 - Question bank ✅ Complete

**Goal.** A personalized bank of interview questions the user builds by
combining categories, generating in batches, reviewing, and curating.

**What was built.**
- Question domain (`src/domain/question/`): lifecycle statuses
  (suggested/selected/practicing/weak/improving/mastered), question types,
  difficulties, removal reasons, a Zod generation schema, and a deterministic
  near-duplicate detector (`dedup.ts`, token-overlap with light stemming).
- DB tables `questions` + `question_feedback` (removal reasons persist even after
  a question is deleted). `question-repository.ts`.
- `question-generator@1.0` AI role: multi-category, context-aware (target role,
  weaknesses from memory, existing questions and removed-question feedback to
  avoid). Mock returns a varied pool so "Generate More" works offline.
- `question-bank-service.ts` owns generation → **deterministic dedup against
  existing + removed questions** → review-before-save → add chosen → edit /
  status / remove-with-reason (Rule 3; the AI only proposes).
- UI: search + category/status filters, a generation panel that combines
  categories and shows candidates for review (select which to add, "generate
  more", dismiss, with a count of near-duplicates filtered), inline edit, status
  change, and remove-with-reason.

**Acceptance - met and verified** (`dedup.test.ts` + `question-bank-service.test.ts`):
- Multiple categories are selectable and combined in one batch. ✅
- Generate produces up to 10; near-duplicates are minimized (exact + reworded). ✅
- The user selects which generated questions to save; nothing auto-saves. ✅
- Removal reasons are persisted and removed questions don't come back. ✅

**Note.** Automatic status transitions from practice results (practicing → weak →
improving → mastered) arrive with Progress (Phase 6); status is user-settable now.

## Phase 6 - Progress tracking ✅ Complete

**Goal.** Track improvement over time across the 13 `SKILL_DIMENSIONS`, with
evidence rather than a single exam score, and drive recommendations.

**What was built.**
- `src/domain/progress/dimensions.ts`: maps every feedback code to a skill
  dimension, plus per-dimension practice suggestions.
- `progress-service.ts` rolls up issues actually observed across all completed
  practice + interview sessions into per-dimension trends (recent vs earlier,
  with counts as evidence), a measurable answer-length metric ("earlier avg N
  words → recent avg M"), and recurring mistakes drawn from memory with real
  before/after example quotes. No invented per-dimension scores (§49).
- `recommendation-service.ts` (§52): ranks by weakness severity, recurrence, and
  recency (from memory), is time-aware (§15), and every item explains WHY (§13).
- UI: a Progress page (Communication Profile with per-dimension trend + evidence,
  answer-length metric, recurring mistakes with examples + suggested practice)
  and a dashboard that now shows real, evidence-backed recommendations. Progress
  and Memory are enabled in the nav.

**Acceptance - met and verified** (`progress-service.test.ts`):
- Per-dimension trends are derived from stored feedback, each with count-based
  evidence. ✅
- Progress surfaces recurring weaknesses with concrete examples and a length
  metric. ✅
- Every claim is backed by evidence - "Progress contains evidence." ✅

**Note.** Trends currently use issue-frequency (recent vs earlier) as an
evidence-based proxy; explicit numeric per-dimension scoring by the AI is a
possible future refinement but was avoided to prevent fabricated precision (§49).

## Phase 7 - Flashcards & spaced review ✅ Complete

**Goal.** A Speaking Phrase Bank (§53) - useful phrases and more natural
alternatives - with spaced repetition and speaking practice.

**What was built.**
- Domain: flashcard types + a pure `SpacedRepetitionEngine` (`srs.ts`, SM-2
  variant tracking new → learning → review → mature with ease and lapses).
- DB tables `flashcards`, `flashcard_reviews`, `phrase_suggestions`.
- `flashcard-suggestor@1.0` role mines the user's recent transcripts for phrases
  (natural alternatives with `replacementFor`, interview/useful phrases, vocab
  gaps). Mock includes the spec's "I have a problem about…" → "I'm running into
  an issue with…" example (§55).
- `flashcard-service.ts`: suggestions are stored as **pending and never
  auto-added** (§54) - the user adds or dismisses each; deterministic dedupe
  against existing cards/suggestions; manual add; SRS-scheduled review.
- Speaking review (§56): `POST /api/flashcards/speak` records the phrase and runs
  the pronunciation coach (reused from Phase 2), in-memory (not stored).
- UI: suggest bar (from recent practice or pasted text), a due-review flow with
  self-rating + "Speak & check pronunciation", a suggestions inbox (add/dismiss),
  and an all-cards list with manual add and delete. Flashcards enabled in nav.

**Acceptance - met and verified** (`srs.test.ts` + `flashcard-service.test.ts`):
- The AI suggests phrases; the user controls which become flashcards (§54). ✅
- Context-aware suggestions work (mined from the user's own answers). ✅
- A speaking review exists (record → pronunciation analysis). ✅
- Spaced repetition schedules reviews (new → review → mature; lapses on 'again'). ✅

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
