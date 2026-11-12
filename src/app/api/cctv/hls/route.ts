import { NextResponse } from 'next/server';
import { safeFetch } from '@/lib/ssrf-guard';
import { mediaHeaders } from '@/lib/media-proxy';

export const dynamic = 'force-dynamic';

/**
 * Generic HLS proxy for public cameras whose CORS header names their own site
 * instead of `*`, so hls.js in the browser cannot read them cross-origin. We
 * fetch the playlist and segments server-side and re-serve them same-origin,
 * rewriting each playlist line back through this route.
 *
 * SSRF guard: only the hosts below are reachable, and only http(s). The target
 * is the full upstream URL in `u`; segment and sub-playlist URLs are resolved
 * against it and themselves checked against the allowlist before rewriting.
 * safeFetch re-checks every redirect hop, so an allowlisted host cannot bounce
 * the server to a private address.
 */
// cctv.balangankab.go.id: sends Access-Control-Allow-Origin twice, which browsers reject.
// cctv-dishub.tangerangkab.go.id: playlists carry no CORS header at all.
const ALLOWED_HOSTS = ['pelindung.bandung.go.id', 'cctv.balangankab.go.id', 'cctv-dishub.tangerangkab.go.id', 'cctv.cirebonkota.go.id'];

function isAllowed(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.some(h => host === h || host.endsWith('.' + h));
}

const proxied = (absolute: string) => `/api/cctv/hls?u=${encodeURIComponent(absolute)}`;

function resolve(reference: string, base: URL): URL | null {
  try {
    return new URL(reference, base);
  } catch {
    return null;
  }
}

/** Rewrite segment and sub-playlist references so the browser fetches them through here too. */
export function rewriteHlsPlaylist(body: string, base: URL): string {
  return body
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      // Tags carry URIs in attributes: fMP4 init (EXT-X-MAP), LL-HLS parts and preload hints, keys.
      if (trimmed.startsWith('#')) return line.replace(/URI="([^"]*)"/g, (match, uri: string) => {
        const target = resolve(uri, base);
        return target && isAllowed(target) ? `URI="${proxied(target.toString())}"` : match;
      });
      const target = resolve(trimmed, base);
      return target && isAllowed(target) ? proxied(target.toString()) : line;
    })
    .join('\n');
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u') ?? '';
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Bad URL' }, { status: 400 });
  }
  if (!isAllowed(target)) return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });

  let upstream: Response;
  try {
    upstream = await safeFetch(target.toString(), {
      headers: { Accept: '*/*', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json({ error: 'Camera unavailable' }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: 'Camera unavailable' }, { status: 502 });

  const type = upstream.headers.get('content-type') ?? '';
  if (target.pathname.endsWith('.m3u8') || type.includes('mpegurl') || type.includes('m3u8')) {
    const playlist = rewriteHlsPlaylist(await upstream.text(), target);
    return new NextResponse(playlist, {
      headers: mediaHeaders('application/vnd.apple.mpegurl'),
    });
  }
  return new NextResponse(upstream.body, {
    headers: mediaHeaders(type),
  });
}
