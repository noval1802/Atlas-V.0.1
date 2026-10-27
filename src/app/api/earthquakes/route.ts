import { NextResponse } from 'next/server';
import { BMKG_HEADERS, BMKG_QUAKE_URLS, mergeQuakes, parseBmkgQuakes } from '@/lib/bmkg';
import { cachedSource } from '@/lib/sourceCache';

/**
 * ATLAS — Earthquake Data API
 * BMKG InaTEWS: the latest M5+ list and the felt list, merged.
 * Indonesia and its surroundings only; this replaced the global USGS feed.
 */

const loadQuakes = cachedSource('earthquakes:bmkg', async () => {
  const results = await Promise.allSettled(BMKG_QUAKE_URLS.map(async url => {
    const res = await fetch(url, { headers: BMKG_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`BMKG ${res.status}`);
    return parseBmkgQuakes(await res.json());
  }));
  const lists = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
  // Throwing keeps the last good list in the cache instead of an empty map.
  if (!lists.length) throw new Error('BMKG unavailable');
  return mergeQuakes(lists);
}, 60_000);

export async function GET() {
  try {
    const earthquakes = await loadQuakes();
    return NextResponse.json({
      earthquakes,
      total: earthquakes.length,
      source: 'BMKG',
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Earthquake fetch error:', error);
    return NextResponse.json({ earthquakes: [], error: 'BMKG unavailable' }, { status: 502 });
  }
}
