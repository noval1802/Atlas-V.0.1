import type { CctvCamera } from './types';

/**
 * Kabupaten Magelang CCTV (Dishub) from `cctv.dishub.magelangkab.go.id/map-cctv`.
 *
 * The page has no API; each camera is an inline Leaflet call,
 * `L.marker([lat, lng]).addTo(map).bindPopup("<b>Name</b>… Kecamatan : X…<iframe src=https://www.youtube.com/embed/ID>")`.
 * The video is the regency's own YouTube live broadcast (channels "Dinas
 * Perhubungan Kabupaten Magelang" / "ATCS Dishub Kab Magelang"), which YouTube
 * allows to be embedded. Markers whose embed has no video id are dropped.
 * Live video ids change when a broadcast restarts; the page is re-read every TTL.
 */

const PAGE = 'https://cctv.dishub.magelangkab.go.id/map-cctv';
const EMBED_PARAMS = 'autoplay=1&mute=1&controls=0&modestbranding=1&rel=0';

const decode = (value: string) =>
  value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

export function magelangCamera(lat: number, lng: number, popup: string): CctvCamera | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  const video = /youtube\.com\/embed\/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/.exec(popup)?.[1];
  if (!video) return null;

  const name = decode(/<b>(.*?)<\/b>/.exec(popup)?.[1] ?? '') || 'CCTV Magelang';
  const district = decode(/Kecamatan\s*:\s*([^<]+)/.exec(popup)?.[1] ?? '');
  return {
    id: `magelang-${video}`,
    lat,
    lng,
    name: district ? `${name} · ${district}` : name,
    city: 'Kabupaten Magelang',
    country: 'Indonesia',
    source: 'Dishub Kab. Magelang',
    stream_url: `https://www.youtube.com/embed/${video}?${EMBED_PARAMS}`,
    stream_type: 'iframe',
    external_url: `https://www.youtube.com/watch?v=${video}`,
  };
}

/** Read every inline marker and its popup out of the page. */
export function parseMagelang(html: string): CctvCamera[] {
  const cameras: CctvCamera[] = [];
  const seen = new Set<string>();
  const marker = /L\.marker\(\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]\)\s*\.addTo\(map\)\s*\.bindPopup\("((?:[^"\\]|\\.)*)"\)/g;
  for (const match of html.matchAll(marker)) {
    const camera = magelangCamera(Number(match[1]), Number(match[2]), match[3]);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  return cameras;
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchMagelangCameras(): Promise<CctvCamera[]> {
  const response = await fetch(PAGE, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Magelang HTTP ${response.status}`);
  const cameras = parseMagelang(await response.text());
  if (!cameras.length) throw new Error('Magelang: page returned no cameras with a video (layout changed?)');
  return cameras;
}
