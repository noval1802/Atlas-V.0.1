import type { CctvCamera } from './types';

/**
 * Provinsi Bali CCTV from Satu Data Bali `balisatudata.baliprov.go.id/api/v1/report-cctv`.
 *
 * `data` maps a cctv id to `{ cctv_id, lat, lng, ch_id, ch_name, streaming_url }`.
 * `streaming_url` is an embed player page; the HLS it plays is
 * `https://transcode.baliprov.go.id/cctv/<ch_id>/index.m3u8`, served with
 * `Access-Control-Allow-Origin: *`, so the browser plays it straight — no proxy.
 */

const API = 'https://balisatudata.baliprov.go.id/api/v1/report-cctv';
const MEDIA_HOST = 'transcode.baliprov.go.id';

type BaliRecord = { cctv_id?: unknown; lat?: unknown; lng?: unknown; ch_id?: unknown; ch_name?: unknown };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

export function baliCamera(record: BaliRecord): CctvCamera | null {
  const slug = text(record.ch_id);
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;

  const lat = Number(record.lat);
  const lng = Number(record.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  const id = text(record.cctv_id) || slug;
  const name = text(record.ch_name) || slug;
  return {
    id: `bali-${id}`,
    lat,
    lng,
    name,
    city: 'Provinsi Bali',
    country: 'Indonesia',
    source: 'Satu Data Bali',
    stream_url: `https://${MEDIA_HOST}/cctv/${slug}/index.m3u8`,
    stream_type: 'hls',
  };
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchBaliCameras(): Promise<CctvCamera[]> {
  const response = await fetch(API, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Bali HTTP ${response.status}`);
  const body = await response.json() as { data?: unknown };
  const data = body?.data && typeof body.data === 'object' ? Object.values(body.data as Record<string, BaliRecord>) : [];
  if (!data.length) throw new Error('Bali: unexpected payload');
  const seen = new Set<string>();
  const cameras: CctvCamera[] = [];
  for (const record of data) {
    const camera = baliCamera(record);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  if (!cameras.length) throw new Error('Bali: no usable cameras in payload');
  return cameras;
}
