import type { CctvCamera } from './types';

/**
 * Kota Bandar Lampung CCTV ("Seribu Wajah") from its public API
 * `api-newseribuwajah.bandarlampungkota.go.id/cctvs`.
 *
 * The public map ships a read-only `x-api-key` to every visitor to read the
 * camera list; it is not a secret, but it is kept in env (BANDARLAMPUNG_API_KEY)
 * rather than source. Each record carries coordinates, kelurahan/kecamatan and a
 * direct HLS `streamUrl` on `stream-newseribuwajah.bandarlampungkota.go.id`.
 *
 * shortcut: streams play straight from the origin. Their stream server was
 * down (HTTP 525) when this was written, so CORS could not be confirmed; if
 * playback is blocked once it recovers, route stream_url through /api/cctv/hls
 * and allowlist the host there.
 */

const API = 'https://api-newseribuwajah.bandarlampungkota.go.id/cctvs';
const STREAM_HOST = 'stream-newseribuwajah.bandarlampungkota.go.id';

type LampungRecord = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  isHidden?: unknown;
  status?: unknown;
  streamUrl?: unknown;
  kelurahan?: { name?: unknown; kecamatan?: { name?: unknown } };
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

/** "TELUK BETUNG UTARA" → "Teluk Betung Utara". */
const titleCase = (value: string) => value.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());

export function bandarLampungCamera(record: LampungRecord): CctvCamera | null {
  if (record.isHidden === true) return null;
  if (text(record.status).toLowerCase() === 'offline') return null;

  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  let url: URL;
  try {
    url = new URL(text(record.streamUrl));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== STREAM_HOST || !url.pathname.endsWith('.m3u8')) return null;

  const id = text(record.id);
  if (!/^\d{1,8}$/.test(id)) return null;

  const name = text(record.name) || `CCTV Bandar Lampung ${id}`;
  const district = titleCase(text(record.kelurahan?.kecamatan?.name));
  return {
    id: `bandarlampung-${id}`,
    lat,
    lng,
    name: district ? `${name} · ${district}` : name,
    city: 'Kota Bandar Lampung',
    country: 'Indonesia',
    source: 'Seribu Wajah Bandar Lampung',
    stream_url: url.toString(),
    stream_type: 'hls',
  };
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchBandarLampungCameras(): Promise<CctvCamera[]> {
  const response = await fetch(API, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', 'x-api-key': process.env.BANDARLAMPUNG_API_KEY ?? '' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Bandar Lampung HTTP ${response.status}`);
  const body = await response.json() as unknown;
  const records = Array.isArray(body) ? body : [];
  if (!records.length) throw new Error('Bandar Lampung: unexpected payload');
  const seen = new Set<string>();
  const cameras: CctvCamera[] = [];
  for (const record of records) {
    const camera = bandarLampungCamera(record as LampungRecord);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  if (!cameras.length) throw new Error('Bandar Lampung: no visible online cameras in payload');
  return cameras;
}
