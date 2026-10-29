import type { CctvCamera } from './types';

/**
 * Kota Banda Aceh CCTV from the city's public camera API (Diskominfotik).
 *
 * Each record's `url` is a datarhei Restreamer embed page,
 * `<base>/<uuid>.html`, whose player streams `<base>/memfs/<uuid>.m3u8`. That
 * playlist and its segments answer with `Access-Control-Allow-Origin: *`
 * (session tokens are minted server-side per fetch), so the browser plays them
 * straight from the origin — no proxy. Offline cameras are skipped.
 */

const API = 'https://cctv.bandaacehkota.go.id/api/cameras';
const ALLOWED_HOSTS = new Set(['api.bandaacehkota.go.id', 'cctv-stream.bandaacehkota.info']);

type AcehRecord = {
  id?: unknown;
  name?: unknown;
  region?: unknown;
  url?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  is_active?: unknown;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function acehCamera(record: AcehRecord): CctvCamera | null {
  if (record.is_active !== true) return null;

  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  let embed: URL;
  try {
    embed = new URL(text(record.url));
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(embed.hostname.toLowerCase())) return null;
  const match = embed.pathname.match(/^(.*\/)([0-9a-f-]{8,})\.html$/i);
  if (!match) return null;
  const [, dir, uuid] = match;

  const id = text(record.id ? String(record.id) : '');
  if (!id) return null;

  const name = text(record.name) || `CCTV Banda Aceh ${id}`;
  const region = text(record.region);
  return {
    id: `aceh-${id}`,
    lat,
    lng,
    name: region ? `${name} · ${region}` : name,
    city: 'Kota Banda Aceh',
    country: 'Indonesia',
    source: 'CCTV Banda Aceh',
    stream_url: `${embed.origin}${dir}memfs/${uuid}.m3u8`,
    stream_type: 'hls',
  };
}

export async function fetchAcehCameras(): Promise<CctvCamera[]> {
  try {
    const response = await fetch(API, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Aceh HTTP ${response.status}`);
    const body = await response.json() as { data?: unknown };
    const data = Array.isArray(body.data) ? body.data : [];
    const seen = new Set<string>();
    const cameras: CctvCamera[] = [];
    for (const record of data) {
      const camera = acehCamera(record as AcehRecord);
      if (camera && !seen.has(camera.id)) {
        seen.add(camera.id);
        cameras.push(camera);
      }
    }
    return cameras;
  } catch (error) {
    console.warn('[OSIRIS] Banda Aceh CCTV failed:', error instanceof Error ? error.message : error);
    return [];
  }
}
