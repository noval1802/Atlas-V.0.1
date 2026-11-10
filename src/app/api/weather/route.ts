import { NextResponse } from 'next/server';
import { stealthFetch } from '@/lib/stealthFetch';
import { cachedSource } from '@/lib/sourceCache';
import { BMKG_HEADERS, BMKG_WARNING_URL, parseNowcastCap, parseWarningList } from '@/lib/bmkg';

/**
 * ATLAS — Severe Weather & Anomalies API
 * BMKG Peringatan Dini Cuaca (nowcast CAP) for Indonesia, plus NASA EONET
 * (storms/volcanoes) and GDACS (cyclones/floods/droughts) for the region around it.
 */

type Severity = 'low' | 'medium' | 'high';

type WeatherEvent = {
  id: string;
  title: string;
  category: string;
  type: string;
  icon: string;
  severity: Severity;
  lat: number;
  lng: number;
  date?: string;
  expires?: string;
  area?: string;
  description?: string;
  infographic?: string;
  source: string;
  provider: 'NASA EONET' | 'BMKG' | 'GDACS';
};

type EonetEvent = {
  id: string;
  title: string;
  categories?: {
    id?: string;
    title?: string;
  }[];
  geometry?: {
    type?: string;
    coordinates?: number[];
    date?: string;
  }[];
  sources?: {
    url?: string;
  }[];
};

type EonetResponse = {
  events?: EonetEvent[];
};

// GDACS event types we surface here. EQ (earthquakes) and WF (wildfires) are already
// covered by the dedicated /api/earthquakes (BMKG) and /api/fires (FIRMS) routes.
const GDACS_TYPE_MAP: Record<string, { type: string; icon: string }> = {
  TC: { type: 'Tropical Cyclone', icon: 'cyclone' },
  FL: { type: 'Flood', icon: 'flood' },
  DR: { type: 'Drought', icon: 'drought' },
};

function getGdacsTag(itemXml: string, tag: string): string {
  const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return (m?.[1] || '').trim();
}

function normalizeGdacsSeverity(alertLevel: string): Severity {
  switch (alertLevel.toLowerCase()) {
    case 'red': return 'high';
    case 'orange': return 'medium';
    default: return 'low';
  }
}

function parseGdacsRss(xml: string): WeatherEvent[] {
  const events: WeatherEvent[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const eventType = getGdacsTag(itemXml, 'gdacs:eventtype');
    const mapped = GDACS_TYPE_MAP[eventType];
    if (!mapped) continue;

    const latMatch = itemXml.match(/<geo:lat>([-\d.]+)<\/geo:lat>/i);
    const lonMatch = itemXml.match(/<geo:long>([-\d.]+)<\/geo:long>/i);
    if (!latMatch || !lonMatch) continue;

    const eventId = getGdacsTag(itemXml, 'gdacs:eventid');
    const episodeId = getGdacsTag(itemXml, 'gdacs:episodeid');
    const title = getGdacsTag(itemXml, 'title').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<');
    const country = getGdacsTag(itemXml, 'gdacs:country');
    const alertLevel = getGdacsTag(itemXml, 'gdacs:alertlevel');
    const link = getGdacsTag(itemXml, 'link').replace(/&amp;/g, '&');

    events.push({
      id: `gdacs-${eventType}-${eventId}-${episodeId}`,
      title,
      category: 'gdacs',
      type: mapped.type,
      icon: mapped.icon,
      severity: normalizeGdacsSeverity(alertLevel),
      lat: parseFloat(latMatch[1]),
      lng: parseFloat(lonMatch[1]),
      date: getGdacsTag(itemXml, 'pubDate'),
      area: country || undefined,
      source: link || 'https://www.gdacs.org/',
      provider: 'GDACS',
    });
  }

  return events;
}

/**
 * One read per window, however many readers.
 *
 * Live Alerts lists these warnings, so every open dashboard now asks for them
 * every five minutes — without this, each of those asks would be three more
 * requests to NASA, BMKG and GDACS. The cache also
 * keeps the last good list when a provider has a bad minute, which matters
 * more here than anywhere else in the app: an empty warnings panel reads as
 * "nothing is happening", and that is not the same as "we could not ask".
 */
const loadEvents = cachedSource<WeatherEvent>('weather:events', collectEvents, 3 * 60_000, true, { throwOnFailure: true });

export async function GET() {
  try {
    const events = await loadEvents();
    return NextResponse.json({
      events,
      total: events.length,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({ events: [], error: 'Failed to fetch weather data' }, { status: 502 });
  }
}

/* BMKG warnings from the last good answer. If BMKG fails while NASA or GDACS
   answer, the list still counts as fresh, so without this the Indonesian
   warnings vanished from the panel with no sign anything was wrong. */
let lastBmkg: WeatherEvent[] = [];

async function collectEvents(): Promise<WeatherEvent[]> {
  {
    const [eonetRes, bmkgRes, gdacsRes] = await Promise.allSettled([
      stealthFetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100', {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(BMKG_WARNING_URL, { headers: BMKG_HEADERS, signal: AbortSignal.timeout(10000) }),
      stealthFetch('https://www.gdacs.org/xml/rss.xml', {
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    const events: WeatherEvent[] = [];
    let providerSucceeded = false;
    let bmkgOk = false;

    if (eonetRes.status === 'fulfilled' && eonetRes.value.ok) {
      try {
        const data = (await eonetRes.value.json()) as EonetResponse;
        providerSucceeded = true;

        for (const event of data.events || []) {
          const geom = event.geometry && event.geometry.length > 0 ? event.geometry[event.geometry.length - 1] : null;
          if (!geom || geom.type !== 'Point' || !geom.coordinates) continue;

          const category = event.categories?.[0]?.id || 'unknown';

          // We already track wildfires via FIRMS, so we skip EONET wildfires
          if (category === 'wildfires') continue;

          let typeLabel = 'Event';
          let icon = 'alert';
          let severity: Severity = 'low';

          if (category === 'severeStorms') {
            typeLabel = 'Severe Storm';
            icon = 'cyclone';
            severity = 'high';
          } else if (category === 'volcanoes') {
            typeLabel = 'Volcano Eruption';
            icon = 'volcano';
            severity = 'high';
          } else if (category === 'seaIce') {
            typeLabel = 'Iceberg / Sea Ice';
            icon = 'ice';
            severity = 'medium';
          } else if (category === 'earthquakes') {
            continue;
          } else {
            typeLabel = event.categories?.[0]?.title || 'Anomaly';
          }

          events.push({
            id: `eonet-${event.id}`,
            title: event.title,
            category,
            type: typeLabel,
            icon,
            severity,
            lat: geom.coordinates[1],
            lng: geom.coordinates[0],
            date: geom.date,
            source: event.sources?.[0]?.url || 'NASA EONET',
            provider: 'NASA EONET',
          });
        }
      } catch (error) {
        console.error('NASA EONET normalization error:', error);
      }
    }

    if (bmkgRes.status === 'fulfilled' && bmkgRes.value.ok) {
      try {
        // The bulletin list carries no coordinates; each CAP file has the warning polygon.
        const bulletins = parseWarningList(await bmkgRes.value.json()).slice(0, 60);
        const caps = await Promise.allSettled(bulletins.map(async bulletin => {
          const res = await fetch(bulletin.capUrl, { headers: BMKG_HEADERS, signal: AbortSignal.timeout(10000) });
          return { bulletin, alert: res.ok ? parseNowcastCap(await res.text()) : null };
        }));
        for (const cap of caps) {
          if (cap.status !== 'fulfilled' || !cap.value.alert) continue;
          const a = cap.value.alert;
          bmkgOk = true;
          providerSucceeded = true;
          events.push({
            id: a.id,
            title: a.headline,
            category: 'weatherAlerts',
            type: a.event,
            icon: 'weather',
            severity: a.severity,
            lat: a.lat,
            lng: a.lng,
            date: a.effective,
            expires: a.expires,
            area: a.area,
            description: cap.value.bulletin.description,
            infographic: cap.value.bulletin.infographic,
            source: cap.value.bulletin.capUrl,
            provider: 'BMKG',
          });
        }
      } catch (error) {
        console.error('BMKG nowcast normalization error:', error);
      }
    }

    if (bmkgOk) lastBmkg = events.filter(event => event.provider === 'BMKG');
    // Fallback only serves warnings still within their stated validity; a
    // no-expiry entry is dropped rather than shown as current forever.
    else events.push(...lastBmkg.filter(event => event.expires && Date.parse(event.expires) > Date.now()));

    if (gdacsRes.status === 'fulfilled' && gdacsRes.value.ok) {
      try {
        const xml = await gdacsRes.value.text();
        events.push(...parseGdacsRss(xml));
        providerSucceeded = true;
      } catch (error) {
        console.error('GDACS normalization error:', error);
      }
    }

    /* Every provider failed: throw rather than return nothing, so the cache
       serves the last good warnings instead of an empty panel. */
    if (!providerSucceeded) throw new Error('no weather provider answered');

    // A provider can list the same alert twice; the panel keys rows by id, so keep the first of each.
    const seen = new Set<string>();
    return events.filter((event) => !seen.has(event.id) && Boolean(seen.add(event.id)));
  }
}
