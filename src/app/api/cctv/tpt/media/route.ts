import { NextResponse } from 'next/server';
import { rewriteTptPlaylist, safeMediaPath, tptEmbedUrl } from '../../tpt';

export const dynamic = 'force-dynamic';

/**
 * Plays one TPT Flussonic camera without putting the portal session in the
 * browser. `file` is a path inside that camera's own directory.
 */
export async function GET(request: Request) {
  const token = process.env.TPT_CCTV_TOKEN;
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

  const upstream = await fetch(target, {
    headers: { Accept: '*/*', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Camera unavailable' }, { status: 502 });
  }

  const type = upstream.headers.get('content-type') ?? '';
  if (safeFile.endsWith('.m3u8') || type.includes('mpegurl') || type.includes('m3u8')) {
    const playlist = rewriteTptPlaylist(await upstream.text(), id, safeFile);
    return new NextResponse(playlist, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      },
    });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': type || 'video/mp2t',
      'Cache-Control': 'no-store',
    },
  });
}
