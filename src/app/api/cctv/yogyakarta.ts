import type { CctvCamera } from './types';

/**
 * Kota Yogyakarta CCTV from the city's public map (`cctv.jogjakota.go.id`).
 *
 * The map loads its markers from `home/getdata`, a flat JSON list with
 * coordinates and a direct Wowza HLS playlist per camera on
 * `cctvjss.jogjakota.go.id`. Those playlists answer with
 * `Access-Control-Allow-Origin: *` over https, so the browser plays them
 * straight from the origin, no proxy.
 *
 * `cctv_status`: 0 public, 1 private, 2 maintenance. Only public cameras are kept.
 *
 * The endpoint expects the AJAX header the map page sends. Operator decision
 * (Nov 2026) to send it; ask Diskominfo Jogja for an official feed if it breaks.
 */

const API = 'https://cctv.jogjakota.go.id/home/getdata';
const STREAM_HOST = 'cctvjss.jogjakota.go.id';

type JogjaRecord = {
  cctv_id?: unknown;
  cctv_title?: unknown;
  cctv_link?: unknown;
  cctv_latitude?: unknown;
  cctv_longitude?: unknown;
  cctv_status?: unknown;
  kecamatan_nama?: unknown;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

/** "SIMPANG APMD (PTZ)" → "Simpang Apmd (PTZ)"; the source mixes cases. */
function title(value: string): string {
  return value.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase()).replace(/\((ptz|fix|fixed)\)/gi, m => m.toUpperCase());
}

export function yogyakartaCamera(record: JogjaRecord): CctvCamera | null {
  if (text(record.cctv_status) !== '0') return null;

  const lat = Number(record.cctv_latitude);
  const lng = Number(record.cctv_longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  let url: URL;
  try {
    url = new URL(text(record.cctv_link));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== STREAM_HOST || !url.pathname.endsWith('.m3u8')) return null;

  const id = text(record.cctv_id);
  if (!/^[0-9]{1,8}$/.test(id)) return null;

  const district = text(record.kecamatan_nama);
  const name = title(text(record.cctv_title)) || `CCTV Yogyakarta ${id}`;
  return {
    id: `yogyakarta-${id}`,
    lat,
    lng,
    name: district ? `${name} · ${title(district)}` : name,
    city: 'Kota Yogyakarta',
    country: 'Indonesia',
    source: 'CCTV Pemkot Yogyakarta',
    stream_url: url.toString(),
    stream_type: 'hls',
  };
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchYogyakartaCameras(): Promise<CctvCamera[]> {
  const response = await fetch(API, {
    // The endpoint answers "No direct access" without the header its own map page sends.
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Yogyakarta HTTP ${response.status}`);
  const body = await response.json() as unknown;
  if (!Array.isArray(body)) throw new Error('Yogyakarta: unexpected payload');
  const seen = new Set<string>();
  const cameras: CctvCamera[] = [];
  for (const record of body) {
    const camera = yogyakartaCamera(record as JogjaRecord);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  if (!cameras.length) throw new Error('Yogyakarta: no public cameras in payload (format changed?)');
  return cameras;
}
