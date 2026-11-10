import type { CctvCamera } from './types';

/**
 * Kabupaten Balangan (Kalimantan Selatan) CCTV from the public map
 * `cctv.balangankab.go.id/peta` ("BAJALANAN").
 *
 * The page has no JSON API; its sidebar ships every camera as an `<a>` with
 * data-id/lat/lng/nama/status/hls attributes, grouped under `data-wilayah`
 * blocks (kecamatan). Streams are HLS on the same host. That host sends
 * `Access-Control-Allow-Origin: *` twice, which browsers reject as a CORS
 * header, so playback goes through `/api/cctv/hls` (host allowlisted there).
 * Streams are HEVC (hvc1): browsers without HEVC decoding cannot play them.
 *
 * This scrapes HTML, so it is defensive: an entry that does not parse, is not
 * online, sits outside Indonesia or points off-host is dropped.
 */

const PAGE = 'https://cctv.balangankab.go.id/peta';
const STREAM_HOST = 'cctv.balangankab.go.id';

const decode = (value: string) =>
  value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

const attr = (tag: string, name: string) => {
  const match = new RegExp(`\\sdata-${name}="([^"]*)"`).exec(tag);
  return match ? decode(match[1]) : '';
};

/** "PARINGIN SELATAN" → "Paringin Selatan". */
const titleCase = (value: string) => value.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());

export function balanganCamera(tag: string, wilayah: string): CctvCamera | null {
  if (attr(tag, 'status') !== 'online') return null;

  const lat = Number(attr(tag, 'lat'));
  const lng = Number(attr(tag, 'lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  let url: URL;
  try {
    url = new URL(attr(tag, 'hls'));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== STREAM_HOST || !url.pathname.endsWith('.m3u8')) return null;

  const id = attr(tag, 'id');
  if (!/^[0-9]{1,8}$/.test(id)) return null;

  const name = attr(tag, 'nama') || `CCTV Balangan ${id}`;
  return {
    id: `balangan-${id}`,
    lat,
    lng,
    name: wilayah ? `${name} · ${titleCase(wilayah)}` : name,
    city: 'Kabupaten Balangan',
    country: 'Indonesia',
    source: 'CCTV Kab. Balangan',
    stream_url: `/api/cctv/hls?u=${encodeURIComponent(url.toString())}`,
    stream_type: 'hls',
  };
}

/** Walk the page in order so each camera picks up the kecamatan block it sits in. */
export function parseBalangan(html: string): CctvCamera[] {
  const cameras: CctvCamera[] = [];
  const seen = new Set<string>();
  let wilayah = '';
  for (const match of html.matchAll(/data-wilayah="([^"]*)"|<a\b[^>]*\bmap-sidebar-cctv\b[^>]*>/g)) {
    if (match[1] !== undefined) {
      wilayah = decode(match[1]);
      continue;
    }
    const camera = balanganCamera(match[0], wilayah);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  return cameras;
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchBalanganCameras(): Promise<CctvCamera[]> {
  const response = await fetch(PAGE, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Balangan HTTP ${response.status}`);
  const cameras = parseBalangan(await response.text());
  if (!cameras.length) throw new Error('Balangan: page returned no online cameras (layout changed?)');
  return cameras;
}
