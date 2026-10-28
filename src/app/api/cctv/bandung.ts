import type { CctvCamera } from './types';

/**
 * Kota Bandung CCTV from the city's "Pelindung" API (Diskominfo Bandung).
 *
 * The API returns a flat JSON list with coordinates and a direct HLS playlist
 * per camera. Those playlists answer with a CORS header naming the city site,
 * not `*`, so the browser cannot read them cross-origin — each stream is served
 * through `/api/cctv/hls`, whose allowlist includes this host.
 */

const API = 'https://pelindung.bandung.go.id:8443/api/cek';

type PelindungRecord = {
  id?: unknown;
  cctv_name?: unknown;
  lat?: unknown;
  lng?: unknown;
  stream_cctv?: unknown;
  dinas?: unknown;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function bandungCamera(record: PelindungRecord): CctvCamera | null {
  const lat = Number(record.lat);
  const lng = Number(record.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  const stream = text(record.stream_cctv);
  if (!stream.includes('.m3u8')) return null;
  let url: URL;
  try {
    url = new URL(stream);
  } catch {
    return null;
  }
  if (url.hostname.toLowerCase() !== 'pelindung.bandung.go.id') return null;

  const id = text(record.id);
  if (!/^[A-Za-z0-9._-]{4,80}$/.test(id)) return null;

  const agency = text(record.dinas);
  const name = text(record.cctv_name) || `CCTV Bandung ${id}`;
  return {
    id: `bandung-${id}`,
    lat,
    lng,
    name: agency ? `${name} · ${agency}` : name,
    city: 'Kota Bandung',
    country: 'Indonesia',
    source: 'Pelindung Bandung',
    stream_url: `/api/cctv/hls?u=${encodeURIComponent(url.toString())}`,
    stream_type: 'hls',
  };
}

export async function fetchBandungCameras(): Promise<CctvCamera[]> {
  try {
    const response = await fetch(API, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Bandung HTTP ${response.status}`);
    const body = await response.json() as unknown;
    if (!Array.isArray(body)) throw new Error('Bandung: unexpected payload');
    const seen = new Set<string>();
    const cameras: CctvCamera[] = [];
    for (const record of body) {
      const camera = bandungCamera(record as PelindungRecord);
      if (camera && !seen.has(camera.id)) {
        seen.add(camera.id);
        cameras.push(camera);
      }
    }
    return cameras;
  } catch (error) {
    console.warn('[OSIRIS] Bandung CCTV failed:', error instanceof Error ? error.message : error);
    return [];
  }
}
