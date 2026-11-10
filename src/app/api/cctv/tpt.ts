import type { CctvCamera, CctvStreamType } from './types';
import { getTptAccessToken } from '@/lib/tpt-vault';
import { isIP } from 'node:net';
import { isPublicIp } from '@/lib/ssrf-guard';

/**
 * Jakarta TPT cameras from `https://api.e-smarteye.com/api/releases/tpt_cctv/`.
 *
 * The release list is behind the portal session cookie. That cookie stays on
 * the server. The list also sits next to a detail record with private encoder
 * addresses; this module never requests that record.
 *
 * Balitower pictures are Flussonic embeds. The streamer repeats the session
 * on every playlist and segment, so those cameras are played through
 * `/api/cctv/tpt/media`, which adds the cookie only on the upstream request.
 */

const LIST_URL = 'https://api.e-smarteye.com/api/releases/tpt_cctv/';
const INDEX_TTL_MS = 30 * 60 * 1000;

export type TptRecord = {
  id?: unknown;
  cctv_name?: unknown;
  site_name?: unknown;
  kota_name?: unknown;
  dinas_name?: unknown;
  lat?: unknown;
  lng?: unknown;
  is_active?: unknown;
  link_embed?: unknown;
};

type Index = {
  at: number;
  cameras: CctvCamera[];
  embeds: Map<string, string>;
};

let index: Index | null = null;
let inflight: Promise<Index | null> | null = null;
let indexEpoch = 0;

export function tptCamera(row: TptRecord): { camera: CctvCamera; embed?: string } | null {
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;
  if (row.is_active === false || row.is_active === 0 || row.is_active === '0') return null;

  const id = text(row.id);
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return null;
  const site = text(row.site_name) || text(row.cctv_name) || `CCTV ${id}`;
  const agency = text(row.dinas_name);
  const camera: CctvCamera = {
    id: `tpt-${id}`,
    lat,
    lng,
    name: agency ? `${site} · ${agency}` : site,
    city: text(row.kota_name) || 'Jakarta',
    country: 'Indonesia',
    source: 'TPT CCTV',
  };
  const player = playerFor(text(row.link_embed));
  if (player.stream_url) {
    camera.stream_url = player.stream_url.replace('{id}', encodeURIComponent(id));
    camera.stream_type = player.stream_type;
  }
  if (player.external_url) camera.external_url = player.external_url;
  return { camera, embed: player.embed };
}

/**
 * Decide how a published player address is shown.
 * `{id}` in `stream_url` is filled with the camera id. `embed` is the
 * upstream page the media proxy is allowed to read, and only for Flussonic.
 */
export function playerFor(embed: string): {
  stream_url?: string;
  stream_type?: CctvStreamType;
  external_url?: string;
  embed?: string;
} {
  let url: URL;
  try {
    url = new URL(embed);
  } catch {
    return {};
  }
  if (url.username || url.password) return {};
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return {};
  if (isPrivateHost(url.hostname)) return {};
  url.hash = '';

  if (url.pathname.endsWith('/embed.html')) {
    url.search = '';
    return {
      stream_url: '/api/cctv/tpt/media?id={id}',
      stream_type: 'hls',
      embed: url.toString(),
    };
  }
  if (
    url.pathname.endsWith('/play.html')
    || url.pathname.endsWith('/stream.html')
    || url.pathname.includes('/vsaas/embed/')
  ) {
    return {
      stream_url: url.toString(),
      stream_type: 'iframe',
      external_url: url.toString(),
    };
  }
  return {};
}

export function rewriteTptPlaylist(body: string, id: string, playlistFile: string): string {
  const slash = playlistFile.lastIndexOf('/');
  const dir = slash >= 0 ? playlistFile.slice(0, slash + 1) : '';
  return body.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const file = safeMediaPath(dir + trimmed.split('?')[0].split('#')[0]);
    if (!file) return '';
    return `/api/cctv/tpt/media?id=${encodeURIComponent(id)}&file=${encodeURIComponent(file)}`;
  }).filter(line => line !== '').join('\n');
}

/** Keep a media path inside one camera directory. */
export function safeMediaPath(file: string): string | null {
  if (!file || file.startsWith('/') || file.includes('\\') || file.includes('?') || file.includes('#')) return null;
  const stack: string[] = [];
  for (const part of file.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') return null;
    if (!/^[\w.-]+$/.test(part)) return null;
    stack.push(part);
  }
  const joined = stack.join('/');
  if (!/\.(m3u8|ts)$/i.test(joined)) return null;
  return joined;
}

export async function fetchTptCameras(): Promise<CctvCamera[]> {
  const loaded = await loadIndex();
  return loaded?.cameras ?? [];
}

export async function tptEmbedUrl(id: string): Promise<string | null> {
  const loaded = await loadIndex();
  return loaded?.embeds.get(id) ?? null;
}

/** Drop the cached Jakarta list so the next read uses the current cookie. */
export function clearTptIndex(): void {
  indexEpoch += 1;
  index = null;
  inflight = null;
}

async function loadIndex(): Promise<Index | null> {
  if (index && Date.now() - index.at < INDEX_TTL_MS && index.cameras.length) return index;
  if (!inflight) {
    const current = readIndex().finally(() => {
      if (inflight === current) inflight = null;
    });
    inflight = current;
  }
  return inflight;
}

async function readIndex(): Promise<Index | null> {
  const epoch = indexEpoch;
  const token = await getTptAccessToken();
  if (!token) return index;
  const response = await fetch(LIST_URL, {
    headers: {
      Accept: 'application/json',
      Cookie: `access_token=${token}`,
      'User-Agent': 'Mozilla/5.0',
    },
    signal: AbortSignal.timeout(60_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`TPT CCTV HTTP ${response.status}`);
  const body = await response.json() as { data?: TptRecord[] };
  const cameras: CctvCamera[] = [];
  const embeds = new Map<string, string>();
  for (const row of body.data ?? []) {
    const mapped = tptCamera(row);
    if (!mapped) continue;
    cameras.push(mapped.camera);
    if (mapped.embed) embeds.set(text(row.id), mapped.embed);
  }
  if (epoch !== indexEpoch) return null;
  if (!cameras.length && index?.cameras.length) return index;
  index = { at: Date.now(), cameras, embeds };
  return index;
}

/** Literal private addresses are dropped at map time; hostnames are checked again at fetch time by safeFetch. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local')) return true;
  return isIP(host) !== 0 && !isPublicIp(host);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}
