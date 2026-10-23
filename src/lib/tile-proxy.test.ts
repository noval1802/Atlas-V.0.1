import { describe, expect, it } from 'vitest';
import { tileProxyPath, tileRequestUrl } from './tile-proxy';

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
