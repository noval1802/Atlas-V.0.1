import type { CctvCamera } from './types';

/**
 * Kota Bukittinggi CCTV from `hls.bukittinggikota.go.id/api/get-list-camera`.
 *
 * The public map reads this open JSON: an array of locations, each with
 * coordinates and a `listCamera` of `{ nama_kamera, stream_url, snapshot_url }`.
 * Streams are direct HLS on the same host and answer with
 * `Access-Control-Allow-Origin: *`, so the browser plays them straight — no proxy.
 *
 * Coordinates are per location, so cameras at one spot share a point; a nudge
 * keeps the markers from stacking exactly.
 */

const API = 'https://hls.bukittinggikota.go.id/api/get-list-camera';
const STREAM_HOST = 'hls.bukittinggikota.go.id';

type ApiCamera = { nama_kamera?: unknown; stream_url?: unknown; snapshot_url?: unknown };
type ApiLocation = { id?: unknown; nama_lokasi?: unknown; latitude?: unknown; longitude?: unknown; listCamera?: unknown };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function validStream(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  return url.protocol === 'https:' && url.hostname.toLowerCase() === STREAM_HOST && url.pathname.endsWith('.m3u8') ? url.toString() : null;
}

/** Spread cameras sharing one location's point onto a tiny ring (~11 m) so markers don't stack. */
function nudge(lat: number, lng: number, index: number, count: number): [number, number] {
  if (count < 2) return [lat, lng];
  const angle = (2 * Math.PI * index) / count;
  return [lat + 0.0001 * Math.sin(angle), lng + 0.0001 * Math.cos(angle)];
}

export function bukittinggiLocationCameras(location: ApiLocation): CctvCamera[] {
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return [];

  const locationId = text(location.id);
  if (!locationId) return []; // without a stable id, camera ids would collide
  const place = text(location.nama_lokasi) || `Lokasi ${locationId}`;
  const list = Array.isArray(location.listCamera) ? (location.listCamera as ApiCamera[]) : [];
  const usable = list.map(cam => ({ cam, stream: validStream(text(cam.stream_url)) })).filter(x => x.stream);

  return usable.map(({ cam, stream }, index) => {
    const [cLat, cLng] = nudge(lat, lng, index, usable.length);
    const label = text(cam.nama_kamera);
    return {
      id: `bukittinggi-${locationId}-${index}`,
      lat: cLat,
      lng: cLng,
      name: label ? `${place} ${label}` : place,
      city: 'Kota Bukittinggi',
      country: 'Indonesia',
      source: 'CCTV Kota Bukittinggi',
      stream_url: stream as string,
      stream_type: 'hls',
    };
  });
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchBukittinggiCameras(): Promise<CctvCamera[]> {
  const response = await fetch(API, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Bukittinggi HTTP ${response.status}`);
  const body = await response.json() as unknown;
  const locations = Array.isArray(body) ? body : [];
  if (!locations.length) throw new Error('Bukittinggi: unexpected payload');
  const seen = new Set<string>();
  const cameras = locations
    .flatMap(location => bukittinggiLocationCameras(location as ApiLocation))
    .filter(camera => !seen.has(camera.id) && seen.add(camera.id));
  if (!cameras.length) throw new Error('Bukittinggi: no usable cameras in payload');
  return cameras;
}
