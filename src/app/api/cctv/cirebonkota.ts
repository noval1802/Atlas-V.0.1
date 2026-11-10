import type { CctvCamera } from './types';

/**
 * Kota Cirebon CCTV ("Cirebon Mata Hatiku") from `cctv.cirebonkota.go.id`.
 *
 * Open JSON at `/api/status`: `[{ slug, name, online, lat, lon, kecamatan }]`.
 * The stream is `/hls/<slug>/index.m3u8` on the same host, which serves no CORS
 * header, so playback goes through `/api/cctv/hls` (host allowlisted there).
 */

const ORIGIN = 'https://cctv.cirebonkota.go.id';
const API = `${ORIGIN}/api/status`;

type CirebonRecord = { slug?: unknown; name?: unknown; lat?: unknown; lon?: unknown; kecamatan?: unknown };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

export function cirebonKotaCamera(record: CirebonRecord): CctvCamera | null {
  const slug = text(record.slug);
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;

  const lat = Number(record.lat);
  const lng = Number(record.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  const upstream = `${ORIGIN}/hls/${slug}/index.m3u8`;
  const name = text(record.name) || slug;
  const district = text(record.kecamatan);
  return {
    id: `cirebonkota-${slug}`,
    lat,
    lng,
    name: district ? `${name} · ${district}` : name,
    city: 'Kota Cirebon',
    country: 'Indonesia',
    source: 'Cirebon Mata Hatiku',
    stream_url: `/api/cctv/hls?u=${encodeURIComponent(upstream)}`,
    stream_type: 'hls',
  };
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchCirebonKotaCameras(): Promise<CctvCamera[]> {
  const response = await fetch(API, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Cirebon Kota HTTP ${response.status}`);
  const body = await response.json() as unknown;
  const records = Array.isArray(body) ? body : [];
  if (!records.length) throw new Error('Cirebon Kota: unexpected payload');
  const seen = new Set<string>();
  const cameras: CctvCamera[] = [];
  for (const record of records) {
    const camera = cirebonKotaCamera(record as CirebonRecord);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  if (!cameras.length) throw new Error('Cirebon Kota: no usable cameras in payload');
  return cameras;
}
