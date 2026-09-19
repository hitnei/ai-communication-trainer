# AI Communication & Interview Trainer

A **local-first** personal communication coach, English-speaking coach, and interviewer - built to help a Senior Frontend Engineer communicate clearly, logically, concisely, and naturally, and perform well in interviews.

This is a structured **training system**, not a chatbot. The core loop:

```
You communicate → AI analyzes → root problem → you retry → attempts compared
→ meaningful patterns remembered → future practice adapts
```

## Status

All feature phases (0-8) are **complete and verified**. The full training loop is
built: Vietnamese coaching, English voice practice, individual + full interview
simulation, personal memory, question bank, progress tracking, flashcards, and
CV/Projects/JD personalization. See [docs/development-phases.md](docs/development-phases.md).

- Think → [Vietnamese practice](src/app/practice/vietnamese) · Speak → [English voice](src/app/practice/english)
- Perform → [Interviews](src/app/interview) · Remember → [Memory](src/app/memory) · Adapt → [Progress](src/app/progress)
- Plus [Question Bank](src/app/questions), [Flashcards](src/app/flashcards), and [Profile / CV / JD](src/app/profile).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · SQLite + Drizzle ORM · Zod · Gemini (`@google/genai`) with a deterministic mock fallback.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # optional: add GEMINI_API_KEY for real AI
pnpm dev                      # http://localhost:3000
```

Without a `GEMINI_API_KEY`, the app runs on a built-in **mock AI provider** so the entire loop works offline.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run the app in development |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (unit + e2e coaching-loop test) |
| `pnpm db:generate` | Generate Drizzle migrations (auto-applied on boot) |

## Architecture

Layered and vendor-agnostic:

```
src/app (UI + server actions)
   → src/application (services own the workflow)
      → src/domain (pure rules, types, Zod schemas)
         → src/infrastructure (ai / db / audio / speech providers)
```

The **application layer controls the workflow**; the AI only supplies analysis. See [docs/architecture.md](docs/architecture.md) and [docs/ai-architecture.md](docs/ai-architecture.md).

## Privacy

Local-first: no auth, no accounts, no cloud. Data (SQLite + audio files) lives under `./.data/`. AI API keys are server-side only; only the minimum context needed for a task is sent to the model.

## Docs

- [product-spec.md](docs/product-spec.md) · [solution-design.md](docs/solution-design.md) · [ux-spec.md](docs/ux-spec.md)
- [architecture.md](docs/architecture.md) · [ai-architecture.md](docs/ai-architecture.md) · [domain-model.md](docs/domain-model.md)
- [database.md](docs/database.md) · [development-phases.md](docs/development-phases.md) · [ai-evaluation.md](docs/ai-evaluation.md)
