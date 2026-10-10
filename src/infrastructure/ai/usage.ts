import { AsyncLocalStorage } from "node:async_hooks";
import type { TokenUsage } from "@/domain/eval/types";

const store = new AsyncLocalStorage<TokenUsage>();

export function emptyUsage(): TokenUsage {
  return { calls: 0, promptTokens: 0, outputTokens: 0, thoughtsTokens: 0 };
}

/** Adds every request made inside `fn` to `meter`, isolated per async context. */
export function withUsageMeter<T>(meter: TokenUsage, fn: () => Promise<T>): Promise<T> {
  return store.run(meter, fn);
}

export interface UsageSample {
  promptTokens?: number;
  outputTokens?: number;
  thoughtsTokens?: number;
}

export function recordUsage(sample: UsageSample): void {
  const meter = store.getStore();
  if (!meter) return;
  meter.calls += 1;
  meter.promptTokens += sample.promptTokens ?? 0;
  meter.outputTokens += sample.outputTokens ?? 0;
  meter.thoughtsTokens += sample.thoughtsTokens ?? 0;
}
