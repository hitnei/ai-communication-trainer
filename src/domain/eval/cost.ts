import type { TokenUsage } from "./types";

export interface Prices {
  inputPerMillion: number;
  outputPerMillion: number;
}

/** Unverified third-party figures for gemini-3.5-flash; override via env. */
export const DEFAULT_PRICES: Prices = { inputPerMillion: 1.5, outputPerMillion: 9 };

const RETRY_HEADROOM = 1.3;

/** How many times a failing case is re-run to measure stability. */
export const PROBE_REPEATS = 3;

export interface CostEstimate {
  calls: number;
  lowUsd: number;
  highUsd: number;
  /** "measured" uses the average from a real earlier run; "assumed" is a guess. */
  basis: "measured" | "assumed";
}

export function usageCostUsd(usage: TokenUsage, prices: Prices): number {
  const input = (usage.promptTokens * prices.inputPerMillion) / 1_000_000;
  const output =
    ((usage.outputTokens + usage.thoughtsTokens) * prices.outputPerMillion) / 1_000_000;
  return input + output;
}

/** Thinking is billed as output, so it is part of the output side here. */
export function billedOutputTokens(usage: TokenUsage): number {
  return usage.outputTokens + usage.thoughtsTokens;
}

const ASSUMED_PER_CALL: Omit<TokenUsage, "calls"> = {
  promptTokens: 1_300,
  outputTokens: 800,
  thoughtsTokens: 600,
};

export function estimateCost(
  calls: number,
  measured: TokenUsage | null,
  prices: Prices,
): CostEstimate {
  if (measured && measured.calls > 0) {
    const perCall = usageCostUsd(measured, prices) / measured.calls;
    return {
      calls,
      lowUsd: calls * perCall,
      highUsd: calls * perCall * RETRY_HEADROOM,
      basis: "measured",
    };
  }
  const guess = usageCostUsd({ calls: 1, ...ASSUMED_PER_CALL }, prices);
  return {
    calls,
    lowUsd: calls * guess,
    highUsd: calls * guess * 3,
    basis: "assumed",
  };
}
