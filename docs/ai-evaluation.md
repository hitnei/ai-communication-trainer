# AI Evaluation

How we test that the AI behaves correctly and how we keep it behaving correctly
as prompts and providers change. The goal is not to score model "quality" in the
abstract — it is to protect the **product's acceptance criteria** and business
rules (staged coaching, thinking-vs-communication separation, structured-output
validity) against prompt drift and provider swaps.

This doc covers:

- The evaluation dataset categories (§89)
- The golden cases we care about (§90)
- How to test a prompt change
- How this ties into prompt versioning
- Where the mock fixtures live and how to extend them
- A proposed lightweight eval harness structure (vitest), consistent with the
  existing test setup

> **Status.** The two test files below exist and pass today
> (`coaching-stage.test.ts`, `vietnamese-coach-service.test.ts`). Everything in
> the "Proposed eval harness" section is **Planned (Phase 2)** and is described
> so it can be built without re-deriving the design.

---

## 1. What "evaluation" means here

There are two very different things being validated, and we test them
differently:

| Concern | Deterministic? | How it is guaranteed |
| --- | --- | --- |
| **Workflow / policy** (attempt numbering, staged coaching, completion) | Yes | Pure code in `src/domain` + `src/application`, unit-tested |
| **Structured-output validity** (JSON matches the Zod contract) | Yes | `runStructured()` retry → repair → throw (`src/infrastructure/ai/structured.ts`) |
| **Model judgment** (does it *diagnose* well, is the tone human) | No | Golden cases run against the **mock** provider for determinism; against Gemini only as an opt-in, non-blocking check |

The key architectural fact that makes evaluation cheap: **the AI never owns the
rules.** The application layer decides the attempt number and stage
(`submitVietnameseAttempt` in
`src/application/practice/vietnamese-coach-service.ts`), and
`enforceCoachingPolicy()`
(`src/domain/practice/coaching-stage.ts`) strips `improvedVersion` regardless of
what the model returns. So most acceptance criteria can be proven with fast,
offline, deterministic tests — no live vendor required.

---

## 2. Evaluation dataset categories (§89)

Cases are grouped by *what they are meant to prove*, not by exercise type. Each
category exercises a different guarantee.

| Category | What it proves | Provider used |
| --- | --- | --- |
| **Policy / staged coaching** | Attempt 1–2 never leak a full rewrite; attempt 3+ may | Mock (deterministic) |
| **Schema validity** | Model output parses against the Zod contract; malformed output is repaired or fails safely | Mock + fault-injected |
| **Taxonomy correctness** | `issues[].category` and `issues[].code` come from the correct code sets, and thinking vs communication are not conflated | Mock / Gemini |
| **Golden behavior** (§90) | Specific fillers/phrases are handled the way the product spec requires | Mock (pinned), Gemini (advisory) |
| **Language / tone** | Vietnamese Coach responds in Vietnamese, one honest human sentence, does not dump 15 corrections | Gemini (advisory) |
| **Failure handling** | On AI failure, the user's work is still persisted (`ok: false` but `attemptId` returned) | Mock + fault-injected |

The relevant code sets live in `src/domain/feedback/taxonomy.ts`:

- `THINKING_CODES` — `unclear_idea`, `missing_point`, `weak_logic`,
  `poor_structure`
- `COMMUNICATION_CODES` — `too_long`, `repetitive`, `main_point_late`,
  `unclear`, `incomplete`
- Skill/progress dimensions: `SKILL_DIMENSIONS` (used by progress aggregation,
  Planned).

The Vietnamese Coach output contract is
`vietnameseCoachFeedbackSchema` in
`src/domain/practice/vietnamese-feedback.ts`. Its `category` enum is
`["thinking", "communication"]` and its `code` enum is
`[...THINKING_CODES, ...COMMUNICATION_CODES]`, so a case that asserts on a code
is automatically kept honest by the schema.

---

## 3. Golden cases (§90)

Golden cases are named, hand-authored inputs with an expected *behavior* (not an
exact string). They are the regression tripwires: if a prompt change breaks one,
we want a red test.

> **Naming caveat.** The three canonical golden cases below are drawn from the
> English/naturalness and memory features. As of Phase 1 the only shipped role
> is the **Vietnamese Coach**, whose golden coverage lives in
> `vietnamese-coach-service.test.ts`. The English-filler and memory roles they
> reference are **Planned (Phase 2/3)**; the cases are documented here so the
> harness and fixtures can be authored ahead of the roles.

### 3.1 `"you know what my mean"` → corrected

- **Category:** English / grammar + naturalness.
- **Input (spoken/typed):** an answer containing `"you know what my mean"`.
- **Expected behavior:** the phrase is flagged and **corrected** to
  `"you know what I mean"`. It must be raised as a `grammar` (or
  `unnatural_phrase`) issue from `ENGLISH_CODES`, not silently ignored and not
  miscategorized as a *thinking* issue.
- **Why golden:** it is a common Vietnamese-English error; a prompt change that
  starts ignoring it, or that "corrects" a perfectly fine phrase, is a
  regression.

### 3.2 `"yeah, exactly"` → natural

- **Category:** English / naturalness (true-negative case).
- **Input:** an answer using `"yeah, exactly"` as agreement.
- **Expected behavior:** **no correction.** The phrase is natural, conversational
  English and must not be flagged as `unnatural_phrase` or `grammar`. This is the
  guard against an over-eager model that "fixes" idiomatic speech.
- **Why golden:** over-correction destroys trust faster than under-correction.
  True-negatives are as important as true-positives.

### 3.3 `"basically"` — once vs. repeated (memory)

- **Category:** filler usage + **memory** (Planned, Phase 3).
- **Case A — used once:** treat as a single, low-severity `filler` observation.
  **Do not** persist it to long-term memory or escalate it. One "basically" is
  not a pattern.
- **Case B — repeated across attempts/sessions:** the filler becomes a
  **candidate for memory** — i.e. a recurring pattern worth remembering and
  surfacing (`filler_usage` skill dimension). The distinction is *frequency /
  recurrence*, not the word itself.
- **Why golden:** it pins the rule that memory is for *patterns*, not one-off
  events, and prevents the memory store from filling with noise.

### 3.4 Golden case shape (proposed)

Each golden case is a small record so the harness can iterate uniformly:

```ts
interface GoldenCase {
  id: string;                 // e.g. "en-you-know-what-i-mean"
  role: string;               // matches AICallMeta.role
  input: string;              // the user's answer
  attemptNumber?: number;     // drives the coaching stage
  expect: {
    correctsTo?: string;              // 3.1
    noIssueOfCode?: FeedbackCode[];   // 3.2 true-negative
    hasIssueOfCode?: FeedbackCode[];  // 3.1 true-positive
    persistsToMemory?: boolean;       // 3.3
    improvedVersionAllowed?: boolean; // policy
  };
}
```

---

## 4. How to test a prompt change

The workflow below is the current, supported path. It leans on the fact that the
mock provider routes through the **same** validation loop the real provider uses
(`runStructured()`), so a fixture that passes the mock will also parse under
Gemini.

1. **Run the deterministic suite first.**
   ```bash
   npm test          # vitest, include: src/**/*.test.ts
   ```
   These never call a network. If `coaching-stage.test.ts` or
   `vietnamese-coach-service.test.ts` go red, the prompt/policy contract broke —
   stop and fix before touching the model.

2. **Bump the prompt version** in the role module (see §5). Never edit a prompt's
   text without changing its `promptVersion`.

3. **Update the mock fixture** for the role in
   `src/infrastructure/ai/mock-provider.ts` if the *shape* of a good answer
   changed (new field, new code). The fixture is the "known-good" answer the
   deterministic tests assert against. Keep it human-sounding and in the correct
   language (the Vietnamese fixture is Vietnamese).

4. **Add/adjust golden cases** (§3) for any new behavior you are introducing or
   any regression you are guarding against.

5. **(Advisory) Run against Gemini** with a real key to sanity-check judgment and
   tone:
   ```bash
   AI_PROVIDER=gemini GEMINI_API_KEY=... npm test
   ```
   Gemini-backed assertions are **non-blocking** by design (non-deterministic
   output). They are for eyeballing the diff in behavior between prompt versions,
   not for CI gating.

6. **Compare via the log stream.** Every AI call emits an `ai_call` record via
   `logAiCall()` (`src/lib/logger.ts`) carrying `role`, `promptVersion`,
   `provider`, `latencyMs`, `ok`, and `schemaError`. Filtering these by
   `promptVersion` lets you compare two prompt revisions on the same inputs.

### What CI gates on

- Policy tests (deterministic).
- Schema-validity tests (deterministic; mock output must parse).
- Golden cases **against the mock** (deterministic).

CI does **not** gate on live Gemini output.

---

## 5. Prompt versioning tie-in

Prompt versioning is the anchor for all of this. The Vietnamese Coach declares:

```ts
// src/infrastructure/ai/roles/vietnamese-coach.ts
export const VIETNAMESE_COACH_PROMPT_VERSION = "vietnamese-coach@1.0";
```

This version travels with every call and every stored result:

- It is passed in `AICallMeta.promptVersion` (`src/infrastructure/ai/types.ts`)
  on both `generateText` and `generateStructured`.
- It is written into observability via `logAiCall()` (`ai_call` log records).
- It is persisted with saved feedback:
  `practiceRepository.saveFeedback({ ..., promptVersion: VIETNAMESE_COACH_PROMPT_VERSION, stage })`
  in `submitVietnameseAttempt`.

**Rule:** any change to a role's prompt text (`ROLE_RULES`, task builder, or
`OUTPUT_CONTRACT`) MUST bump its `promptVersion` (e.g. `@1.0` → `@1.1`). Because
the version is stored alongside feedback and emitted in logs, this lets us:

- attribute a regression to a specific prompt revision,
- run golden cases per version and diff the results, and
- avoid silently mixing feedback produced by different prompt behaviors in
  progress analytics.

The eval harness (§6) keys golden results by `(role, promptVersion)` so a bump
naturally produces a new baseline.

---

## 6. Where the mock fixtures live

`src/infrastructure/ai/mock-provider.ts` is the single home for canned model
output.

- `MockAIProvider` implements the same `AIProvider` interface as
  `GeminiAIProvider` and is selected when no `GEMINI_API_KEY` is present (or
  `AI_PROVIDER=mock`), via `resolveAiProvider()` in `src/lib/env.ts` and the
  factory `getAIProvider()`.
- Fixtures are stored in `mockResponses`, a
  `Record<string, (prompt: string) => unknown>` keyed by **role** (matching
  `AICallMeta.role`). Today it contains one entry: `"vietnamese-coach"`.
- Crucially, `generateStructured` on the mock **routes the fixture through
  `runStructured()`** — the same Zod validation + repair loop the real provider
  uses. A fixture that does not satisfy `vietnameseCoachFeedbackSchema` will fail
  in exactly the same way real output would.
- By design the fixture **always returns an `improvedVersion`**, even though a
  real attempt-1 response should not. This is intentional: it makes the guardrail
  observable. The application layer's `enforceCoachingPolicy()` strips it before
  attempt 3, and `vietnamese-coach-service.test.ts` asserts exactly that
  (`a1.feedback.improvedVersion` is `null`; `a3.feedback.improvedVersion` is
  truthy).

To add a fixture for a new role, add a keyed entry to `mockResponses` returning
an object that satisfies that role's Zod schema. If the role has no fixture,
`generateStructured` throws `AIProviderError` with a helpful message.

---

## 7. Proposed eval harness (Planned, Phase 2)

A lightweight structure that fits the existing vitest setup
(`vitest.config.mts`: `include: ["src/**/*.test.ts"]`, `environment: "node"`,
`@` alias, `server-only` stubbed). No new runner, no new framework.

### 7.1 Layout

```
src/
  infrastructure/ai/mock-provider.ts        # existing fixtures (known-good)
test/
  eval/
    golden-cases.ts        # GoldenCase[] (§3), the dataset
    run-golden.ts          # helper: run a case through a role, return feedback
    golden.test.ts         # vitest: assert each case (mock provider)
    gemini.eval.ts         # OPT-IN, advisory, not matched by *.test.ts
```

Because the harness matches the existing `*.test.ts` glob, `golden.test.ts` runs
in the normal `npm test` pass. The Gemini advisory file uses a different suffix
(`*.eval.ts`) so it is **not** picked up by CI; run it explicitly.

### 7.2 Runner sketch

Reuse the real role entry point so the harness tests the *actual* prompt +
validation path, not a reimplementation:

```ts
// test/eval/run-golden.ts
import { runVietnameseCoach } from "@/infrastructure/ai/roles/vietnamese-coach";
import { coachingPolicyForAttempt } from "@/domain/practice/coaching-stage";
import { getAIProvider } from "@/infrastructure/ai/provider";

export async function runGolden(c: GoldenCase) {
  const attempt = c.attemptNumber ?? 1;
  return runVietnameseCoach(
    {
      prompt: "eval prompt",
      answer: c.input,
      attemptNumber: attempt,
      policy: coachingPolicyForAttempt(attempt),
    },
    getAIProvider(), // mock under CI, Gemini when configured
  );
}
```

```ts
// test/eval/golden.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { goldenCases } from "./golden-cases";
import { runGolden } from "./run-golden";

beforeAll(() => { process.env.AI_PROVIDER = "mock"; });

describe("golden cases (mock, deterministic)", () => {
  for (const c of goldenCases) {
    it(c.id, async () => {
      const fb = await runGolden(c);
      if (c.expect.improvedVersionAllowed === false) {
        expect(fb.improvedVersion).toBeNull();
      }
      for (const code of c.expect.hasIssueOfCode ?? []) {
        expect(fb.issues.map((i) => i.code)).toContain(code);
      }
      for (const code of c.expect.noIssueOfCode ?? []) {
        expect(fb.issues.map((i) => i.code)).not.toContain(code);
      }
    });
  }
});
```

### 7.3 Fault injection (schema-validity category)

To test the `runStructured()` failure ladder (retry → schema-repair → throw
`AIStructuredError`, §65), pass a hand-rolled provider or `generate` function
that returns malformed JSON, then invalid-shape JSON, then valid — asserting the
loop recovers, and asserting it throws after three failures. This does not need
the mock fixtures; it targets `src/infrastructure/ai/structured.ts` directly.

### 7.4 Advisory Gemini pass

`gemini.eval.ts` runs the same golden cases with `AI_PROVIDER=gemini` and a real
key, printing (not asserting) the feedback plus the `ai_call` log line for each,
so a human can diff behavior across `promptVersion` bumps. Keep it out of the CI
glob.

---

## 8. Current test coverage (implemented)

| File | Category | What it asserts |
| --- | --- | --- |
| `src/domain/practice/coaching-stage.test.ts` | Policy | Stage per attempt; `enforceCoachingPolicy` strips/keeps `improvedVersion` at the right attempts |
| `src/application/practice/vietnamese-coach-service.test.ts` | Policy + failure handling (e2e) | Full loop vs. mock provider on a temp SQLite DB: rewrite withheld until attempt 3; user controls completion |

Both are green today; `next build` passes and routes `/` and `/practice/vietnamese`
return 200.

---

## 9. Summary

- Rules are enforced in code, so most evaluation is **deterministic and offline**.
- The mock provider (`src/infrastructure/ai/mock-provider.ts`) is the fixture
  store and shares the real validation loop.
- Golden cases (§90) pin specific behaviors — correct `"you know what my mean"`,
  leave `"yeah, exactly"` alone, and only remember `"basically"` when it recurs.
- Every prompt change bumps `promptVersion`, which is logged and persisted, so
  regressions are attributable and comparable.
- The proposed vitest harness (Phase 2) adds a `test/eval/` dataset + runner
  without new tooling.
