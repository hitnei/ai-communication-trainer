import { describe, expect, it } from "vitest";
import { emptyUsage, recordUsage, withUsageMeter } from "./usage";

describe("usage meter", () => {
  it("ignores usage recorded outside a meter", () => {
    expect(() => recordUsage({ promptTokens: 5 })).not.toThrow();
  });

  it("sums requests made inside the meter", async () => {
    const meter = emptyUsage();
    await withUsageMeter(meter, async () => {
      recordUsage({ promptTokens: 10, outputTokens: 5, thoughtsTokens: 20 });
      recordUsage({ promptTokens: 1 });
    });
    expect(meter).toEqual({ calls: 2, promptTokens: 11, outputTokens: 5, thoughtsTokens: 20 });
  });

  it("keeps concurrent meters isolated", async () => {
    const a = emptyUsage();
    const b = emptyUsage();
    await Promise.all([
      withUsageMeter(a, async () => {
        await new Promise((r) => setTimeout(r, 5));
        recordUsage({ promptTokens: 1 });
      }),
      withUsageMeter(b, async () => {
        recordUsage({ promptTokens: 100 });
      }),
    ]);
    expect(a.promptTokens).toBe(1);
    expect(b.promptTokens).toBe(100);
  });
});
