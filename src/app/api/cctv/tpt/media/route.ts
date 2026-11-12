import { NextResponse } from 'next/server';
import { safeFetch } from '@/lib/ssrf-guard';
import { mediaHeaders } from '@/lib/media-proxy';
import { rewriteTptPlaylist, safeMediaPath, tptEmbedUrl } from '../../tpt';
import { getFlussonicStreamToken } from '../../tpt-flussonic';

export const dynamic = 'force-dynamic';

/**
 * Plays one TPT Flussonic camera without putting the portal session in the
 * browser. `file` is a path inside that camera's own directory.
 *
 * Flussonic rejects the portal access token; it needs a short-lived stream
 * token minted from it (see tpt-flussonic.ts).
 */
export async function GET(request: Request) {
  const token = await getFlussonicStreamToken();
  if (!token) return NextResponse.json({ error: 'TPT CCTV is not configured' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? '';
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) {
    return NextResponse.json({ error: 'Unknown camera' }, { status: 404 });
  }
  const file = searchParams.get('file') ?? 'index.m3u8';
  const safeFile = safeMediaPath(file);
  if (!safeFile) return NextResponse.json({ error: 'Unknown media' }, { status: 404 });

  const embed = await tptEmbedUrl(id);
  if (!embed) return NextResponse.json({ error: 'Unknown camera' }, { status: 404 });

  let target: URL;
  try {
    const root = new URL(embed);
    root.pathname = root.pathname.replace(/embed\.html$/, '');
    root.search = '';
    target = new URL(safeFile, root);
    if (target.origin !== root.origin || !target.pathname.startsWith(root.pathname)) {
      return NextResponse.json({ error: 'Unknown media' }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: 'Unknown media' }, { status: 404 });
  }
  target.searchParams.set('token', token);

  // The embed host comes from upstream data, so every hop must resolve to a public address.
  let upstream: Response;
  try {
    upstream = await safeFetch(target.toString(), {
      headers: { Accept: '*/*', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json({ error: 'Camera unavailable' }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Camera unavailable' }, { status: 502 });
  }

  const type = upstream.headers.get('content-type') ?? '';
  if (safeFile.endsWith('.m3u8') || type.includes('mpegurl') || type.includes('m3u8')) {
    const playlist = rewriteTptPlaylist(await upstream.text(), id, safeFile);
    return new NextResponse(playlist, {
      headers: mediaHeaders('application/vnd.apple.mpegurl'),
    });
  }

  return new NextResponse(upstream.body, {
    headers: mediaHeaders(type),
  });
}
