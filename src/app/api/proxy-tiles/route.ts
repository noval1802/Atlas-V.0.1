import { NextRequest, NextResponse } from 'next/server';
import { isCartoTileUrl } from '@/lib/tile-proxy';

const TILE_TYPE = /^(image\/(png|jpeg|webp)|application\/(x-protobuf|vnd\.mapbox-vector-tile|json|octet-stream))$/;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    /* Only the basemap hosts and paths: every distinct URL becomes an entry in
       the year-long fetch cache, so an open *.cartocdn.com rule let a caller
       fill the disk with arbitrary keys. */
    const targetUrl = new URL(url);
    if (!isCartoTileUrl(targetUrl)) {
      return NextResponse.json({ error: 'Forbidden domain' }, { status: 403 });
    }

    const response = await fetch(targetUrl.toString(), { signal: AbortSignal.timeout(15000),
      headers: {
        'Accept': '*/*',
        // CARTO's basemap CDN 403s unknown User-Agents; it serves browser traffic.
        'User-Agent': 'Mozilla/5.0',
      },
      // Using Next.js fetch cache options to heavily cache tiles locally
      next: {
        revalidate: 31536000, // Cache for 1 year
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch tile' }, { status: response.status });
    }

    const data = await response.arrayBuffer();
    
    // Only tile, glyph and sprite types pass; anything else (HTML, SVG) goes out as opaque bytes.
    const upstreamType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const contentType = TILE_TYPE.test(upstreamType) ? upstreamType : 'application/octet-stream';

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error('Tile proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
