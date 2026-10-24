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

// Same hosts as the nginx tile location. Paths are the three the basemap style requests,
// optionally under the release prefix the live CARTO style uses (/v/20261001-03/...).
const CARTO_HOST = /^(?:(?:tiles-)?[a-d]\.|tiles\.)?basemaps\.cartocdn\.com$/;
const CARTO_PATH = /^\/(?:v\/[\w-]+\/)?(?:vectortiles|fonts|gl)\//;

/** A CARTO basemap URL the tile proxy may fetch: https, a known host, and a style path. */
export function isCartoTileUrl(url: URL): boolean {
  return url.protocol === 'https:' && !url.port && !url.username && CARTO_HOST.test(url.hostname.toLowerCase()) && CARTO_PATH.test(url.pathname);
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
