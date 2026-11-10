import type { CctvCamera } from './types';

/**
 * Kabupaten Bandung Barat ATCS (Dishub KBB) from `atcs.bandungbaratkab.go.id`.
 *
 * The map loads `/get-cctv`: `{ data: [{ nama_cctv, alias, koordinat, link }] }`
 * where `koordinat` is "lat, lng" and `link` is a datarhei Restreamer embed
 * page `https://atcs-dishubkbb.urbanaccess.net/<uuid>.html`. Behind each embed
 * is a direct H.264 HLS playlist at `memfs/<uuid>.m3u8`, served over https with
 * `Access-Control-Allow-Origin: *`, so the browser plays it straight from the
 * origin, no proxy. The channels are published as CC BY 4.0, author DISHUB KBB.
 */

const API = 'https://atcs.bandungbaratkab.go.id/get-cctv';
const STREAM_ORIGIN = 'https://atcs-dishubkbb.urbanaccess.net';

type KbbRecord = { nama_cctv?: unknown; koordinat?: unknown; link?: unknown };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** "CIBURUY - CIPATAT" → "Ciburuy - Cipatat"; keeps short codes such as KBP and JL. */
function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\p{L}[\p{L}.]*/gu, word =>
    /^(kbp|kbb|jl\.?)$/.test(word) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1));
}

export function bandungBaratCamera(record: KbbRecord): CctvCamera | null {
  const [lat, lng] = text(record.koordinat).split(',').map(part => Number(part.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  let link: URL;
  try {
    link = new URL(text(record.link));
  } catch {
    return null;
  }
  const channel = /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.html$/i.exec(link.pathname)?.[1];
  if (link.origin !== STREAM_ORIGIN || !channel) return null;

  return {
    id: `bandungbarat-${channel.toLowerCase()}`,
    lat,
    lng,
    name: titleCase(text(record.nama_cctv)) || 'CCTV Bandung Barat',
    city: 'Kabupaten Bandung Barat',
    country: 'Indonesia',
    source: 'ATCS Dishub KBB',
    stream_url: `${STREAM_ORIGIN}/memfs/${channel.toLowerCase()}.m3u8`,
    stream_type: 'hls',
  };
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchBandungBaratCameras(): Promise<CctvCamera[]> {
  const response = await fetch(API, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Bandung Barat HTTP ${response.status}`);
  const body = await response.json() as { data?: unknown };
  if (!Array.isArray(body?.data)) throw new Error('Bandung Barat: unexpected payload');
  const seen = new Set<string>();
  const cameras: CctvCamera[] = [];
  for (const record of body.data) {
    const camera = bandungBaratCamera(record as KbbRecord);
    if (camera && !seen.has(camera.id)) {
      seen.add(camera.id);
      cameras.push(camera);
    }
  }
  if (!cameras.length) throw new Error('Bandung Barat: no usable cameras in payload (format changed?)');
  return cameras;
}
