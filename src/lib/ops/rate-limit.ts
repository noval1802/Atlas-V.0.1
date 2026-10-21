type Bucket = number[];

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean } {
  const recent = (buckets.get(key) ?? []).filter((hit) => now - hit < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return { ok: false };
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) buckets.clear();
  return { ok: true };
}

export function resetRateLimits(): void {
  buckets.clear();
}
