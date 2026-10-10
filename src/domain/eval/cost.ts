export const PRICING_MODEL = "gemini-3.5-flash";

const INPUT_USD_PER_TOKEN = 1.5 / 1_000_000;
const OUTPUT_USD_PER_TOKEN = 9 / 1_000_000;
const RETRY_FACTOR = 1.2;

const LOW = { inputTokens: 1_000, outputTokens: 800 };
const HIGH = { inputTokens: 1_500, outputTokens: 1_800 };

export interface CostEstimate {
  calls: number;
  lowUsd: number;
  highUsd: number;
}

function perCall(t: { inputTokens: number; outputTokens: number }): number {
  return t.inputTokens * INPUT_USD_PER_TOKEN + t.outputTokens * OUTPUT_USD_PER_TOKEN;
}

/** Rough estimate from measured prompt sizes; verify against Google's price page. */
export function estimateCost(calls: number): CostEstimate {
  return {
    calls,
    lowUsd: calls * perCall(LOW),
    highUsd: calls * RETRY_FACTOR * perCall(HIGH),
  };
}
