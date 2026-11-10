import type { CctvCamera } from './types';

/**
 * Kota Palembang CCTV from the city's public API `cctv.palembang.go.id/api/cctv`.
 *
 * Each record is a public (`cctv_scope: "publik"`) camera with a GeoJSON point,
 * kecamatan and a direct HLS `cctv_link` on `stream.palembang.go.id`, which
 * answers with `Access-Control-Allow-Origin: *`, so the browser plays it
 * straight — no proxy.
 */

const API = 'https://cctv.palembang.go.id/api/cctv';
const STREAM_HOST = 'stream.palembang.go.id';

type PalembangRecord = {
  _id?: unknown;
  cctv_title?: unknown;
  cctv_link?: unknown;
  cctv_scope?: unknown;
  cctv_status?: unknown;
  location?: { coordinates?: unknown };
  kecamatan?: { namaKecamatan?: unknown };
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

/** "ALANG-ALANG LEBAR" → "Alang-Alang Lebar". */
const titleCase = (value: string) => value.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());

export function palembangCamera(record: PalembangRecord): CctvCamera | null {
  if (text(record.cctv_scope) !== 'publik') return null;
  if (text(record.cctv_status) === 'inactive') return null;

  const coords = record.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  let url: URL;
  try {
    url = new URL(text(record.cctv_link));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== STREAM_HOST || !url.pathname.endsWith('.m3u8')) return null;

  const id = text(record._id);
  if (!id) return null;

  const name = text(record.cctv_title) || `CCTV Palembang ${id}`;
  const district = titleCase(text(record.kecamatan?.namaKecamatan));
  return {
    id: `palembang-${id}`,
    lat,
    lng,
    name: district ? `${name} · ${district}` : name,
    city: 'Kota Palembang',
    country: 'Indonesia',
    source: 'CCTV Kota Palembang',
    stream_url: url.toString(),
    stream_type: 'hls',
  };
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchPalembangCameras(): Promise<CctvCamera[]> {
  const response = await fetch(API, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Palembang HTTP ${response.status}`);
  const body = await response.json() as { data?: unknown };
  const records = Array.isArray(body?.data) ? body.data : [];
  if (!records.length) throw new Error('Palembang: unexpected payload');
  const seen = new Set<string>();
  const cameras: CctvCamera[] = [];
  for (const record of records) {
    const camera = palembangCamera(record as PalembangRecord);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  if (!cameras.length) throw new Error('Palembang: no usable public cameras in payload');
  return cameras;
}
