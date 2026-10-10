export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export function createPacer(requestsPerMinute: number): () => Promise<void> {
  const interval = 60_000 / requestsPerMinute;
  let nextSlot = 0;
  return async () => {
    const now = Date.now();
    const start = Math.max(now, nextSlot);
    nextSlot = start + interval;
    if (start > now) await new Promise((r) => setTimeout(r, start - now));
  };
}
