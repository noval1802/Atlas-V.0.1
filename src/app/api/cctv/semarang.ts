import type { CctvCamera } from './types';

/**
 * Kota Semarang CCTV from the city's "Pantau Semar" portal
 * (`pantausemar.semarangkota.go.id`).
 *
 * The portal has no JSON API; its map page ships the markers inline. Each
 * marker carries a lat/lng and a `links` array — one entry per camera at that
 * spot — whose `url` is a direct `index.m3u8` on `livepantau.semarangkota.go.id`.
 * That playlist and its segments answer with `Access-Control-Allow-Origin: *`,
 * so the browser plays them straight from the origin — no proxy.
 *
 * This scrapes an HTML page, so it is deliberately defensive: a marker or link
 * that does not parse, sits outside Indonesia, is offline, or points off-host
 * is dropped, and a layout change that yields nothing returns [] with a warning.
 */

const PAGE = 'https://pantausemar.semarangkota.go.id/';
const STREAM_HOST = 'livepantau.semarangkota.go.id';

type Link = { id?: unknown; name?: unknown; url?: unknown; status?: unknown };
type Marker = { cctv_id?: unknown; owner_name?: unknown; lat?: unknown; lng?: unknown; links?: unknown };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function semarangCamera(marker: Marker, link: Link): CctvCamera | null {
  if (link.status !== 1) return null;

  const lat = Number(marker.lat);
  const lng = Number(marker.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  let url: URL;
  try {
    url = new URL(text(link.url));
  } catch {
    return null;
  }
  if (url.hostname.toLowerCase() !== STREAM_HOST || !url.pathname.endsWith('.m3u8')) return null;

  const id = text(link.id ? String(link.id) : '');
  if (!id) return null;

  const name = text(link.name) || `CCTV Semarang ${id}`;
  return {
    id: `semarang-${id}`,
    lat,
    lng,
    name,
    city: 'Kota Semarang',
    country: 'Indonesia',
    source: 'Pantau Semar',
    stream_url: url.toString(),
    stream_type: 'hls',
  };
}

/** Pull the inline marker objects out of the Pantau Semar page HTML. */
export function parseSemarang(html: string): CctvCamera[] {
  const cameras: CctvCamera[] = [];
  const seen = new Set<string>();
  // Each marker is a minified JSON object from "cctv_id" through its "links" array.
  for (const match of html.matchAll(/\{"cctv_id":\d+.*?"links":\[.*?\]\}/g)) {
    let marker: Marker;
    try {
      marker = JSON.parse(match[0]) as Marker;
    } catch {
      continue;
    }
    const links = Array.isArray(marker.links) ? marker.links : [];
    for (const link of links) {
      const camera = semarangCamera(marker, link as Link);
      if (camera && !seen.has(camera.id)) {
        seen.add(camera.id);
        cameras.push(camera);
      }
    }
  }
  return cameras;
}

export async function fetchSemarangCameras(): Promise<CctvCamera[]> {
  try {
    const response = await fetch(PAGE, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Semarang HTTP ${response.status}`);
    const cameras = parseSemarang(await response.text());
    if (!cameras.length) console.warn('[OSIRIS] Semarang CCTV: page returned no camera records (layout changed?)');
    return cameras;
  } catch (error) {
    console.warn('[OSIRIS] Semarang CCTV failed:', error instanceof Error ? error.message : error);
    return [];
  }
}
