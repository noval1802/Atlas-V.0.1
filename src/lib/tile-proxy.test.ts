import { describe, expect, it } from 'vitest';
import { isCartoTileUrl, tileProxyPath, tileRequestUrl } from './tile-proxy';

const tile = 'https://tiles-b.basemaps.cartocdn.com/vectortiles/carto.streets/v1/5/25/16.mvt';
const origin = 'https://atlas.example';

describe('tileProxyPath', () => {
  it('accepts an absolute path and trims a trailing slash', () => {
    expect(tileProxyPath('/proxy/tiles/')).toBe('/proxy/tiles');
    expect(tileProxyPath(' /proxy/tiles ')).toBe('/proxy/tiles');
  });

  it('rejects empty, relative, and URL values', () => {
    expect(tileProxyPath(undefined)).toBeNull();
    expect(tileProxyPath('')).toBeNull();
    expect(tileProxyPath('proxy/tiles')).toBeNull();
    expect(tileProxyPath('https://evil.example/x')).toBeNull();
    expect(tileProxyPath('//evil.example')).toBeNull();
  });
});

describe('tileRequestUrl', () => {
  it('keeps the Next route when no proxy path is set', () => {
    expect(tileRequestUrl(tile, origin, null)).toBe(`${origin}/api/proxy-tiles?url=${encodeURIComponent(tile)}`);
  });

  it('maps CARTO hosts onto the nginx cache path', () => {
    expect(tileRequestUrl(tile, origin, '/proxy/tiles')).toBe(`${origin}/proxy/tiles/tiles-b.basemaps.cartocdn.com/vectortiles/carto.streets/v1/5/25/16.mvt`);
    expect(tileRequestUrl('https://tiles.basemaps.cartocdn.com/fonts/Open%20Sans/0-255.pbf', origin, '/proxy/tiles'))
      .toBe(`${origin}/proxy/tiles/tiles.basemaps.cartocdn.com/fonts/Open%20Sans/0-255.pbf`);
    expect(tileRequestUrl('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json?v=2', origin, '/proxy/tiles'))
      .toBe(`${origin}/proxy/tiles/basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json?v=2`);
  });

  it('leaves every other URL alone', () => {
    for (const url of ['https://example.com/a.png', 'https://cartocdn.com.evil.example/x', 'http://tiles.basemaps.cartocdn.com/x', '/vendor/x.js']) {
      expect(tileRequestUrl(url, origin, '/proxy/tiles')).toBe(url);
    }
  });
});

describe('isCartoTileUrl', () => {
  it('accepts the basemap hosts and style paths', () => {
    expect(isCartoTileUrl(new URL(tile))).toBe(true);
    expect(isCartoTileUrl(new URL('https://tiles.basemaps.cartocdn.com/fonts/Open%20Sans/0-255.pbf'))).toBe(true);
    expect(isCartoTileUrl(new URL('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'))).toBe(true);
    expect(isCartoTileUrl(new URL('https://tiles.basemaps.cartocdn.com/v/20261001-03/vectortiles/carto.streets/v2/4/14/6.mvt'))).toBe(true);
    expect(isCartoTileUrl(new URL('https://tiles.basemaps.cartocdn.com/v/20261001-03/fonts/Montserrat%20Medium/0-255.pbf'))).toBe(true);
  });

  it('rejects other CARTO hosts, other paths, ports and plain http', () => {
    for (const url of [
      'https://evil.cartocdn.com/vectortiles/x.mvt',
      'https://basemaps.cartocdn.com/anything/else',
      'https://basemaps.cartocdn.com/v/20261001-03/anything/else',
      'https://basemaps.cartocdn.com/v/../x/gl/y',
      'https://basemaps.cartocdn.com:8443/gl/x',
      'http://tiles.basemaps.cartocdn.com/fonts/x.pbf',
      'https://basemaps.cartocdn.com.evil.example/gl/x',
    ]) expect(isCartoTileUrl(new URL(url))).toBe(false);
  });
});
