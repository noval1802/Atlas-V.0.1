/**
 * Headers for a video segment re-served from a camera server.
 *
 * The upstream Content-Type is not trusted: a compromised camera server could
 * answer with text/html or SVG, and serving that same-origin would run its
 * script in an operator's ATLAS session. Only media types pass; anything else
 * goes out as opaque bytes, which hls.js/mpegts read the same way.
 */
const MEDIA_TYPE = /^(video\/[\w.+-]+|audio\/[\w.+-]+|application\/(octet-stream|mp4|vnd\.apple\.mpegurl|x-mpegurl))$/;

export function mediaType(upstream: string | null): string {
  const type = (upstream ?? '').split(';')[0].trim().toLowerCase();
  return MEDIA_TYPE.test(type) ? type : 'application/octet-stream';
}

export function mediaHeaders(upstream: string | null): Record<string, string> {
  return {
    'Content-Type': mediaType(upstream),
    'X-Content-Type-Options': 'nosniff',
    // The sandbox CSP for these routes is set in next.config.ts; a route-level one is overridden there.
    'Cache-Control': 'no-store',
  };
}
