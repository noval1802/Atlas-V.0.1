
import { NextResponse } from 'next/server';
import type { FireRow } from '@/lib/map-data';
import { cachedSource } from '@/lib/sourceCache';

interface FirePoint extends FireRow {
  confidence?: string;
  date?: string;
  time?: string;
  frp?: number;
  title?: string;
  type?: string;
}

interface EonetEvent {
  title?: string;
  geometry?: { coordinates?: number[]; date?: string }[];
}

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Active Fire & Wildfire Tracking
 * Multi-source: NASA FIRMS Open Data (primary for global fires), NASA EONET (volcanoes)
 *
 * The FIRMS CSV is tens of MB, so the merged list is cached for 10 minutes
 * (FIRMS itself updates about every 3 hours) instead of downloaded per request.
 */
let lastSource = '';

const loadFires = cachedSource<FirePoint>('fires', async () => {
  let fires: FirePoint[] = [];
  let source = '';

  // Source 1: NASA FIRMS Open Data (Global 24h CSV) - no API key needed
  const firmsSources = [
    'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv',
    'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv'
  ];

  for (const url of firmsSources) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'OSIRIS-Intelligence-Platform/3.5' },
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes('latitude') && text.length > 200) {
          const parsed = parseCSV(text);
          if (parsed.length > 0) {
            fires = parsed;
            source = url.includes('SUOMI') ? 'NASA-FIRMS (VIIRS)' : 'NASA-FIRMS (MODIS)';
            break;
          }
        }
      }
    } catch { continue; }
  }

  // Source 2: Pull volcanoes from EONET for richer data
  try {
    const volcRes = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=volcanoes&limit=50', {
      signal: AbortSignal.timeout(10000),
    });
    if (volcRes.ok) {
      const volcData = await volcRes.json() as { events?: EonetEvent[] };
      const volcanoes = (volcData.events || []).map((e): FirePoint | null => {
        const geo = e.geometry?.[e.geometry.length - 1];
        if (!geo?.coordinates) return null;
        return {
          lat: geo.coordinates[1],
          lng: geo.coordinates[0],
          brightness: 500,
          confidence: 'high',
          date: geo.date?.split('T')[0] || '',
          time: '',
          frp: 100,
          title: `[VOLCANO] ${e.title}`,
          type: 'volcano',
        };
      }).filter((v): v is FirePoint => v !== null);
      fires = [...fires, ...volcanoes];
      if (!source) source = 'NASA-EONET';
    }
  } catch (e) { console.warn('[OSIRIS] Suppressed EONET error:', e instanceof Error ? e.message : e); }

  // Nothing answered: throw so the cache keeps the last good list and the route answers 502.
  if (!fires.length) throw new Error('no fire provider answered');
  lastSource = source;
  return fires;
}, 10 * 60_000, true, { throwOnFailure: true });

export async function GET() {
  try {
    const fires = await loadFires();
    return NextResponse.json({
      fires,
      total: fires.length,
      source: lastSource || 'Unknown',
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error('Fire fetch error:', error);
    return NextResponse.json({ fires: [], error: 'Failed to fetch fire data' }, { status: 502 });
  }
}

/** Same box the Jasa Marga layer uses for Indonesia. */
const inIndonesia = (lat: number, lng: number) => lat >= -12 && lat <= 7 && lng >= 94 && lng <= 142;
/** Points kept inside Indonesia before sampling there too; a bad haze day can exceed it. */
const MAX_INDONESIA = 8000;
/** Points kept for the rest of the world, to avoid browser lag. */
const MAX_WORLD = 2000;

const sample = <T,>(rows: T[], max: number) => {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  return Array.from({ length: max }, (_, i) => rows[Math.floor(i * step)]);
};

export function parseCSV(csv: string): FirePoint[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',');
  const latIdx = header.indexOf('latitude');
  const lngIdx = header.indexOf('longitude');
  const brightIdx = header.indexOf('bright_ti4') !== -1 ? header.indexOf('bright_ti4') : header.indexOf('brightness');
  const confIdx = header.indexOf('confidence');
  const dateIdx = header.indexOf('acq_date');
  const timeIdx = header.indexOf('acq_time');
  const frpIdx = header.indexOf('frp');

  /* Every hotspot inside Indonesia is kept; only the rest of the world is
     sampled. Sampling the global file evenly kept about 1 in 100 rows, so
     3,000 hotspots in Kalimantan showed up as about 30. */
  const local: FirePoint[] = [];
  const world: FirePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const lat = parseFloat(cols[latIdx]);
    const lng = parseFloat(cols[lngIdx]);
    if (isNaN(lat) || isNaN(lng)) continue;

    (inIndonesia(lat, lng) ? local : world).push({
      lat: Math.round(lat * 1000) / 1000,
      lng: Math.round(lng * 1000) / 1000,
      brightness: parseFloat(cols[brightIdx]) || 0,
      confidence: cols[confIdx] || 'unknown',
      date: cols[dateIdx] || '',
      time: cols[timeIdx] || '',
      frp: parseFloat(cols[frpIdx]) || 0,
      type: 'fire'
    });
  }

  return [...sample(local, MAX_INDONESIA), ...sample(world, MAX_WORLD)];
}

