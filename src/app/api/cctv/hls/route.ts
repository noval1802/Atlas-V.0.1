import { NextResponse } from 'next/server';

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
 */
const ALLOWED_HOSTS = ['pelindung.bandung.go.id'];

function isAllowed(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.some(h => host === h || host.endsWith('.' + h));
}

const proxied = (absolute: string) => `/api/cctv/hls?u=${encodeURIComponent(absolute)}`;

/** Rewrite segment and sub-playlist references so the browser fetches them through here too. */
export function rewriteHlsPlaylist(body: string, base: URL): string {
  return body
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      // Attribute URIs (keys, maps) are not proxied — no allowlisted source uses them yet.
      // shortcut: plain segment/sub-playlist lines only, add URI="" rewriting if an encrypted source is added.
      if (trimmed.startsWith('#')) return line;
      let target: URL;
      try {
        target = new URL(trimmed, base);
      } catch {
        return line;
      }
      return isAllowed(target) ? proxied(target.toString()) : line;
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
    upstream = await fetch(target, {
      headers: { Accept: '*/*', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Camera unavailable' }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: 'Camera unavailable' }, { status: 502 });

  const type = upstream.headers.get('content-type') ?? '';
  if (target.pathname.endsWith('.m3u8') || type.includes('mpegurl') || type.includes('m3u8')) {
    const playlist = rewriteHlsPlaylist(await upstream.text(), target);
    return new NextResponse(playlist, {
      headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' },
    });
  }
  return new NextResponse(upstream.body, {
    headers: { 'Content-Type': type || 'video/mp2t', 'Cache-Control': 'no-store' },
  });
}
