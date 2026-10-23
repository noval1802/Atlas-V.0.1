/**
 * Where the map fetches CARTO basemap requests (vector tiles, sprite, glyphs).
 *
 * With no path configured, requests go through the Next route /api/proxy-tiles,
 * which costs a session lookup and an upstream fetch per tile. Behind the
 * bundled nginx, set TILE_PROXY_PATH=/proxy/tiles so nginx serves them from its
 * on-disk cache and Node never sees a tile.
 */

/** Accepts only an absolute path such as "/proxy/tiles"; anything else falls back to the Next route. */
export function tileProxyPath(value: string | undefined): string | null {
  const path = value?.trim().replace(/\/+$/, '') ?? '';
  return /^\/[A-Za-z0-9/_-]+$/.test(path) ? path : null;
}

/** Rewrites a CARTO URL to the proxy; any other URL is returned unchanged. */
export function tileRequestUrl(url: string, origin: string, proxyPath: string | null): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || (host !== 'cartocdn.com' && !host.endsWith('.cartocdn.com'))) return url;
  if (proxyPath) return `${origin}${proxyPath}/${host}${parsed.pathname}${parsed.search}`;
  return `${origin}/api/proxy-tiles?url=${encodeURIComponent(url)}`;
}
