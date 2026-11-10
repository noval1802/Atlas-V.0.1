import type { CctvCamera } from './types';
import { safeFetch } from '@/lib/ssrf-guard';

/**
 * Kabupaten Jombang CCTV from "Jombang Smart Service" (`cctv.jombangkab.go.id/v2/`).
 *
 * The page has no JSON API; it ships `const cctvData = [...]` inline, one entry
 * per camera with lat/lng, a category and a ZoneMinder MJPEG URL
 * (`/zm/cgi-bin/nph-zms?monitor=N&token=…`). The token is the one the public
 * page itself hands every visitor. MJPEG plays in an <img>, so no CORS or proxy.
 *
 * The server omits its intermediate certificate, which Node cannot fill in by
 * itself; safeFetch's agent carries it (see lib/tls-intermediates.ts).
 */

const PAGE = 'https://cctv.jombangkab.go.id/v2/';
const STREAM_HOST = 'cctv.jombangkab.go.id';

type JombangRecord = { id?: unknown; nama?: unknown; lat?: unknown; lng?: unknown; url?: unknown; kategori?: unknown; status?: unknown };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

export function jombangCamera(record: JombangRecord): CctvCamera | null {
  if (text(record.status) !== 'online') return null;

  const lat = Number(record.lat);
  const lng = Number(record.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  let url: URL;
  try {
    url = new URL(text(record.url));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== STREAM_HOST) return null;
  if (url.pathname !== '/zm/cgi-bin/nph-zms' || !/^\d{1,6}$/.test(url.searchParams.get('monitor') ?? '')) return null;

  const id = text(record.id);
  if (!/^\d{1,8}$/.test(id)) return null;

  const category = text(record.kategori);
  const name = text(record.nama) || `CCTV Jombang ${id}`;
  return {
    id: `jombang-${id}`,
    lat,
    lng,
    name: category ? `${name} · ${category}` : name,
    city: 'Kabupaten Jombang',
    country: 'Indonesia',
    source: 'Jombang Smart Service',
    stream_url: url.toString(),
    stream_type: 'mjpeg',
  };
}

/** Pull the inline `cctvData` array out of the page. */
export function parseJombang(html: string): CctvCamera[] {
  const match = /const\s+cctvData\s*=\s*(\[[\s\S]*?\]);/.exec(html);
  if (!match) return [];
  let records: unknown;
  try {
    records = JSON.parse(match[1]);
  } catch {
    return [];
  }
  if (!Array.isArray(records)) return [];
  const seen = new Set<string>();
  const cameras: CctvCamera[] = [];
  for (const record of records) {
    const camera = jombangCamera(record as JombangRecord);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  return cameras;
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchJombangCameras(): Promise<CctvCamera[]> {
  const response = await safeFetch(PAGE, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Jombang HTTP ${response.status}`);
  const cameras = parseJombang(await response.text());
  if (!cameras.length) throw new Error('Jombang: page returned no online cameras (layout changed?)');
  return cameras;
}
