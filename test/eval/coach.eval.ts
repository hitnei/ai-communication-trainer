import { describe, expect, it } from "vitest";
import { coachingPolicyForAttempt } from "@/domain/practice/coaching-stage";
import { getAIProvider } from "@/infrastructure/ai/provider";
import {
  ENGLISH_COACH_PROMPT_VERSION,
  runEnglishCoach,
} from "@/infrastructure/ai/roles/english-coach";
import {
  VIETNAMESE_COACH_PROMPT_VERSION,
  runVietnameseCoach,
} from "@/infrastructure/ai/roles/vietnamese-coach";
import { evaluateEnglish, evaluateVietnamese } from "./checks";
import { englishCases } from "./english-cases";
import {
  compare,
  createPacer,
  errorOutcome,
  formatReport,
  isRegression,
  mapWithConcurrency,
  readBaseline,
  summarize,
  toOutcome,
  writeBaseline,
  type CaseOutcome,
} from "./report";
import { vietnameseCases } from "./vietnamese-cases";

const provider = getAIProvider();
const live = provider.name === "gemini";
const pace = createPacer(Number(process.env.EVAL_RPM ?? 5));
const updateBaseline = process.env.EVAL_UPDATE_BASELINE === "1";
const onlyRole = process.env.EVAL_ROLE;
let quotaExhausted = false;

async function guarded(
  id: string,
  run: () => Promise<CaseOutcome>,
): Promise<CaseOutcome> {
  if (quotaExhausted) return errorOutcome(id, "skipped: Gemini quota exhausted");
  try {
    await pace();
    return await run();
  } catch (error) {
    const outcome = errorOutcome(id, error);
    if (/\b429\b|RESOURCE_EXHAUSTED/.test(outcome.error ?? "")) {
      quotaExhausted = true;
    }
    return outcome;
  }
}

function conclude(
  role: string,
  promptVersion: string,
  outcomes: CaseOutcome[],
): void {
  const report = summarize(role, promptVersion, outcomes);
  const baseline = readBaseline()[role];
  const comparison = compare(report, baseline);
  process.stderr.write(
    `${formatReport(report, outcomes, comparison, baseline)}\n`,
  );
  expect(report.errors, "infra errors, no verdict").toBe(0);
  if (updateBaseline) writeBaseline(report);
  expect(isRegression(comparison), "pass-rate regressed vs baseline").toBe(false);
}

describe.skipIf(!live)("coach eval (live Gemini, advisory)", () => {
  it.skipIf(onlyRole && onlyRole !== "vietnamese-coach")("vietnamese-coach", async () => {
    const outcomes = await mapWithConcurrency(
      vietnameseCases,
      2,
      (c) =>
        guarded(c.id, async () => {
          const feedback = await runVietnameseCoach(
            {
              prompt: c.prompt,
              answer: c.answer,
              previousAnswer: c.previousAnswer,
              attemptNumber: c.attemptNumber,
              policy: coachingPolicyForAttempt(c.attemptNumber),
            },
            provider,
          );
          return toOutcome(c.id, evaluateVietnamese(c, feedback));
        }),
    );
    conclude("vietnamese-coach", VIETNAMESE_COACH_PROMPT_VERSION, outcomes);
  }, 600_000);

  it.skipIf(onlyRole && onlyRole !== "english-coach")("english-coach", async () => {
    const outcomes = await mapWithConcurrency(
      englishCases,
      2,
      (c) =>
        guarded(c.id, async () => {
          const feedback = await runEnglishCoach(
            {
              prompt: c.prompt,
              transcript: c.transcript,
              previousTranscript: c.previousTranscript,
              allowImprovedVersion: c.allowImprovedVersion,
            },
            provider,
          );
          return toOutcome(c.id, evaluateEnglish(c, feedback));
        }),
    );
    conclude("english-coach", ENGLISH_COACH_PROMPT_VERSION, outcomes);
  }, 600_000);
});
