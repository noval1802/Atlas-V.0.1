import type { CctvCamera } from './types';
import { safeFetch } from '@/lib/ssrf-guard';

/**
 * Kota Serang CCTV from the city's public API `cctv.serangkota.go.id/api/cctv`.
 *
 * A GeoJSON FeatureCollection; each feature has coordinates and `rtsp_ip`, which
 * is actually an Ant Media embed URL `…/LiveApp/play.html?name=<stream>`. The
 * playable HLS is `https://stream.serangkota.go.id/LiveApp/streams/<stream>.m3u8`,
 * served with `Access-Control-Allow-Origin: *`, so the browser plays it straight.
 *
 * The browser plays the stream directly. The stream host omits its intermediate
 * certificate, which Node cannot fill in by itself, so ATLAS's server-side
 * health probe (safeFetch) would fail it; the shared agent carries the missing
 * intermediate (see lib/tls-intermediates.ts). The list fetch uses safeFetch too.
 */

const API = 'https://cctv.serangkota.go.id/api/cctv';
const STREAM_HOST = 'stream.serangkota.go.id';

type Feature = {
  properties?: { id?: unknown; place_name?: unknown; address?: unknown; rtsp_ip?: unknown; status_cctv?: unknown };
  geometry?: { coordinates?: unknown };
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

/** Ant Media stream name from the embed URL (the `:/` typo in the source is tolerated). */
function streamName(rtspIp: string): string | null {
  let url: URL;
  try {
    // Source has a stray `host:/path` colon; drop a colon before a single slash, not `://`.
    url = new URL(rtspIp.replace(/:\/(?!\/)/, '/'));
  } catch {
    return null;
  }
  if (url.hostname.toLowerCase() !== STREAM_HOST) return null;
  const name = url.searchParams.get('name') ?? '';
  return /^[A-Za-z0-9_-]{1,40}$/.test(name) ? name : null;
}

export function serangCamera(feature: Feature): CctvCamera | null {
  const props = feature.properties ?? {};
  if (text(props.status_cctv).toLowerCase() === 'off') return null;

  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  const name = streamName(text(props.rtsp_ip));
  if (!name) return null;

  const id = text(props.id);
  if (!id) return null;

  return {
    id: `serang-${id}`,
    lat,
    lng,
    name: text(props.place_name) || `CCTV Serang ${id}`,
    city: 'Kota Serang',
    country: 'Indonesia',
    source: 'CCTV Diskominfo Kota Serang',
    stream_url: `https://${STREAM_HOST}/LiveApp/streams/${name}.m3u8`,
    stream_type: 'hls',
  };
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchSerangCameras(): Promise<CctvCamera[]> {
  const response = await safeFetch(API, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Serang HTTP ${response.status}`);
  const body = await response.json() as { features?: unknown };
  const features = Array.isArray(body?.features) ? body.features : [];
  if (!features.length) throw new Error('Serang: unexpected payload');
  const seen = new Set<string>();
  const cameras: CctvCamera[] = [];
  for (const feature of features) {
    const camera = serangCamera(feature as Feature);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  if (!cameras.length) throw new Error('Serang: no usable cameras in payload');
  return cameras;
}
