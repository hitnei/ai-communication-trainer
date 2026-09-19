# Product Spec — AI Communication & Interview Trainer

> **Source-of-truth product document.** This spec is synthesized from the master
> product prompt (the `§` references throughout point at its numbered rules, which
> also appear as anchors in the source code) and reconciled against the code that
> is actually implemented. Where a capability is not yet built, it is marked
> **Planned (Phase N)**.
>
> Status legend: ✅ Built · 🟡 Interface/scaffold only · ⬜ Planned
>
> Last verified against source: 2026-09-19.

---

## 1. Vision

This is a **personal communication and interview trainer** for one senior
engineer, not a general-purpose chatbot. It exists to make the user think more
clearly, speak more naturally, and hold up under interview pressure — in that
order. The AI supplies intelligence; the **application owns the workflow** and
the pedagogy.

The product is organized around three layers of skill, which are also the
progression a user moves through:

| Layer | Name | What it trains | Primary language | Status |
| ----- | ---- | -------------- | ---------------- | ------ |
| 1 | **Think Clearly** | Turning a messy thought into a clear, structured, concise, complete point. Thinking + communication, *not* language. | Vietnamese | ✅ Built (Phase 1) |
| 2 | **Speak Naturally** | Saying the same clear thing in natural, fluent spoken English. Grammar, vocabulary, naturalness, fluency, filler, pronunciation. | English (voice-first) | ⬜ Planned (Phase 2) |
| 3 | **Perform Under Pressure** | Answering real interview questions with depth, trade-offs, concrete examples, and metrics — individually and in full simulation. | English | ⬜ Planned (Phase 3+) |

The deliberate sequencing — **fix the thinking in the user's native language
first, then move it into English, then apply it under interview pressure** — is a
core product belief, reflected in the Dashboard copy ("Start in Vietnamese to fix
the thinking first, then move it into English later").

---

## 2. Target User

A single, specific persona. All content, defaults, and difficulty are tuned to
this person; the product does **not** try to serve beginners or a general
audience.

| Attribute | Value |
| --------- | ----- |
| Current role | Senior Frontend Engineer |
| Experience | Senior (multiple years) |
| Core stack | React, Next.js, Node.js, TypeScript |
| Target roles | Senior / Lead Frontend & full-stack-leaning frontend |
| Target markets | Australia (AU) and Europe (EU) |
| Native language | Vietnamese |
| Working language | English (spoken and written) |

The persona is modeled by the `profiles` table (see §8). `targetMarkets`,
`primarySkills`, and `secondarySkills` are stored as JSON arrays; `englishGoal`
and `transcriptMode` capture how the user wants English practice to behave.

> **Note:** The profile schema exists (✅), but a Profile UI to edit it is
> **Planned** (the `Profile` nav item is marked `available: false`).

---

## 3. The Core Training Loop

The loop is the heart of the product. It is the same shape in every module; only
the AI role and the modality change.

```
You answer
  → the coach diagnoses the REAL problem (not surface polish)
  → you retry
  → it compares your attempts
  → meaningful patterns are remembered
  → future practice adapts
```

The loop is **iterative and user-controlled**: after each attempt the user
chooses **"Keep improving"** (retry) or **"I'm satisfied"** (complete). The app
never auto-completes a session and never decides the user is "done."

### 3.1 Staged coaching — the critical business rule (§18, §69, §103)

The coach reveals help progressively across attempts. This is enforced by the
application, independent of what the AI returns.

| Attempt | Stage | May give direction / structure hints | May reveal full rewrite |
| ------- | ----- | ------------------------------------ | ----------------------- |
| 1 | `diagnose` | No | **No** |
| 2 | `guide` | Yes | **No** |
| 3+ | `improve` | Yes | **Yes** (preserving the user's voice) |

- **Attempt 1 (Diagnose):** identify the real problems, explain why they matter,
  ask reflection questions. No rewrite, no finished structure.
- **Attempt 2 (Guide):** give direction and structural hints so the user
  improves it themselves. Still no full rewrite.
- **Attempt 3+ (Improve):** an improved version *may* be shown, keeping ~80–90%
  of the user's own wording.

**Implementation:**
- Pure policy: `coachingPolicyForAttempt()` in
  `src/domain/practice/coaching-stage.ts` returns `{ stage, canRevealImprovedVersion, canGiveDirection, label }`.
- Hard guardrail: `enforceCoachingPolicy()` **strips `improvedVersion` to `null`**
  whenever the stage does not permit it — even if the model ignored its
  instructions.
- Workflow ownership (Rule 3): `submitVietnameseAttempt()` in
  `src/application/practice/vietnamese-coach-service.ts` decides the attempt
  number (`countAttempts + 1`), selects the stage, calls the AI, applies the
  guardrail, and persists. The AI never controls attempt numbering, staging, or
  completion.

### 3.2 Loop durability

- The user's answer is persisted **before** the AI is called
  (`createAttempt` runs first), so **work is never lost** on an AI failure
  (§65, §77). On failure the UI shows "Your work was saved — you can try
  submitting again."
- Unfinished sessions are recoverable: `getActiveVietnameseSession()` surfaces an
  active session on the Dashboard with a **Continue** link (§78).
- A session has status `active` → `completed` (I'm satisfied) or `abandoned`
  (discarded).

---

## 4. Absolute Rules (Non-negotiable)

These constraints hold across every module and every AI role. Several are encoded
directly in code and tests.

1. **Not a generic chatbot.** The system prompt opens: *"You are part of a
   personal communication and interview training system — not a generic
   chatbot."* (`GLOBAL_AI_RULES`, `src/infrastructure/ai/prompt/global-rules.ts`).
   There is no free-form chat surface.
2. **The app controls the workflow; the AI provides intelligence (Rule 3).**
   Attempt numbering, coaching stage, what may be revealed, and completion are
   owned by the application/domain layers. The AI only analyzes.
3. **Preserve user agency.** The user always decides when a session is good
   enough ("I'm satisfied" / "Keep improving"). Nothing auto-completes.
4. **Preserve the user's voice.** Rewrites keep ~80–90% of the original style and
   wording; aggressive rewriting only when the original is genuinely unclear.
5. **Human tone.** Sound like a real coach — direct and specific — never a
   textbook or corporate report. Corporate phrasing like *"Your response
   demonstrates insufficient structural coherence"* is explicitly forbidden.
6. **Don't invent the user.** Never fabricate the user's experience, projects,
   metrics, or background; use only what is provided.
7. **Don't overcorrect.** Surface the single most important thing first, not 15
   corrections at once. Recurring-weakness claims require repeated evidence, not
   one occurrence.
8. **Spoken vs written English are different.** Natural spoken fillers
   ("you know", "yeah", "I mean", "actually") are not automatically errors; flag
   them only when they hurt clarity or are used as a crutch. The system
   distinguishes *natural / acceptable / context-dependent / awkward / incorrect*
   and never treats casual-but-valid speech as wrong.
9. **Thinking ≠ language.** In Vietnamese coaching, thinking problems and
   communication problems are separated and never conflated (§19); Vietnamese
   coaching is explicitly *not* an English lesson.
10. **Local-first & private.** All data lives locally (SQLite + local audio
    files). `GEMINI_API_KEY` is **server-only** and must never reach the browser
    (§5, §88). Logs record operational metadata only — never raw personal content
    or audio (§92).
11. **Validated AI output only.** Every structured AI response is validated
    against a Zod schema; unvalidated output is never trusted (§64).
12. **English UI, desktop-first** (§10, §12). The interface is in English even
    though Layer-1 practice content is in Vietnamese.

---

## 5. Product Modules

Navigation is defined in `src/components/layout/nav.ts`. The `available` flag
drives the "coming soon" state for modules not yet built.

| Module | Route | Status | Notes |
| ------ | ----- | ------ | ----- |
| **Dashboard** | `/` | ✅ Built | Recommends the next-best practice, surfaces unfinished sessions, explains the loop. |
| **Practice → Vietnamese** | `/practice/vietnamese` | ✅ Built (Phase 1) | The full staged coaching loop, text-based. |
| **Practice → English** | `/practice/english` | 🟡 Scaffold | Placeholder page; audio + speech provider interfaces exist. Voice loop is **Planned (Phase 2)**. |
| **Interview → Individual** | `/interview/individual` | ⬜ Planned (Phase 3) | `available: false`. |
| **Interview → Full Simulation** | `/interview/simulation` | ⬜ Planned (Phase 3+) | `available: false`. |
| **Question Bank** | `/questions` | ⬜ Planned | `available: false`. |
| **Flashcards** | `/flashcards` | ⬜ Planned | `available: false`. |
| **Progress** | `/progress` | ⬜ Planned | `available: false`. Skill dimensions defined (§8). |
| **Profile** | `/profile` | ⬜ Planned | `available: false`. Profile schema exists. |

### 5.1 Vietnamese Practice (Layer 1 — Think Clearly) ✅

Trains thinking + communication in the user's native language.

- **Exercise types** (`VIETNAMESE_EXERCISE_TYPES`, `src/domain/practice/types.ts`):
  `explain_problem`, `tell_story`, `give_opinion`, `explain_concept`,
  `explain_experience`, `interview_answer`, `casual_conversation`,
  `rewrite_messy`.
- **AI role:** `vietnamese-coach` (`src/infrastructure/ai/roles/vietnamese-coach.ts`),
  prompt version `vietnamese-coach@1.0`. Responds entirely in natural Vietnamese.
- **Feedback contract** (`vietnameseCoachFeedbackSchema`,
  `src/domain/practice/vietnamese-feedback.ts`):

  | Field | Meaning |
  | ----- | ------- |
  | `summary` | One honest, human sentence. |
  | `strengths` | What worked. |
  | `issues[]` | Each has `category` (`thinking`\|`communication`), a taxonomy `code`, `title`, `detail`. |
  | `reflectionQuestions[]` | Core of the diagnose stage. |
  | `suggestions[]` | Direction/structure hints, from the guide stage on. |
  | `improvedVersion` | `null` unless the improve stage (also stripped by the guardrail). |
  | `nextAction` | `retry` \| `satisfied_or_retry`. |

### 5.2 English Practice (Layer 2 — Speak Naturally) 🟡 / ⬜ Planned (Phase 2)

Voice-first spoken-English practice. The current page is a placeholder; the
**architecture is already in place** so the loop can be added without touching
product logic (§6):

- `AudioStorage` interface (`src/infrastructure/audio/types.ts`) with
  `LocalAudioStorage` — recordings stored as **local files**, never SQLite blobs;
  the DB holds only metadata (§8).
- `SpeechProvider` interface (`src/infrastructure/speech/types.ts`) —
  `transcribe()` plus optional `synthesize()` for a pronunciation "listen"
  feature (§26).
- `profiles.transcriptMode` (default `"after"`) controls when transcripts appear
  (§21).
- Feedback taxonomy already covers English: `ENGLISH_CODES`
  (`grammar`, `vocabulary`, `unnatural_phrase`, `fluency`, `filler`) and
  `PRONUNCIATION_CODES` (`word_clarity`, `stress`, `rhythm`, `intelligibility`).

### 5.3 Interview (Layer 3 — Perform Under Pressure) ⬜ Planned (Phase 3+)

Individual question practice and full interview simulation. Not yet built. The
taxonomy is pre-defined: `INTERVIEW_CODES` (`too_generic`, `insufficient_depth`,
`weak_tradeoff`, `weak_example`, `unsupported_claim`, `missing_metric`).

### 5.4 Cross-cutting: Feedback taxonomy, skills, memory & progress

- **Normalized taxonomy** (`src/domain/feedback/taxonomy.ts`, §63): every issue
  maps to a stable code so progress, memory, and analytics can aggregate. Five
  categories: `thinking`, `communication`, `english`, `pronunciation`,
  `interview`.
- **Skill dimensions** (`SKILL_DIMENSIONS`, §49, §100) tracked per user:
  `structure`, `clarity`, `conciseness`, `completeness`, `logic`, `grammar`,
  `vocabulary`, `naturalness`, `fluency`, `filler_usage`, `pronunciation`,
  `technical_depth`, `behavioral_depth`.
- **Memory & progress** (§49, §93, §100): the prompt architecture already accepts
  *relevant* memory (`relevantMemory`) and only relevant context is passed — never
  the whole DB (§93). Memory persistence, the Progress dashboard, and Flashcards
  are **Planned**.

---

## 6. Architecture (how the rules are guaranteed)

Layered, dependency-inward:

```
src/app            UI (React 19 / App Router) + server actions
   ↓
src/application     services own the workflow (attempt #, stage, completion)
   ↓
src/domain          pure rules, types, Zod schemas (no I/O)
   ↓
src/infrastructure  ai · db · audio · speech · file-storage
```

- **AI provider abstraction** (`src/infrastructure/ai/types.ts`): one
  `AIProvider` interface (`generateText` + `generateStructured`). Adding a vendor
  = implementing the interface; no product logic changes (§6). Implementations:
  `GeminiAIProvider` (@google/genai) and `MockAIProvider` (deterministic
  fallback). Selection via `getAIProvider()` (`provider.ts`), which uses
  `resolveAiProvider()` (`src/lib/env.ts`).
- **Structured output** (`src/infrastructure/ai/structured.ts`, §65): `runStructured()`
  loops — normal generation → retry → schema-repair prompt (feeds the Zod error
  back) → throws `AIStructuredError`. Callers catch and preserve user work.
- **Prompt composition** (`src/infrastructure/ai/prompt/*`, §67, §68): every
  prompt is assembled from discrete sections — **Global AI Rules + Role Rules +
  User Context + Relevant Memory + Task + Output Contract** — never one giant
  string, and global rules are never duplicated per role.
- **Persistence** (`src/infrastructure/db/*`, §58): SQLite via Drizzle. Tables:
  `profiles`, `practice_sessions`, `practice_attempts`, `feedback_items`. The
  client auto-runs migrations from `./drizzle` on boot and enables WAL +
  `foreign_keys`. Access via `practiceRepository`.
- **Observability** (`src/lib/logger.ts`, §92): `logAiCall` records `role`,
  `promptVersion`, `provider`, `latencyMs`, `ok`, and `schemaError` — metadata
  only, never content.

### 6.1 Configuration

| Env var | Default | Purpose |
| ------- | ------- | ------- |
| `GEMINI_API_KEY` | *(unset)* | Server-only. Absent → mock provider, app stays fully runnable. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model used by `GeminiAIProvider`. |
| `AI_PROVIDER` | `auto` | `gemini` \| `mock` \| `auto`. |
| `DATABASE_PATH` | `./.data/app.db` | SQLite file. |
| `AUDIO_STORAGE_DIR` | `./.data/audio` | Local audio files. |
| `LOG_LEVEL` | `info` | `debug`\|`info`\|`warn`\|`error`. |

---

## 7. Non-negotiable Acceptance Criteria (§103)

These are the checks the product must always pass. Items already verified in code
are marked ✅.

1. **No rewrite before attempt 3.** Attempts 1–2 never return a filled
   `improvedVersion`, even if the model produces one. ✅ Enforced by
   `enforceCoachingPolicy()`; covered by `coaching-stage.test.ts`.
2. **The app, not the AI, owns the workflow.** Attempt number, stage, and
   completion are computed server-side. ✅ `vietnamese-coach-service.ts`;
   covered by `vietnamese-coach-service.test.ts`.
3. **The user controls completion.** A session only becomes `completed` when the
   user chooses "I'm satisfied." ✅ (`markSatisfiedAction`).
4. **User work is never lost.** The answer is persisted before the AI call; AI
   failure yields a saved attempt and a graceful message. ✅
5. **All structured AI output is schema-valid.** Invalid output is retried,
   repaired, or rejected — never trusted. ✅ (`runStructured` + Zod).
6. **Thinking and communication feedback are kept distinct** in Vietnamese
   coaching. ✅ (schema `category` enum + role rules).
7. **Voice is preserved on rewrite** (~80–90% of original wording). Enforced by
   prompt rules (global + role).
8. **The AI never behaves as a generic chatbot** and never invents the user's
   background. Enforced by `GLOBAL_AI_RULES`.
9. **Secrets stay server-side.** `GEMINI_API_KEY` is read only in `server-only`
   modules; browser bundles never contain it. ✅
10. **The app runs end-to-end without any API key** via the mock provider. ✅
11. **The build is green and core routes serve.** `next build` passes; `/` and
    `/practice/vietnamese` return 200. ✅

---

## 8. Data Model (implemented)

`src/infrastructure/db/schema.ts`. Timestamps are ISO-8601 strings.

- **`profiles`** — `id`, `current_role`, `years_experience`, `target_role`,
  `target_markets` (JSON), `primary_skills` (JSON), `secondary_skills` (JSON),
  `english_goal`, `transcript_mode` (default `after`), `created_at`,
  `updated_at`.
- **`practice_sessions`** — `id`, `mode` (`vietnamese`\|`english`), `goal`,
  `exercise_type`, `prompt`, `question_id`, `status`
  (`active`\|`completed`\|`abandoned`), `started_at`, `completed_at`.
- **`practice_attempts`** — `id`, `session_id` (FK, cascade), `attempt_number`,
  `text_answer`, `audio_recording_id`, `transcript_id`, `feedback_id`,
  `created_at`.
- **`feedback_items`** — `id`, `attempt_id` (FK, cascade), `role`,
  `prompt_version`, `stage`, `payload` (JSON of the validated feedback object),
  `created_at`.

> `audio_recording_id` / `transcript_id` columns exist for Phase 2; audio bytes
> live on disk (`LocalAudioStorage`), not in these tables.

---

## 9. Phase Roadmap

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **0** | Foundations: layered architecture, env, DB + migrations, AI provider abstraction, mock fallback, prompt composition, taxonomy, logging. | ✅ Built |
| **1** | Layer 1 — Vietnamese staged coaching loop (Think Clearly): exercises, coach role, staged policy + guardrail, session recovery, Dashboard. | ✅ Built |
| **2** | Layer 2 — English voice practice (Speak Naturally): recording, transcription, spoken-English + pronunciation analysis, transcript modes. | ⬜ Planned (interfaces ready) |
| **3** | Layer 3 — Interview (Perform Under Pressure): individual questions, question bank, then full simulation. | ⬜ Planned (taxonomy ready) |
| **3+** | Memory, Progress dashboard, Flashcards, Profile UI. | ⬜ Planned |
