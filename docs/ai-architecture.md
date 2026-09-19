# AI Architecture

How the AI Communication & Interview Trainer talks to language models. The design goal is that **no product logic depends on a specific vendor**: the domain and application layers see only the `AIProvider` interface, and everything vendor-specific lives behind it in `src/infrastructure/ai`.

All AI infrastructure is server-only. `provider.ts` and `env.ts` both start with `import "server-only"`, and `GEMINI_API_KEY` is read exclusively on the server (see [Environment & selection](#environment--selection)).

---

## Layer overview

```
src/app                     UI + server actions
   │  (calls application services only)
src/application/practice    owns the workflow: attempt #, stage, completion
   │  (calls AI roles + repositories)
src/infrastructure/ai       AIProvider + Gemini/Mock + prompts + structured loop
   │
src/domain/practice|feedback  pure rules, Zod schemas, taxonomy (no I/O)
```

The application layer decides *what happens*; the AI role supplies *intelligence only*. This separation is what enforces the staged-coaching business rule (below) even when a model misbehaves.

---

## The `AIProvider` interface

Defined in `src/infrastructure/ai/types.ts`. This is the single interface the rest of the app depends on — adding a new vendor means implementing this and nothing else.

```ts
export interface AIProvider {
  readonly name: string;
  generateText(params: GenerateTextParams, meta: AICallMeta): Promise<string>;
  generateStructured<T>(
    params: GenerateStructuredParams<T>,
    meta: AICallMeta,
  ): Promise<T>;
}
```

Supporting types:

| Type | Purpose | Key fields |
| --- | --- | --- |
| `AICallMeta` | Attached to every call for observability + versioning | `role`, `promptVersion`, `sessionId?` |
| `GenerateTextParams` | Free-text generation | `system?`, `prompt`, `temperature?`, `maxOutputTokens?` |
| `GenerateStructuredParams<T>` | Schema-validated generation | `system?`, `prompt`, `schema: ZodType<T>`, `schemaName?`, `temperature?`, `maxOutputTokens?` |

The Zod `schema` is the single source of truth for the shape of structured output. `schemaName` is a human-readable name used in the repair prompt when the model returns invalid JSON.

---

## Implementations

Two providers implement `AIProvider`. Both route structured generation through the same `runStructured()` loop, so validation and repair behavior is identical regardless of which one is active.

### `GeminiAIProvider`

`src/infrastructure/ai/gemini-provider.ts` — the **only** file that imports the Gemini SDK (`@google/genai`). Constructed with an API key and model name.

- `generateText` calls `client.models.generateContent` with `systemInstruction`, `temperature` (default `0.7`), and `maxOutputTokens`.
- `generateStructured` delegates to `runStructured`, whose `generate` callback calls the SDK with `responseMimeType: "application/json"` and a lower default `temperature` of `0.4`.
- Every call is wrapped in `logAiCall(...)` for both success and failure paths; SDK failures are rethrown as `AIProviderError`.

### `MockAIProvider`

`src/infrastructure/ai/mock-provider.ts` — a deterministic offline provider used when no `GEMINI_API_KEY` is present, so the full product loop is runnable and testable without a live vendor.

- `generateText` returns a short marker string (`【mock:<role>】 …`).
- `generateStructured` looks up a canned response by `meta.role` in the `mockResponses` record. If no fixture exists for that role it throws `AIProviderError` telling you to add one or configure a key.
- Canned output is still routed **through the same `runStructured` loop** (its `generate` just returns `JSON.stringify(canned(prompt))`), so the mock exercises the real validation path.

Only one role fixture exists today: `"vietnamese-coach"`, which returns believable Vietnamese feedback. Notably, the mock **always** includes an `improvedVersion`. That does not violate the staged-coaching rule — stripping the rewrite before attempt 3 is the application layer's job, so the mock returning it makes the guardrail observable.

---

## Provider factory & selection

`getAIProvider()` in `src/infrastructure/ai/provider.ts` is the single access point. It caches one provider instance per process and decides Gemini vs. mock so no other module knows which is active.

```ts
const kind = resolveAiProvider();
if (kind === "gemini" && env.GEMINI_API_KEY) {
  cached = new GeminiAIProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL);
} else {
  cached = new MockAIProvider();
}
```

### Environment & selection

Environment is validated once with Zod in `src/lib/env.ts` (fails fast with a readable error on bad config). Relevant variables:

| Variable | Default | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | *(unset)* | Server-only. Absent ⇒ mock fallback. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Passed to `GeminiAIProvider`. |
| `AI_PROVIDER` | `auto` | `gemini` \| `mock` \| `auto`. |
| `DATABASE_PATH` | `./.data/app.db` | |
| `AUDIO_STORAGE_DIR` | `./.data/audio` | |
| `LOG_LEVEL` | `info` | |

`resolveAiProvider()` computes the effective choice:

- `AI_PROVIDER=gemini` → `"gemini"`
- `AI_PROVIDER=mock` → `"mock"`
- `AI_PROVIDER=auto` → `"gemini"` if `GEMINI_API_KEY` is set, else `"mock"`

The factory additionally requires the key to actually be present before instantiating Gemini, so `auto` degrades gracefully to the mock in local/dev environments.

---

## Prompt composition

Prompts are assembled from discrete sections rather than one giant string. Composition lives in `src/infrastructure/ai/prompt/builder.ts`:

```
System instruction = Global AI Rules + Role Rules
User prompt        = User context + Relevant memory + Task + Output contract
```

- `buildSystemPrompt(roleRules)` → `GLOBAL_AI_RULES` + `---` + role rules. This is stable across all of a role's calls.
- `buildUserPrompt(sections)` → assembles the per-call prompt from the optional `userContext`, optional `relevantMemory`, required `task`, and required `outputContract`, each under its own `#` heading.

Only *relevant* context/memory should be passed in — never the whole database.

### Global AI rules

`GLOBAL_AI_RULES` (`src/infrastructure/ai/prompt/global-rules.ts`) is shared by every role and composed ahead of role-specific rules — never duplicated per role. Key directives:

- Be human, direct, specific — sound like a real coach, not a corporate report.
- Never invent the user's experience, projects, metrics, or background.
- Preserve the user's voice: when rewriting, keep ~80–90% of original style/wording; rewrite aggressively only if the original is genuinely hard to understand.
- Don't overcorrect — surface what matters most.
- **Distinguish spoken from written language** (see below).
- Teach before replacing; base any claim of a recurring weakness on repeated evidence.
- Return only what the requested JSON schema asks for — no prose, no code fences.

### Spoken vs. written handling

The system explicitly avoids treating natural speech as error. From the global rules, models must:

- Treat natural spoken fillers (e.g. "you know", "yeah", "I mean", "actually") as **not automatically wrong** — flag them only when they genuinely hurt clarity or are used as a crutch.
- Classify along a spectrum: *natural / acceptable / context-dependent / awkward / incorrect*, and not treat casual-but-valid speech as an error.

This distinction is reinforced in the domain taxonomy, where `filler` is an *English* code and `filler_usage` is a tracked skill dimension (`src/domain/feedback/taxonomy.ts`) rather than an automatic penalty.

---

## AI roles

A role bundles its role rules, task builder, output contract, prompt version, and the call into a provider.

### Implemented: Vietnamese Coach

`src/infrastructure/ai/roles/vietnamese-coach.ts`, prompt version **`vietnamese-coach@1.0`** (`VIETNAMESE_COACH_PROMPT_VERSION`). Entry point `runVietnameseCoach(input, provider = getAIProvider())`.

- **Role rules** (`ROLE_RULES`): a Vietnamese-speaking communication coach. Responds entirely in natural Vietnamese. Explicitly separates **thinking problems** (unclear idea, missing point, weak logic, poor structure) from **communication problems** (too long, repetitive, main point late, unclear/incomplete explanation) and must not conflate them. It is not an English lesson.
- **Staged coaching in the prompt**: the role rules and `buildTask()` inject a stage-specific instruction (`diagnose` / `guide` / `improve`) derived from the `CoachingPolicy`. In `diagnose` and `guide`, the model is told to leave `improvedVersion` null.
- **Output contract** (`OUTPUT_CONTRACT`): JSON with `summary`, `strengths`, `issues[]`, `reflectionQuestions[]`, `suggestions[]`, `improvedVersion` (nullable), `nextAction`.
- **Call config**: `temperature: 0.5`, schema `vietnameseCoachFeedbackSchema`, `schemaName: "VietnameseCoachFeedback"`, meta `{ role: "vietnamese-coach", promptVersion, sessionId }`.

### Planned (later phases)

The feedback taxonomy already reserves codes/dimensions for roles that are **not yet implemented** as AI roles:

| Role (planned) | Related taxonomy codes | Status |
| --- | --- | --- |
| English communication coach | `ENGLISH_CODES` (grammar, vocabulary, unnatural_phrase, fluency, filler) | Planned |
| Pronunciation coach | `PRONUNCIATION_CODES` (word_clarity, stress, rhythm, intelligibility) | Planned |
| Interview coach | `INTERVIEW_CODES` (too_generic, insufficient_depth, weak_tradeoff, weak_example, unsupported_claim, missing_metric) | Planned |

Only `vietnamese-coach` exists in `src/infrastructure/ai/roles/` and in the mock fixtures today. The codes above are defined for future use, not wired into a role.

---

## Structured output: contract, validation & failure handling

Structured output is the core reliability mechanism. Every structured response is validated against a Zod schema — **unvalidated output is never trusted**.

### Output contract

The domain schema `vietnameseCoachFeedbackSchema` (`src/domain/practice/vietnamese-feedback.ts`) is the source of truth:

| Field | Type / rule |
| --- | --- |
| `summary` | non-empty string |
| `strengths` | `string[]`, defaults `[]` |
| `issues` | array of `{ category: "thinking"|"communication", code, title, detail }` |
| `reflectionQuestions` | `string[]` — core of the diagnose stage |
| `suggestions` | `string[]` — direction/hints from the guide stage on |
| `improvedVersion` | `string \| null`, defaults `null` — permitted only from attempt 3+ |
| `nextAction` | `"retry" \| "satisfied_or_retry"` |

`issues[].code` is validated against the union `[...THINKING_CODES, ...COMMUNICATION_CODES]` from the taxonomy, so the coach cannot emit an off-taxonomy code.

### The `runStructured` algorithm

`src/infrastructure/ai/structured.ts`. Provider-agnostic — each provider supplies a `generate(prompt)` callback and the loop handles extraction, parsing, validation, and repair.

```
for attempt = 1..3:
    prompt = basePrompt                     (attempts 1 and 2)
           | basePrompt + repair-suffix     (attempt 3)
    raw       = generate(prompt)
    candidate = extractJson(raw)            # strip ``` fences / surrounding prose
    try parsedJson = JSON.parse(candidate)
        on error → record error, continue
    result = schema.safeParse(parsedJson)
        success → return result.data
        failure → lastError = first 6 Zod issues, continue
throw AIStructuredError(message, lastRaw, lastError)
```

Behavior by attempt:

1. **Attempt 1** — normal generation.
2. **Attempt 2** — plain retry (same base prompt); handles transient bad output.
3. **Attempt 3** — **schema-repair prompt**: the base prompt plus the previous raw response and the recorded error, instructing the model to return *only* corrected JSON matching the schema with no prose or fences.

If all three attempts fail, it throws `AIStructuredError` (`src/infrastructure/ai/errors.ts`) carrying `lastRaw` and `validationError` for diagnostics.

`extractJson()` defensively pulls a JSON object/array out of the response — it unwraps ```` ```json ```` fences and, failing that, slices from the first `[`/`{` to the last `]`/`}` — because models sometimes wrap JSON in prose even when told not to.

### Error types

| Error | Meaning |
| --- | --- |
| `AIProviderError` | Provider unreachable / vendor error (network, quota), or a missing mock fixture. |
| `AIStructuredError` | Provider responded but never produced schema-valid output after 3 attempts. |

### Graceful save on failure

The application service `submitVietnameseAttempt` (`src/application/practice/vietnamese-coach-service.ts`) guarantees the user never loses work:

1. It **persists the user's answer first** (`createAttempt`) before calling the AI.
2. It runs `runVietnameseCoach(...)`.
3. On success it enforces the coaching policy (below) and saves feedback.
4. On a **known** failure (`AIStructuredError` or `AIProviderError`) it logs `vietnamese_attempt_failed` and returns a structured result `{ ok: false, attemptId, attemptNumber, error: "ai_failed", message }` — the saved attempt id is still returned so the UI can recover. Unknown errors are rethrown.

The returned failure message: *"Something went wrong while analyzing your answer. Your work has been saved locally."*

---

## Staged coaching (critical business rule)

The staged-coaching guardrail is owned by the application layer, not the AI. Pure rules live in `src/domain/practice/coaching-stage.ts`.

`coachingPolicyForAttempt(attemptNumber)`:

| Attempt | Stage | `canRevealImprovedVersion` | `canGiveDirection` | Label |
| --- | --- | --- | --- | --- |
| ≤ 1 | `diagnose` | false | false | Diagnose |
| 2 | `guide` | false | true | Guide |
| 3+ | `improve` | true | true | Improve |

`enforceCoachingPolicy(feedback, policy)` is the hard guardrail: if `!canRevealImprovedVersion` and `feedback.improvedVersion` is set, it returns a copy with `improvedVersion: null`. This runs **regardless of what the model returned**, so the acceptance criteria hold even if a model ignores its stage instruction — which is exactly why the mock always returns a rewrite.

The application service decides the attempt number (`countAttempts + 1`), derives the policy, prompts the role with that stage, enforces the policy on the result, then persists. Session completion is user-controlled (`completeVietnameseSession` / `abandonVietnameseSession`), never inferred by the AI.

---

## Prompt versioning

Each role exports a version constant embedded in the prompt module and travels with every call:

- `VIETNAMESE_COACH_PROMPT_VERSION = "vietnamese-coach@1.0"`.
- Passed as `meta.promptVersion` to `generateStructured`, logged on every AI call, and **persisted with feedback** (`saveFeedback({ ..., promptVersion })`).

Storing the version alongside saved feedback means historical results can be attributed to the prompt that produced them, enabling safe iteration on prompts over time.

---

## Observability & logging

`src/lib/logger.ts` provides a minimal structured logger (level-gated by `LOG_LEVEL`, JSON lines). It logs operational metadata only — never raw personal content or audio.

- `logger.info("ai_provider_selected", { provider, model? })` — emitted by the factory on first use.
- `logAiCall(record: AiCallLog)` — emitted by **both** providers on every structured/text call, success or failure.

`AiCallLog` fields:

| Field | Description |
| --- | --- |
| `role` | AI role (e.g. `vietnamese-coach`) |
| `promptVersion` | e.g. `vietnamese-coach@1.0` |
| `provider` | `gemini` \| `mock` |
| `sessionId?` | correlates to a practice session |
| `latencyMs` | wall-clock via `performance.now()` (always `0` for mock) |
| `ok` | success flag |
| `schemaError?` | error message on structured failure |

Application-level failures are additionally logged as `vietnamese_attempt_failed` by the coach service.

---

## Extending: adding a new AI role or provider

**New provider:** implement `AIProvider` in `src/infrastructure/ai/`, route structured calls through `runStructured`, call `logAiCall` on both paths, wire it into `getAIProvider()` and `resolveAiProvider()`. No product logic changes.

**New role:** add a role module under `src/infrastructure/ai/roles/` with its own role rules, task builder, output contract, a `*_PROMPT_VERSION` constant, and a domain Zod schema. Add a canned fixture in `mockResponses` keyed by the role name so the mock provider stays runnable. Own the workflow (attempt/stage/completion) in an application service.

---

## Related tests

- `src/domain/practice/coaching-stage.test.ts` — policy + `enforceCoachingPolicy` guardrail.
- `src/application/practice/vietnamese-coach-service.test.ts` — end-to-end coaching loop against the mock provider and a temp SQLite database.
