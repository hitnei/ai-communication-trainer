"use server";

import {
  EvalGuardError,
  runEval,
  setBaselineFromLatest,
} from "@/application/eval/eval-service";
import { isEvalRole, type RoleReport, type RunRecord } from "@/domain/eval/types";

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof EvalGuardError) return { ok: false, error: error.message };
  return { ok: false, error: "Eval failed unexpectedly. Check the server log." };
}

export async function runEvalAction(
  role: string,
  confirmed: boolean,
): Promise<ActionResult<RunRecord>> {
  if (!isEvalRole(role)) return { ok: false, error: "Unknown role." };
  try {
    return { ok: true, value: await runEval(role, confirmed) };
  } catch (error) {
    return fail(error);
  }
}

export async function setBaselineAction(
  role: string,
): Promise<ActionResult<RoleReport>> {
  if (!isEvalRole(role)) return { ok: false, error: "Unknown role." };
  try {
    return { ok: true, value: setBaselineFromLatest(role) };
  } catch (error) {
    return fail(error);
  }
}
