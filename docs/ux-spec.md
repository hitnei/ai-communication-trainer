# UX Specification

This document describes the **actual, implemented** user experience of the AI Communication & Interview Trainer, plus what is deliberately deferred to a later phase. Every screen, component, and copy string referenced here maps to real source under `src/`. Where a feature is scaffolded but not yet functional, it is marked **Planned (Phase N)**.

The product is local-first: no accounts, no cloud sync. The UI language is English (§10); practice content the user writes is Vietnamese.

---

## 1. Navigation structure (§12)

Global navigation lives in a persistent left sidebar, defined once in `src/components/layout/nav.ts` (`NAV_ITEMS`) and rendered by `src/components/layout/sidebar.tsx`. The sidebar is desktop-first: it is hidden below the `md` breakpoint (`hidden ... md:flex`).

The overall shell is in `src/app/layout.tsx`: sidebar + a scrollable `<main>` whose content is centered in a `max-w-4xl` column. This constrained reading width is intentional - the app is a focused training tool, not a dashboard-dense console.

### Sections

| Label | Route | Status in code (`available`) | Notes |
|---|---|---|---|
| Dashboard | `/` | `true` | Implemented (`src/app/page.tsx`) |
| Practice | `/practice` | `true` | Redirects to `/practice/vietnamese` (`src/app/practice/page.tsx`) |
| ↳ Vietnamese | `/practice/vietnamese` | `true` | Fully implemented |
| ↳ English | `/practice/english` | `true` (route) | Placeholder screen - voice loop is **Planned (Phase 2)** |
| Interview | `/interview` | `false` | **Planned** |
| ↳ Individual | `/interview/individual` | `false` | **Planned** |
| ↳ Full Simulation | `/interview/simulation` | `false` | **Planned** |
| Question Bank | `/questions` | `false` | **Planned** |
| Flashcards | `/flashcards` | `false` | **Planned** |
| Progress | `/progress` | `false` | **Planned** |
| Profile | `/profile` | `false` | **Planned** |

### Navigation behavior (as implemented)

- **Active state**: Dashboard is active only on exact `/`; every other item is active when the path *starts with* its `href` (`pathname.startsWith(item.href)`).
- **Sub-items**: children (Vietnamese / English) render only when the parent is active and available, indented under a left border.
- **Unavailable sections**: rendered at `opacity-50`, `cursor-not-allowed`, `href="#"`, `aria-disabled`, and tagged with a small uppercase **`Soon`** label on the right. They are visible on purpose so the user can see the product's shape, but they cannot be entered.
- **Footer**: the sidebar foot shows `Local-first · Phase 1` - a quiet honesty cue about scope.

The sidebar header shows a solid primary-color square (placeholder mark, `aria-hidden`) next to "Communication Trainer". There is no separate logo asset yet.

---

## 2. Design direction

The visual system is defined entirely in `src/app/globals.css` (Tailwind v4, CSS custom properties in `oklch`). The stated intent, verbatim from the file header:

> Professional adult productivity/training app. Clean, focused, premium, minimal, calm. Neutral slate palette with a single calm indigo accent. No gamified/childish styling.

### Principles

- **Calm and neutral.** A near-white slate background (`--background: oklch(0.99 0.002 260)`) with slate-tinted foreground. Surfaces are plain white cards with a soft `shadow-sm` and `rounded-xl` corners.
- **One accent.** A single calm indigo (`--primary: oklch(0.52 0.16 265)`) carries all emphasis - active nav, primary buttons, focus ring, the "improved version" highlight. No secondary brand colors.
- **Semantic-only color.** `success` (green), `warning` (amber), `destructive` (red) exist for meaning, never decoration. Feedback categories reuse these: *thinking* issues use `warning`, *communication* issues use `secondary`/muted.
- **No gamification.** There are no points, streaks, levels, XP bars, confetti, mascots, or celebratory sound. Completion is acknowledged with one restrained success card, not a reward animation. Progress is framed as *insight*, not score.
- **Typography.** Geist Sans (body/UI) and Geist Mono, loaded in `layout.tsx`. Headings are `font-semibold tracking-tight`; secondary text uses `text-muted-foreground`. Section labels are small uppercase tracked labels.
- **Dark mode** tokens are fully defined (`.dark` block) but there is no theme toggle in the UI yet - **Planned**.

### Component primitives (`src/components/ui`)

| Component | File | Role |
|---|---|---|
| `Button` | `button.tsx` | Variants: `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`; sizes `default/sm/lg/icon`. Auto-sizes lucide icons. |
| `Card` (+ `Header/Title/Description/Content/Footer`) | `card.tsx` | The primary content container across all screens. |
| `Badge` | `badge.tsx` | Variants: `default`, `secondary`, `outline`, `success`, `warning`, `destructive`, `muted`. Used for stage labels and feedback categories. |
| `Textarea` | `textarea.tsx` | The single text input surface for answers and prompts. |
| `Spinner` | `spinner.tsx` | Small inline `Loader2` spinner. Its doc comment mandates: "Pair with human-sounding copy." |

Icons throughout are from `lucide-react` (e.g. `Send`, `RotateCcw`, `CheckCircle2`, `AlertTriangle`, `Sparkles`, `Lightbulb`, `HelpCircle`).

---

## 3. Vietnamese practice - screens and flow

The Vietnamese practice experience is the one fully-built loop. It lives under `src/features/practice/vietnamese/` and is routed by `src/app/practice/vietnamese/page.tsx`.

Routing is state-driven by a single query param:

- `/practice/vietnamese` (no `session`) → **Start screen** (`StartPractice`).
- `/practice/vietnamese?session=<id>` → **Practice screen** (`VietnamesePractice`), if `getSessionState(id)` resolves; otherwise it falls back to the Start screen.

The page is `export const dynamic = "force-dynamic"` so session state is always read fresh from SQLite on the server.

### 3.1 Start screen (`start-practice.tsx`)

A calm two-step setup, each step in its own card:

1. **"1. Choose an exercise"** - pill buttons for the eight exercise types from `EXERCISE_LABELS` (`src/domain/practice/types.ts`): Explain a problem, Tell a story, Give an opinion, Explain a technical concept, Explain an experience, Interview answer, Casual conversation, Rewrite a messy thought. The selected pill is filled with the indigo accent; others are muted.
2. **"2. Your prompt"** - a Vietnamese seed prompt from `VIETNAMESE_PROMPTS` shown in an editable `Textarea`. A **"Change prompt"** ghost button (shuffle icon) swaps to another seed for the same type; the user may also freely edit the text.

The intro copy sets expectations for staged coaching up front:

> Turn messy thoughts into clear, structured communication. Answer in Vietnamese - the coach diagnoses first, and only shows a rewrite once you've worked on it yourself.

The **"Start practice"** button calls `startSessionAction`, then navigates to `?session=<id>`. The input placeholder for answers is Vietnamese: *"Viết câu trả lời của bạn bằng tiếng Việt…"*.

### 3.2 Practice screen (`vietnamese-practice.tsx`)

A single vertical column, top to bottom:

- **Header**: a `← New practice` back link (returns to the Start screen), the title *"Vietnamese Practice"*, and the prompt shown in a muted card.
- **Attempt history**: each prior attempt rendered as `Attempt N` + a stage `Badge` + the user's answer card + either its feedback card or an error card (see §5).
- **Composer / completion card** at the bottom: either the answer composer (still active) or the "Session complete" card.

The client component seeds its state from server-provided `initialAttempts` (`AttemptWithFeedback[]`), so a reload rebuilds the full history - this is the backbone of session recovery (§7).

---

## 4. Staged-coaching UX (the core business rule)

Staged coaching is the product's defining behavior. The rule is a pure domain function, `coachingPolicyForAttempt` in `src/domain/practice/coaching-stage.ts`, and it is **owned by the application layer** (`vietnamese-coach-service.ts`), never by the AI. The UI merely reflects the stage.

| Attempt | Stage | Badge label | Rewrite shown? | Direction hints? |
|---|---|---|---|---|
| 1 | `diagnose` | **Diagnose** | No | No |
| 2 | `guide` | **Guide** | No | Yes |
| 3+ | `improve` | **Improve** | Yes | Yes |

### How the UI communicates the current stage

Before the user submits, the composer card shows the upcoming stage as a `Badge` and a plain-language explanation from `STAGE_HELP` in `vietnamese-practice.tsx`:

- **Diagnose** - *"First attempt - the coach will point out the real problem and ask you questions, but won't rewrite it for you yet."*
- **Guide** - *"Second attempt - you'll get direction and structure hints, still no full rewrite."*
- **Improve** - *"You've put in the work - the coach may now show a more natural version, keeping your voice."*

The client computes the next stage locally (`coachingPolicyForAttempt(entries.length + 1)`) so the label is correct before any round-trip. This is display only - the **server independently re-derives the stage** from the persisted attempt count and enforces it.

### The guardrail (why the UI can trust the stage)

Even if the model returns an `improvedVersion` too early, `enforceCoachingPolicy()` strips it server-side before persistence whenever `canRevealImprovedVersion` is false. The feedback renderer (`feedback-view.tsx`) then simply shows the "A more natural way to say it" block *if and only if* `feedback.improvedVersion` is present. No stage logic lives in the view - it renders whatever survived the guardrail.

### Feedback presentation (`feedback-view.tsx`)

Each feedback card is titled **"What I noticed"** and renders, in order, only the sections that have content:

1. **Summary** - one plain paragraph.
2. **Strengths** - green-check list (optional).
3. **What to work on** - the **top 2-3 issues only** (`feedback.issues.slice(0, 3)`), each in a bordered tile with a category badge. *Thinking* problems get a `warning` badge; *communication* problems get a `secondary` badge - the taxonomy visibly separates the two (§19).
4. **Think about this** - reflection questions (the heart of attempt 1).
5. **A direction to try** - suggestions (from attempt 2).
6. **A more natural way to say it** - the rewrite, in an accented indigo box with a `Sparkles` icon (attempt 3+ only).

Capping issues at three is deliberate: avoid overwhelming the user (§24).

### Completion is user-controlled

The user, not the app, decides when an answer is good enough. After the first attempt the composer offers three actions:

- **Try again** (primary, `Send`) - submit the next attempt.
- **Keep improving** (`outline`, `RotateCcw`) - scrolls/focuses the composer without submitting.
- **I'm satisfied** (`ghost`, `CheckCircle2`) - calls `markSatisfiedAction`, marking the session `completed`.

On completion the composer is replaced by a single restrained success card:

> **Session complete** - Nice work. You decided when this was good enough.

There is no scoring, no "you passed", no next-level prompt.

---

## 5. Required UX states

The implemented Vietnamese loop covers these states; others are specified here as the standard the rest of the app should follow.

| State | Where it's implemented today | Behavior / copy |
|---|---|---|
| **Loading (initial)** | Server components (`force-dynamic`) | State is read on the server and streamed; no client loading screen for first paint. |
| **Processing (submit)** | `vietnamese-practice.tsx` via `useTransition` | While `pending`, the `Textarea` and buttons are disabled and the primary button shows `Spinner` + *"Thinking about your answer…"*. Start screen shows *"Starting…"*. |
| **Success** | Feedback card appears in history; completion card on satisfy | Restrained, no celebration. |
| **Error (AI failure)** | `submitAttemptAction` → `SubmitAttemptResult.ok === false` | The attempt is appended with `failed: true` and rendered as a `destructive`-tinted card with `AlertTriangle`: *"Something went wrong while analyzing this answer. Your work was saved - you can try submitting again."* A short inline message is also set. **The user's text is never lost** - it is persisted before the AI call. |
| **Error (start failure)** | `start()` catch in `start-practice.tsx` | Inline: *"Couldn't start the session. Please try again."* |
| **Empty (no attempts)** | Practice screen with `entries.length === 0` | History section is empty; composer title reads *"Your answer"* and the button reads *"Submit"* instead of *"Try again"*. |
| **Empty (dashboard / no active session)** | `src/app/page.tsx` | No "unfinished session" card is shown; the user sees only the recommended-practice card. |
| **Offline** | Inherent to local-first + mock fallback | No network is required for the core loop when `GEMINI_API_KEY` is absent (mock provider). A dedicated "you are offline" banner is **Planned**. |
| **Unsaved work** | Handled by write-before-AI persistence | Because each answer is saved *before* analysis, there is no unsaved-draft problem for submitted attempts. An explicit "unsaved changes" guard on the in-progress textarea (before submit) is **Planned**. |

### Notes on error handling philosophy

Only *known* AI errors (`AIStructuredError`, `AIProviderError`) are converted to a graceful `ok: false` result; unknown errors are re-thrown so they surface loudly in development rather than being silently swallowed. The user-facing string never exposes stack traces or model internals.

---

## 6. Copy guidelines - human, not robotic (§76, §97)

The product should sound like a thoughtful human coach, never like a system dialog. This is visible in the shipped strings and should be maintained everywhere.

**Do:**

- Speak as a coach in the first person about what the coach observed: card titles are **"What I noticed"**, not "Feedback" or "Analysis".
- Frame states as ongoing thought: **"Thinking about your answer…"**, not "Loading" or "Processing request".
- Acknowledge effort and agency: **"You've put in the work…"**, **"You decided when this was good enough."**
- Explain *why* something matters (Dashboard: *"Getting to your main point early is the highest-value habit for interviews and standups."*).
- Reassure on failure with concrete facts: **"Your work was saved - you can try submitting again."**
- Keep it short. One idea per line. Prefer plain verbs.

**Don't:**

- No error codes, stack traces, or model/provider names in user-facing copy.
- No gamified praise ("Great job!! 🎉"), no guilt, no urgency.
- No jargon from the architecture (no "structured output", "schema", "provider").
- Avoid generic system phrasing ("An error occurred", "Invalid input") - prefer specific, kind alternatives ("Write something before submitting.").

**Positioning line (Dashboard, "The training loop"):**

> You answer → the coach diagnoses the real problem → you retry → it compares your attempts → meaningful patterns are remembered → future practice adapts. **This is a trainer, not a chatbot.**

That last sentence is the north star for tone: the app coaches deliberately; it does not chat.

---

## 7. Session recovery (§78)

Recovery works at two levels, both already implemented.

1. **Full-history rebuild.** The practice route is `force-dynamic` and reads session state from SQLite (`getSessionState`). Reopening `?session=<id>` - after a reload, a crash, or days later - rebuilds every attempt, its stage badge, and its feedback exactly, because `VietnamesePractice` seeds from server `initialAttempts`.
2. **"You have an unfinished session" on the Dashboard.** On launch, `src/app/page.tsx` calls `getActiveVietnameseSession()` (→ `practiceRepository.getActiveSession("vietnamese")`). If an `active` session exists, an accented card appears at the top:

   > **You have an unfinished session** - [prompt excerpt, `line-clamp-2`] - **Continue →**

   The Continue button links straight back to `?session=<id>`.

Sessions carry an explicit `status` (`active` | `completed` | `abandoned`, from `SessionStatus`). "I'm satisfied" sets `completed`; `abandonVietnameseSession` / `discardSessionAction` set `abandoned` (server action exists; there is no discard button in the UI yet - **Planned**). Only `active` sessions are surfaced for recovery.

Because answers are persisted *before* the AI call, recovery is lossless even if the app died mid-analysis: the attempt reappears (as feedback if it succeeded, or re-submittable if it did not).

---

## 8. Transcript modes - Planned (Phase 2)

Voice practice is **not yet built**. The English practice route (`src/app/practice/english/page.tsx`) is a deliberate placeholder that states the plan honestly:

> Voice recording, transcript, and spoken-English analysis arrive in Phase 2. The architecture (audio + speech provider interfaces) is already in place.

The seams are real and already in the codebase, so the voice loop can be added without touching product logic:

- **`SpeechProvider`** (`src/infrastructure/speech/types.ts`): `transcribe(audio, mimeType) → TranscriptionResult` with `text`, optional `language`, optional timed `segments` (`TranscriptSegment { text, startMs?, endMs? }`), and optional `confidence` (0..1). Optional `synthesize()` for a pronunciation "listen" (TTS). No implementation ships yet.
- **`AudioStorage` / `StoredAudio`** (`src/infrastructure/audio/types.ts`) with a working `LocalAudioStorage`: recordings are saved as **local files**, never as SQLite blobs; the DB stores only metadata (`audioRecordingId`, `transcriptId` on `PracticeAttempt`) pointing at them.

### Planned transcript UX (design intent, not yet coded)

- **Live / interim mode**: show interim transcript text while recording, using `segments` timing when the provider supplies it.
- **Final transcript mode**: a clean, editable transcript the user can correct before it is analyzed (so speech-to-text errors are not scored as communication mistakes).
- **Low-confidence surfacing**: where `confidence` is reported and low, visually flag uncertain spans and let the user confirm/edit rather than silently trusting the text (§26).
- The staged-coaching model (diagnose → guide → improve, user-controlled completion) is language-agnostic and is intended to wrap the English voice loop unchanged.

Until Phase 2, no transcript UI, recording controls, or waveform components exist in `src/components` or `src/features`.

---

## 9. Accessibility & responsiveness (current state)

- **Focus** is always visible: primitives include a `ring-2 ring-ring` focus-visible style; the global `*` rule sets an outline color.
- **Disabled semantics**: unavailable nav uses `aria-disabled`; buttons disable during `pending`.
- **Keyboard**: standard button/link/textarea semantics; the "Keep improving" action programmatically focuses and scrolls the composer into view.
- **Responsive**: the sidebar is desktop-first and hidden under `md`. A mobile navigation (drawer/top bar) is **Planned** - on small screens today the main content is reachable but the sidebar is not shown.
- **Color contrast**: the slate/indigo palette is chosen for calm legibility; semantic colors carry an icon *and* text label (never color alone) - e.g. issue category badges pair a word with the color.
