import { NextResponse } from 'next/server';
import { GET as flightsFeed } from '../flights/route';
import { GET as satellitesFeed } from '../satellites/route';
import { GET as cctvFeed } from '../cctv/route';
import { GET as weatherFeed } from '../weather/route';
import { GET as gdeltFeed } from '../gdelt/route';

export const maxDuration = 60;

/**
 * OSIRIS — Global Stats API
 * Lightweight aggregation endpoint.
 * Calls the feed handlers in-process and returns ONLY the counts.
 *
 * ARCHITECTURE NOTE (10k+ Concurrent Users):
 * This endpoint ensures the Next.js server serves ~100 bytes instead of 10MB+
 * of raw GeoJSON mapping data when 10,000 users boot the dashboard simultaneously.
 * The underlying API routes utilize their own 45-60s TTL caching, meaning the
 * heavy external APIs (adsb.lol, USGS) are only hit once per minute, while this
 * lightweight stats route safely serves 10k concurrent users instantly.
 */

type Stats = { flights: number; sats: number; cctv: number; weather: number; incidents: number };
type Snapshot = { stats: Stats; timestamp: string; at: number };
const EMPTY: Stats = { flights: 0, sats: 0, cctv: 0, weather: 0, incidents: 0 };

/* One computation serves everyone. Each one pulls five of this app's own feeds —
   CCTV alone is ~14MB — and parses them only to count. Next's data cache
   refuses anything over 2MB, so those fetches are `no-store`. The snapshot
   below is the cache: at most one computation per TTL, concurrent callers
   share it, and a stale snapshot answers instantly while a fresh one is
   computed behind it. */
const TTL_MS = 30_000;
let snapshot: Snapshot | undefined;
let inflight: Promise<Snapshot> | undefined;

/** Test hook, mirroring clearMaritimeSnapshot. */
export function clearStatsSnapshot() {
  snapshot = undefined;
  inflight = undefined;
}

/* The feeds are called in-process. An HTTP call back to this server carried no
   session cookie, so the proxy answered 401 and every count read as zero. */
const withTimeout = (feed: () => Promise<Response>) =>
  Promise.race([
    feed(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('feed timeout')), 20_000)),
  ]);

/** Counts for the feeds that answered; a feed that failed is simply absent. */
async function computeStats(): Promise<Partial<Stats>> {
  const [flightsRes, satsRes, cctvRes, weatherRes, gdeltRes] = await Promise.allSettled([
    withTimeout(() => flightsFeed()),
    withTimeout(() => satellitesFeed()),
    withTimeout(() => cctvFeed(new Request('http://localhost/api/cctv'))),
    withTimeout(() => weatherFeed()),
    withTimeout(() => gdeltFeed()),
  ]);

  const fresh: Partial<Stats> = {};

  /* Parse each feed independently: a feed whose body is unexpectedly non-JSON
     only drops its own count instead of sinking the whole computation (which
     would pin every count stale for a TTL). */
  const count = async <K extends keyof Stats>(
    settled: PromiseSettledResult<Response>,
    key: K,
    of: (data: Record<string, { length?: number }[] | undefined>) => number,
  ) => {
    if (settled.status !== 'fulfilled' || !settled.value.ok) return;
    try {
      fresh[key] = of(await settled.value.json());
    } catch {
      /* leave this count absent; the snapshot keeps its last good value */
    }
  };

  await count(flightsRes, 'flights', d =>
    (d.commercial_flights?.length || 0) + (d.private_flights?.length || 0) +
    (d.private_jets?.length || 0) + (d.military_flights?.length || 0));
  await count(satsRes, 'sats', d => d.satellites?.length || 0);
  await count(cctvRes, 'cctv', d => d.cameras?.length || 0);
  await count(weatherRes, 'weather', d => d.events?.length || 0);
  await count(gdeltRes, 'incidents', d => d.events?.length || 0);

  // Every feed failed (down or unparseable): throw so the caller serves the last
  // good snapshot (or 500s cold) rather than caching an all-zero result as fresh.
  if (Object.keys(fresh).length === 0) throw new Error('all stats feeds failed');

  return fresh;
}

function refresh() {
  inflight ??= computeStats()
    .then(fresh => {
      /* A feed that failed keeps its last good count instead of dropping to
         zero, and a computation that reached nothing does not count as fresh.
         Caching is what makes this matter: without it, a transient failure
         showed zeros to one request; with it, the same failure would be
         pinned for a whole TTL. */
      const reached = Object.keys(fresh).length > 0;
      const next: Snapshot = {
        stats: { ...EMPTY, ...snapshot?.stats, ...fresh },
        timestamp: reached || !snapshot ? new Date().toISOString() : snapshot.timestamp,
        at: reached ? Date.now() : snapshot?.at ?? 0,
      };
      snapshot = next;
      return next;
    })
    .finally(() => { inflight = undefined; });
  return inflight;
}

function respond({ stats, timestamp }: Snapshot) {
  return NextResponse.json({ stats, timestamp }, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    }
  });
}

export async function GET() {
  if (snapshot && Date.now() - snapshot.at < TTL_MS) return respond(snapshot);

  const pending = refresh();
  // Stale beats slow: answer now, and let the refresh land for the next caller.
  if (snapshot) {
    pending.catch(error => console.error('Stats refresh failed:', error));
    return respond(snapshot);
  }

  try {
    return respond(await pending);
  } catch (error) {
    console.error('Stats aggregation failed:', error);
    return NextResponse.json({ error: 'Failed to compute stats' }, { status: 500 });
  }
}
