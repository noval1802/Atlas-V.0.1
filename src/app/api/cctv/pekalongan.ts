import type { CctvCamera } from './types';

/**
 * Kota Pekalongan CCTV (relay streaming) from `cctv.pekalongankota.go.id/api/config`.
 *
 * `config.streams` maps a stream uuid to `{ category, channels }`, each channel
 * carrying coordinates, a name and `public`. The playable stream is the relay's
 * own HLS `/stream/<uuid>/channel/<ch>/hls/live/index.m3u8` on this host, which
 * answers with `Access-Control-Allow-Origin: *`, so the browser plays it straight.
 *
 * Only `public` channels are taken. The channel's `url` is a raw RTSP address
 * with embedded credentials and a private IP; this module never reads or exposes it.
 *
 * shortcut: streams are on-demand — a sleeping one answers 503 until the first
 * viewer wakes it, so ATLAS health may show idle cameras red; playback recovers
 * on the player's retry. Upgrade only if the relay gains an always-on mode.
 */

const ORIGIN = 'https://cctv.pekalongankota.go.id';
const API = `${ORIGIN}/api/config`;

type Channel = { latitude?: unknown; longitude?: unknown; name?: unknown; public?: unknown };
type Stream = { category?: unknown; name?: unknown; channels?: unknown };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

const isPublic = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';

export function pekalonganChannelCamera(uuid: string, channel: string, ch: Channel, streamName: string): CctvCamera | null {
  if (!/^[0-9a-f-]{8,40}$/i.test(uuid) || !/^\d{1,3}$/.test(channel)) return null;
  if (!isPublic(ch.public)) return null;

  const lat = Number(text(ch.latitude));
  const lng = Number(text(ch.longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;

  const name = text(ch.name) || streamName || `CCTV Pekalongan ${channel}`;
  return {
    id: `pekalongan-${uuid}-${channel}`,
    lat,
    lng,
    name,
    city: 'Kota Pekalongan',
    country: 'Indonesia',
    source: 'CCTV Kota Pekalongan',
    stream_url: `${ORIGIN}/stream/${uuid}/channel/${channel}/hls/live/index.m3u8`,
    stream_type: 'hls',
  };
}

/** Flatten config.streams into cameras, one per public channel. */
export function parsePekalongan(streams: Record<string, Stream>): CctvCamera[] {
  const cameras: CctvCamera[] = [];
  const seen = new Set<string>();
  for (const [uuid, stream] of Object.entries(streams)) {
    const channels = stream.channels && typeof stream.channels === 'object' ? stream.channels as Record<string, Channel> : {};
    for (const [channel, ch] of Object.entries(channels)) {
      const camera = pekalonganChannelCamera(uuid, channel, ch, text(stream.name));
      if (camera && !seen.has(camera.id)) {
        seen.add(camera.id);
        cameras.push(camera);
      }
    }
  }
  return cameras;
}

/** Throws on failure so the source cache keeps the last good list instead of caching []. */
export async function fetchPekalonganCameras(): Promise<CctvCamera[]> {
  const response = await fetch(API, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Pekalongan HTTP ${response.status}`);
  const body = await response.json() as { streams?: unknown };
  const streams = body?.streams && typeof body.streams === 'object' ? body.streams as Record<string, Stream> : null;
  if (!streams) throw new Error('Pekalongan: unexpected payload');
  const cameras = parsePekalongan(streams);
  if (!cameras.length) throw new Error('Pekalongan: no public cameras in payload');
  return cameras;
}
