import type { CctvCamera } from './types';

/**
 * Kabupaten Tangerang CCTV (Dishub) from `cctv-dishub.tangerangkab.go.id/cctv-map`.
 *
 * A Laravel Livewire page: the camera list rides in the component snapshot
 * (HTML-escaped JSON in a `wire:snapshot` attribute), one object per camera
 * `{"id": ULID, "name", "latitude", "longitude", "url"}` where `url` is a fixed
 * HLS playlist `/storage/video/<id>/<id>.m3u8` on the same host. The list
 * appears twice in the snapshot; ids dedupe it.
 *
 * The playlist is served without any CORS header, so the browser cannot read it
 * cross-origin; playback goes through `/api/cctv/hls` (host allowlisted there).
 */

const PAGE = 'https://cctv-dishub.tangerangkab.go.id/cctv-map';
const STREAM_HOST = 'cctv-dishub.tangerangkab.go.id';

const unescapeHtml = (value: string) =>
  value.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

type Record = { id?: unknown; name?: unknown; latitude?: unknown; longitude?: unknown; url?: unknown };

export function tangerangKabCamera(record: Record): CctvCamera | null {
  const id = typeof record.id === 'string' ? record.id : '';
  if (!/^[0-9a-z]{26}$/.test(id)) return null;

  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  let url: URL;
  try {
    url = new URL(typeof record.url === 'string' ? record.url : '');
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== STREAM_HOST || !url.pathname.endsWith('.m3u8')) return null;

  const name = (typeof record.name === 'string' ? record.name.trim() : '') || 'CCTV Kab. Tangerang';
  return {
    id: `tangerangkab-${id}`,
    lat,
    lng,
    name,
    city: 'Kabupaten Tangerang',
    country: 'Indonesia',
    source: 'Dishub Kab. Tangerang',
    stream_url: `/api/cctv/hls?u=${encodeURIComponent(url.toString())}`,
    stream_type: 'hls',
  };
}

/** Pull every camera object out of the Livewire snapshot. */
export function parseTangerangKab(html: string): CctvCamera[] {
  const text = unescapeHtml(html);
  const cameras: CctvCamera[] = [];
  const seen = new Set<string>();
  const object = /\{"id":"[0-9a-z]{26}","name":"(?:[^"\\]|\\.)*","latitude":-?[\d.]+,"longitude":-?[\d.]+,"url":"(?:[^"\\]|\\.)*"\}/g;
  for (const match of text.matchAll(object)) {
    let record: Record;
    try {
      record = JSON.parse(match[0]) as Record;
    } catch {
      continue;
    }
    const camera = tangerangKabCamera(record);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  return cameras;
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchTangerangKabCameras(): Promise<CctvCamera[]> {
  const response = await fetch(PAGE, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Kab. Tangerang HTTP ${response.status}`);
  const cameras = parseTangerangKab(await response.text());
  if (!cameras.length) throw new Error('Kab. Tangerang: page returned no cameras (layout changed?)');
  return cameras;
}
