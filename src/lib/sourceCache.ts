/**
 * OSIRIS — upstream source cache.
 *
 * Camera *indexes* (where the cameras are) change on the order of weeks, while
 * the frames themselves are pulled live by the client straight from the source.
 * Re-downloading a 500 KB index on every request is pure waste — and some of
 * these upstreams are slow enough to dominate the response (MDOT ~7s, NZTA ~8s),
 * so an uncached `region=all` took ~15s every single time.
 *
 * Three behaviours matter here:
 *   • TTL        — serve from memory until the index is plausibly stale.
 *   • dedup      — concurrent misses share one upstream request instead of
 *                  stampeding it (a `region=all` fan-out hits every source at once).
 *   • stale-on-error — if the upstream fails, keep serving the last good index
 *                  rather than dropping the layer to zero cameras.
 */

interface Entry<T> {
  data: T[];
  expiresAt: number;
  inflight: Promise<T[]> | null;
  /** The last fetch threw and there was nothing cached to fall back on. */
  failed?: boolean;
}

const store = new Map<string, Entry<unknown>>();
/** Bumped by forgetSource so an in-flight fetch cannot write the old list back. */
const generation = new Map<string, number>();

export const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Cap on distinct keys. Camera sources are a fixed handful, but callers with
 * per-coordinate keys (place lookups) would otherwise grow this map without
 * bound. Map preserves insertion order and `put` re-inserts on every read and
 * write, so the least recently used keys evict first. Plain insertion order
 * evicted the camera indexes (created at boot) before a burst of searches.
 */
const MAX_ENTRIES = 500;

function put(key: string, entry: Entry<unknown>): void {
  store.delete(key);
  store.set(key, entry);
}

function evictIfNeeded(): void {
  if (store.size <= MAX_ENTRIES) return;
  for (const key of store.keys()) {
    if (store.size <= MAX_ENTRIES) break;
    const entry = store.get(key);
    if (entry?.inflight) continue; // never drop a request in progress
    store.delete(key);
  }
}

/**
 * Wrap a camera fetcher with TTL caching, in-flight dedup and stale fallback.
 * Returns a drop-in replacement with the same signature.
 *
 * `throwOnFailure`: when the upstream fails and nothing is cached, throw (also
 * during the cooldown) instead of returning []. Routes whose empty list reads
 * as "nothing is happening" use it so they can answer 502.
 */
export function cachedSource<T>(
  key: string,
  fetcher: () => Promise<T[]>,
  ttlMs: number = DEFAULT_TTL_MS,
  rememberEmpty = true,
  { throwOnFailure = false }: { throwOnFailure?: boolean } = {},
): () => Promise<T[]> {
  return async () => {
    const now = Date.now();
    const entry = store.get(key) as Entry<T> | undefined;
    const seen = generation.get(key) ?? 0;
    const current = () => (generation.get(key) ?? 0) === seen;

    if (entry) put(key, entry as Entry<unknown>);
    if (entry && now < entry.expiresAt && entry.data.length > 0) return entry.data;
    if (entry?.inflight) return entry.inflight;
    /* A first fetch that failed stored an empty list with a short expiry.
       Returning it here is the cooldown. Without it, data.length === 0 made
       every page view look like a miss and the dead upstream was hit again. */
    if (entry && entry.data.length === 0 && now < entry.expiresAt) {
      if (entry.failed && throwOnFailure) throw new Error(`${key} unavailable`);
      return entry.data;
    }

    const inflight = (async () => {
      try {
        const data = await fetcher();
        if (!current()) return data;
        // An empty result is treated as a failed refresh: keep whatever we had.
        if (data.length === 0 && entry?.data.length) {
          put(key, { data: entry.data, expiresAt: now + ttlMs, inflight: null });
          return entry.data;
        }
        // A place lookup uses this to mean "ask again". An empty camera index
        // gets the same 60s cooldown as a failure: many fetchers return [] on
        // error, and a full TTL pinned that outage for 30 minutes.
        if (data.length === 0 && !rememberEmpty) {
          put(key, { data: [], expiresAt: 0, inflight: null });
          return data;
        }
        put(key, { data, expiresAt: now + (data.length ? ttlMs : Math.min(ttlMs, 60_000)), inflight: null });
        return data;
      } catch (e) {
        if (!current()) return [];
        if (entry?.data.length) {
          console.warn(`[OSIRIS] ${key} refresh failed — serving ${entry.data.length} cached cameras`);
          // Retry sooner than a full TTL, but don't hammer the failing upstream.
          put(key, { data: entry.data, expiresAt: now + 60_000, inflight: null });
          return entry.data;
        }
        const detail = e instanceof Error ? e.message : String(e);
        console.warn(`[OSIRIS] ${key} fetch failed with no cache to fall back on: ${detail}`);
        put(key, {
          data: [],
          expiresAt: rememberEmpty ? now + 60_000 : 0,
          inflight: null,
          failed: true,
        });
        if (throwOnFailure) throw e;
        return [];
      }
    })();

    put(key, {
      data: entry?.data ?? [],
      expiresAt: entry?.expiresAt ?? 0,
      inflight,
    } as Entry<unknown>);
    evictIfNeeded();

    return inflight;
  };
}

/**
 * Read a source without triggering a fetch.
 *
 * The catalogue route uses this to answer from what it already has and to
 * queue only the regions it is actually missing — otherwise every request
 * enqueues all 48 regions into the pool, and a warm catalogue still pays for a
 * queue it does not need.
 */
export function peekSource<T>(key: string, allowStale = false): T[] | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry || entry.data.length === 0) return undefined;
  put(key, entry as Entry<unknown>);
  if (allowStale || Date.now() < entry.expiresAt) return entry.data;
  return undefined;
}

/** Is what peekSource would return past its TTL? */
export function isStale(key: string): boolean {
  const entry = store.get(key);
  return !entry || Date.now() >= entry.expiresAt;
}

/**
 * Install data the process did not fetch — a catalogue restored from disk.
 * Serving that at boot is the difference between a map that is populated on the
 * first request and one that waits on forty-eight upstreams to answer.
 */
export function seedSource<T>(key: string, data: T[], ttlMs: number = DEFAULT_TTL_MS): void {
  if (!data.length) return;
  const entry = store.get(key);
  if (entry?.inflight) return; // a live fetch already supersedes the snapshot
  put(key, { data, expiresAt: Date.now() + ttlMs, inflight: null } as Entry<unknown>);
  evictIfNeeded();
}

/** Drop one index so the next read fetches it again. */
export function forgetSource(key: string): void {
  generation.set(key, (generation.get(key) ?? 0) + 1);
  store.delete(key);
}

/** Test seam — drops all cached indexes. */
export function clearSourceCache(): void {
  store.clear();
  generation.clear();
}
