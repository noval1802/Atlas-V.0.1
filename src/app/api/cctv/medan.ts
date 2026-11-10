import type { CctvCamera } from './types';

/**
 * Kota Medan CCTV ("ITS Kota Medan" / ATCS Dishub) from `atcsdishub.medan.go.id`.
 *
 * The public map reads `/api/v3/pv/ldevice` with a read-only client id/secret
 * the site ships to every visitor (not a per-user login). They are kept in env
 * (MEDAN_CLIENT_ID / MEDAN_CLIENT_SECRET) rather than source; without them the
 * list fetch 401s and the region is simply empty.
 * Each location carries coordinates and devices. A device's `url_proxy_hls`
 * (the city's own HLS, `Access-Control-Allow-Origin: *`) plays straight in the
 * browser — no proxy. The device's `url_video` is a raw RTSP URL with embedded
 * camera credentials and a private IP; this module never reads or exposes it.
 */

const API = 'https://atcsdishub.medan.go.id/api/v3/pv/ldevice';
const STREAM_HOST = 'atcsdishub.medan.go.id';

type Device = { nama_alias?: unknown; url_proxy_hls?: unknown };
type Location = { id_lokasi?: unknown; nama_lokasi?: unknown; lat_lokasi?: unknown; lon_lokasi?: unknown; is_active?: unknown; tb_device_lokasi?: unknown };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

/** "RADEN SALEH - BALAI KOTA" → "Raden Saleh - Balai Kota". */
const titleCase = (value: string) => value.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());

/** url_proxy_hls → the playable index.m3u8 on the city host, or null. */
function hlsUrl(raw: string): string | null {
  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    return null;
  }
  // Resolve against the path (dropping any query/fragment) so a stray `?…` can't
  // land the filename inside the query string.
  const url = new URL('index.m3u8', `${base.origin}${base.pathname.endsWith('/') ? base.pathname : base.pathname + '/'}`);
  return base.protocol === 'https:' && base.hostname.toLowerCase() === STREAM_HOST ? url.toString() : null;
}

/** Spread devices sharing one location's point onto a tiny ring so markers don't stack. */
function nudge(lat: number, lng: number, index: number, count: number): [number, number] {
  if (count < 2) return [lat, lng];
  const angle = (2 * Math.PI * index) / count;
  return [lat + 0.0001 * Math.sin(angle), lng + 0.0001 * Math.cos(angle)];
}

export function medanLocationCameras(location: Location): CctvCamera[] {
  if (location.is_active === false) return [];
  const lat = Number(location.lat_lokasi);
  const lng = Number(location.lon_lokasi);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return [];

  const id = text(location.id_lokasi);
  if (!id) return []; // without a stable id, camera ids would collide
  const place = titleCase(text(location.nama_lokasi)) || `Lokasi ${id}`;
  const devices = Array.isArray(location.tb_device_lokasi) ? (location.tb_device_lokasi as Device[]) : [];
  const usable = devices.map(d => ({ d, url: hlsUrl(text(d.url_proxy_hls)) })).filter(x => x.url);

  return usable.map(({ d, url }, index) => {
    const [cLat, cLng] = nudge(lat, lng, index, usable.length);
    const alias = titleCase(text(d.nama_alias));
    return {
      id: `medan-${id}-${index}`,
      lat: cLat,
      lng: cLng,
      name: usable.length > 1 && alias ? `${place} · ${alias}` : place,
      city: 'Kota Medan',
      country: 'Indonesia',
      source: 'ITS Kota Medan',
      stream_url: url as string,
      stream_type: 'hls',
    };
  });
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchMedanCameras(): Promise<CctvCamera[]> {
  const response = await fetch(API, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'x-client-id': process.env.MEDAN_CLIENT_ID ?? '',
      'x-client-secret': process.env.MEDAN_CLIENT_SECRET ?? '',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Medan HTTP ${response.status}`);
  const body = await response.json() as { data?: unknown };
  const locations = Array.isArray(body?.data) ? body.data : [];
  if (!locations.length) throw new Error('Medan: unexpected payload');
  const seen = new Set<string>();
  const cameras = locations
    .flatMap(location => medanLocationCameras(location as Location))
    .filter(camera => !seen.has(camera.id) && seen.add(camera.id));
  if (!cameras.length) throw new Error('Medan: no usable cameras in payload');
  return cameras;
}
