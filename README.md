# AI Communication & Interview Trainer

A **local-first** personal communication coach, English-speaking coach, and interviewer - built to help a Senior Frontend Engineer communicate clearly, logically, concisely, and naturally, and perform well in interviews.

This is a structured **training system**, not a chatbot. The core loop:

```
You communicate → AI analyzes → root problem → you retry → attempts compared
→ meaningful patterns remembered → future practice adapts
```

## Status

- **Phase 0 - Foundation:** ✅ complete
- **Phase 1 - Vietnamese Coach (staged coaching loop):** ✅ complete
- Phases 2-9 (English voice, interviews, memory, question bank, progress, flashcards, CV/JD): planned. See [docs/development-phases.md](docs/development-phases.md).

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
