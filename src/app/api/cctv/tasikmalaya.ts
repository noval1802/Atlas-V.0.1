import type { CctvCamera } from './types';

/**
 * Kota Tasikmalaya ATCS from `atcs.tasikmalayakota.go.id`.
 *
 * The home page ships `var cctv = { "<id>": { id, nama, jenis, link, lokasi_lat,
 * lokasi_lng } }` inline, where `link` is a direct HLS playlist on the same host
 * that answers with `Access-Control-Allow-Origin: *`, so the browser plays it
 * straight — no proxy.
 */

const PAGE = 'https://atcs.tasikmalayakota.go.id/';
const STREAM_HOST = 'atcs.tasikmalayakota.go.id';

type TasikRecord = { id?: unknown; nama?: unknown; jenis?: unknown; link?: unknown; lokasi_lat?: unknown; lokasi_lng?: unknown };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

export function tasikmalayaCamera(record: TasikRecord): CctvCamera | null {
  const id = text(record.id);
  if (!/^\d{1,8}$/.test(id)) return null;

  const lat = Number(text(record.lokasi_lat));
  const lng = Number(text(record.lokasi_lng));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  let url: URL;
  try {
    url = new URL(text(record.link));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== STREAM_HOST || !url.pathname.endsWith('.m3u8')) return null;

  const jenis = text(record.jenis);
  const name = text(record.nama) || `CCTV Tasikmalaya ${id}`;
  return {
    id: `tasikmalaya-${id}`,
    lat,
    lng,
    name: jenis ? `${name} (${jenis})` : name,
    city: 'Kota Tasikmalaya',
    country: 'Indonesia',
    source: 'ATCS Kota Tasikmalaya',
    stream_url: url.toString(),
    stream_type: 'hls',
  };
}

/** Pull the inline `cctv` object out of the page. */
export function parseTasikmalaya(html: string): CctvCamera[] {
  const match = /(?:var|let|const)\s+cctv\s*=\s*(\{[\s\S]*?\})\s*;/.exec(html);
  if (!match) return [];
  let records: Record<string, TasikRecord>;
  try {
    records = JSON.parse(match[1]);
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const cameras: CctvCamera[] = [];
  for (const record of Object.values(records)) {
    const camera = tasikmalayaCamera(record);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  return cameras;
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchTasikmalayaCameras(): Promise<CctvCamera[]> {
  const response = await fetch(PAGE, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Tasikmalaya HTTP ${response.status}`);
  const cameras = parseTasikmalaya(await response.text());
  if (!cameras.length) throw new Error('Tasikmalaya: page returned no cameras (layout changed?)');
  return cameras;
}
