import type { CctvCamera } from './types';

/**
 * National toll-road CCTV from the public BPJT page (`bpjt.pu.go.id/cctv`).
 *
 * The page ships its whole camera list as JSON inline: each record carries a
 * lat/lon and a direct `streamhls` playlist, no token. We read the page and
 * pull those records out. Jasa Marga cameras (`bujt: "jm"`) are skipped here
 * because the `jasamarga` region already owns them — including both would plot
 * every toll-gate twice (see the dedupe note in route.ts).
 *
 * This scrapes an HTML page, so it is deliberately defensive: a record that
 * does not parse, sits outside Indonesia, or has no HLS playlist is dropped,
 * and a layout change that yields zero records returns [] with a warning
 * rather than throwing.
 */

const PAGE = 'https://bpjt.pu.go.id/cctv/';

/** One JSON record, as embedded in the page. Only the fields we read are typed. */
type BpjtRecord = {
  unique_id?: unknown;
  id?: unknown;
  nama_km?: unknown;
  nama_ruas?: unknown;
  nama_segment?: unknown;
  bujt?: unknown;
  lat?: unknown;
  lon?: unknown;
  streamhls?: unknown;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function bpjtCamera(record: BpjtRecord): CctvCamera | null {
  if (text(record.bujt).toLowerCase() === 'jm') return null;

  const lat = Number(record.lat);
  const lng = Number(record.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  const stream = text(record.streamhls);
  if (!stream.includes('.m3u8')) return null;
  let url: URL;
  try {
    url = new URL(stream);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const id = text(record.unique_id) || text(record.id);
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(id)) return null;

  const name = text(record.nama_km) || text(record.nama_segment) || `CCTV Tol ${id}`;
  return {
    id: `bpjt-${id}`,
    lat,
    lng,
    name,
    city: text(record.nama_ruas) || 'Jalan tol',
    country: 'Indonesia',
    source: 'BPJT',
    stream_url: stream,
    stream_type: 'hls',
  };
}

/** Pull the inline camera records out of the BPJT page HTML. */
export function parseBpjt(html: string): CctvCamera[] {
  const cameras: CctvCamera[] = [];
  const seen = new Set<string>();
  // Each record is a minified JSON object from "id" through "updated_at".
  // JSON.parse handles the page's \/ escapes, so no unescaping is needed.
  for (const match of html.matchAll(/\{"id":"\d+".*?"updated_at":"[^"]*"\}/g)) {
    let record: BpjtRecord;
    try {
      record = JSON.parse(match[0]) as BpjtRecord;
    } catch {
      continue;
    }
    const camera = bpjtCamera(record);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  return cameras;
}

export async function fetchBpjtCameras(): Promise<CctvCamera[]> {
  try {
    const response = await fetch(PAGE, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`BPJT HTTP ${response.status}`);
    const cameras = parseBpjt(await response.text());
    if (!cameras.length) console.warn('[OSIRIS] BPJT CCTV: page returned no camera records (layout changed?)');
    return cameras;
  } catch (error) {
    console.warn('[OSIRIS] BPJT CCTV failed:', error instanceof Error ? error.message : error);
    return [];
  }
}
