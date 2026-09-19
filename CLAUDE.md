@AGENTS.md

# AI Communication & Interview Trainer — engineering rules

This is a **local-first personal communication trainer**, not a generic chatbot. The core loop is: user communicates → AI analyzes → root cause → retry → compare → remember → adapt. See `docs/` for full specs.

## Non-negotiable rules
- **The application controls the workflow; the AI only provides intelligence.** Attempt numbers, coaching stage, whether an improved version may be shown, and session completion are decided in the application/domain layer — never by the AI. See `src/domain/practice/coaching-stage.ts` and `src/application/practice/vietnamese-coach-service.ts`.
- **Staged Vietnamese coaching (critical):** attempt 1 = diagnose (no rewrite), attempt 2 = guide (no rewrite), attempt 3+ = improve (rewrite allowed). `enforceCoachingPolicy()` strips the rewrite regardless of AI output.
- **Preserve the user's voice** (~80–90%) and sound human, not robotic. Distinguish spoken vs written English; don't flag natural fillers automatically.
- **All AI output is Zod-validated** (`generateStructured` → `runStructured` → retry → schema-repair → `AIStructuredError`). Never trust unvalidated AI output. Never lose user work on AI failure.

## Layering (dependency direction)
`src/app` (UI + server actions) → `src/application` (services own workflow) → `src/domain` (pure rules/types/Zod) → `src/infrastructure` (ai, db, audio, speech).
- Components never touch SQLite or Gemini directly. Component → service → repository/provider.
- Provider abstractions (`AIProvider`, `AudioStorage`, `SpeechProvider`) keep vendors swappable. Gemini/mock selected by `getAIProvider()`.
- `server-only` marks server modules. AI keys are server-side only.

## Commands
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck` · `pnpm lint` · `pnpm test`
- `pnpm db:generate` (Drizzle migrations; auto-applied on boot)

## AI provider
Set `GEMINI_API_KEY` in `.env.local` for real Gemini. Without it, a deterministic `MockAIProvider` keeps the full loop runnable/testable. Prompt versions are tagged (e.g. `vietnamese-coach@1.0`).

## Working style
Build phase by phase (see `docs/development-phases.md`). Leave the repo runnable and passing typecheck/lint/tests at each phase. Don't replace core business rules with simplified behavior.
