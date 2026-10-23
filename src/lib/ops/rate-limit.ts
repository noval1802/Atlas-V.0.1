type Bucket = number[];

const buckets = new Map<string, Bucket>();
/** Enough for every account plus a flood of junk keys; past it the oldest keys go, never the whole map. */
const MAX_KEYS = 50_000;

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean } {
  const recent = (buckets.get(key) ?? []).filter((hit) => now - hit < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return { ok: false };
  }
  recent.push(now);
  buckets.delete(key); // re-insert so Map order tracks the latest hit
  buckets.set(key, recent);
  for (const oldest of buckets.keys()) {
    if (buckets.size <= MAX_KEYS) break;
    buckets.delete(oldest);
  }
  return { ok: true };
}

export function resetRateLimits(): void {
  buckets.clear();
}
