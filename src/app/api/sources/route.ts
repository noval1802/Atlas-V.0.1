import { NextResponse } from 'next/server';
import { CAMERA_REGIONS } from '@/lib/camera-catalog';
import { loadVolcanoes } from '@/lib/magma';
import { sourceHealth } from '@/lib/sourceCache';
import { classify, type SourceStatus } from '@/lib/source-status';
import { loadQuakes } from '../earthquakes/route';
import { loadEvents } from '../weather/route';
import { aisStatus } from '../maritime/route';

export const dynamic = 'force-dynamic';

const MIN = 60_000;
const AIS_STALE_MS = 5 * MIN;

/* The cheap operational feeds are loaded here so their status is real even when
   their layer is off; the call is a cache read except once per TTL. Fires (a
   large global download), CCTV and AIS are only read, never started. */
const WARM = [loadQuakes, loadEvents, loadVolcanoes];

const CACHED: { id: string; label: string; source: string; key: string; staleAfterMs: number }[] = [
  { id: 'gempa', label: 'Gempa', source: 'BMKG', key: 'earthquakes:bmkg', staleAfterMs: 10 * MIN },
  { id: 'cuaca', label: 'Cuaca', source: 'BMKG · NASA · GDACS', key: 'weather:events', staleAfterMs: 15 * MIN },
  { id: 'gunung-api', label: 'Gunung Api', source: 'MAGMA (PVMBG)', key: 'volcanoes:magma', staleAfterMs: 30 * MIN },
  { id: 'titik-api', label: 'Titik Api', source: 'NASA FIRMS', key: 'fires', staleAfterMs: 30 * MIN },
];

const orNull = (n: number | undefined) => n ?? null;

function cctvStatus(): SourceStatus {
  const regions = CAMERA_REGIONS.map(region => ({ region, health: sourceHealth(`cctv:${region}`) }));
  const live = regions.filter(r => r.health && r.health.count > 0);
  const down = regions.filter(r => r.health?.failedAt).map(r => r.region);
  const fetched = live.map(r => r.health!.fetchedAt).filter((t): t is number => t !== undefined);
  return {
    id: 'cctv',
    label: 'CCTV',
    source: `${live.length} dari ${CAMERA_REGIONS.length} wilayah`,
    badge: `${live.length}/${CAMERA_REGIONS.length}`,
    // A camera index changes over weeks, so its age is not the signal; regions that stopped answering are.
    state: live.length === 0 ? (down.length ? 'gagal' : 'nonaktif') : down.length ? 'lambat' : 'ok',
    fetchedAt: fetched.length ? Math.max(...fetched) : null,
    failingSince: null,
    count: live.reduce((sum, r) => sum + r.health!.count, 0),
    ...(down.length ? { note: `Gagal diperbarui: ${down.join(', ')}` } : {}),
  };
}

function shipStatus(now: number): SourceStatus {
  const ais = aisStatus();
  const base = { id: 'ais', label: 'Kapal', source: 'AIS', failingSince: null, count: ais.ships };
  if (!ais.configured) return { ...base, state: 'nonaktif', fetchedAt: null, note: 'Kunci AIS belum diisi di server' };
  if (ais.lastMessageAt === undefined) return { ...base, state: 'nonaktif', fetchedAt: null, note: 'Aktif setelah layer maritim dibuka' };
  return { ...base, state: now - ais.lastMessageAt > AIS_STALE_MS ? 'lambat' : 'ok', fetchedAt: ais.lastMessageAt };
}

export async function GET() {
  // Bounded: a slow upstream must not hold the status bar hostage.
  await Promise.race([
    Promise.allSettled(WARM.map(load => load())),
    new Promise(resolve => setTimeout(resolve, 8_000)),
  ]);
  const now = Date.now();
  const sources: SourceStatus[] = [
    ...CACHED.map(({ key, staleAfterMs, ...meta }) => {
      const health = sourceHealth(key);
      return {
        ...meta,
        state: classify(health, staleAfterMs, now),
        fetchedAt: orNull(health?.fetchedAt),
        failingSince: orNull(health?.failedAt),
        count: health?.count ?? 0,
      };
    }),
    cctvStatus(),
    shipStatus(now),
  ];
  return NextResponse.json({ now, sources }, { headers: { 'Cache-Control': 'no-store' } });
}
