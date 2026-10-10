import { describe, expect, it } from "vitest";
import { runEval, setBaselineFromLatest } from "@/application/eval/eval-service";
import { compare, isRegression } from "@/domain/eval/report";
import { EVAL_ROLES } from "@/domain/eval/types";
import { getAIProvider } from "@/infrastructure/ai/provider";
import { evalStore } from "@/infrastructure/eval/eval-store";
import { formatRun } from "./format";

const live = getAIProvider().name === "gemini";
const onlyRole = process.env.EVAL_ROLE;
const updateBaseline = process.env.EVAL_UPDATE_BASELINE === "1";

describe.skipIf(!live)("coach eval (live Gemini, advisory)", () => {
  for (const role of EVAL_ROLES) {
    it.skipIf(onlyRole && onlyRole !== role)(
      role,
      async () => {
        const baseline = evalStore.readBaseline(role);
        const run = await runEval(role, true);
        const comparison = compare(run.report, baseline);
        process.stderr.write(`${formatRun(run, comparison, baseline)}\n`);
        expect(run.report.errors, "infra errors, no verdict").toBe(0);
        if (updateBaseline) setBaselineFromLatest(role);
        expect(isRegression(comparison), "pass-rate regressed vs baseline").toBe(false);
      },
      600_000,
    );
  }
});
