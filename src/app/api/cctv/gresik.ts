import type { CctvCamera } from './types';

/**
 * Kabupaten Gresik CCTV from the regency's public "CCTV Kanjeng" API.
 *
 * The flat `/api/v1/public/cctv` list carries coordinates and a relative HLS
 * path per camera. Both the playlist and its segments answer with
 * `Access-Control-Allow-Origin: *`, so the browser plays them straight from
 * the origin — no proxy, unlike Kota Bandung.
 */

const ORIGIN = 'https://cctvkanjeng.gresikkab.go.id';
const API = `${ORIGIN}/api/v1/public/cctv`;

type GresikRecord = {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  hls_url?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  location_name?: unknown;
  address?: unknown;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function gresikCamera(record: GresikRecord): CctvCamera | null {
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  const path = text(record.hls_url);
  if (!path.startsWith('/') || !path.includes('.m3u8')) return null;

  const id = text(record.id);
  if (!/^[A-Za-z0-9._-]{4,80}$/.test(id)) return null;

  const name = text(record.name) || `CCTV Gresik ${id}`;
  return {
    id: `gresik-${id}`,
    lat,
    lng,
    name,
    city: 'Kabupaten Gresik',
    country: 'Indonesia',
    source: 'CCTV Kanjeng Gresik',
    stream_url: `${ORIGIN}${path}`,
    stream_type: 'hls',
  };
}

export async function fetchGresikCameras(): Promise<CctvCamera[]> {
  try {
    const response = await fetch(API, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Gresik HTTP ${response.status}`);
    const body = await response.json() as { items?: unknown };
    const items = Array.isArray(body.items) ? body.items : [];
    const seen = new Set<string>();
    const cameras: CctvCamera[] = [];
    for (const record of items) {
      const camera = gresikCamera(record as GresikRecord);
      if (camera && !seen.has(camera.id)) {
        seen.add(camera.id);
        cameras.push(camera);
      }
    }
    return cameras;
  } catch (error) {
    console.warn('[OSIRIS] Gresik CCTV failed:', error instanceof Error ? error.message : error);
    return [];
  }
}
