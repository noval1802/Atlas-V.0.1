import { describe, expect, it } from 'vitest';
import { balanganCamera, parseBalangan } from './balangan';
import { rewriteHlsPlaylist } from './hls/route';

/** Markup copied from cctv.balangankab.go.id/peta (Nov 2026). */
const tag = (over: Record<string, string> = {}) => {
  const a = {
    id: '34', lat: '-2.33611803', lng: '115.46003189', slug: 'bundaran-paringin-area',
    nama: 'Bundaran Paringin (area)', status: 'online',
    hls: 'https://cctv.balangankab.go.id/hls/bundaran-paringin-area/index.m3u8', ...over,
  };
  return `<a href="#" class="list-group-item list-group-item-action py-2 map-sidebar-cctv"
                       data-id="${a.id}" data-lat="${a.lat}" data-lng="${a.lng}"
                       data-slug="${a.slug}" data-nama="${a.nama}" data-status="${a.status}"
                       data-hls="${a.hls}">`;
};

describe('balangan cameras', () => {
  it('maps an online entry to a proxied HLS stream', () => {
    expect(balanganCamera(tag(), 'PARINGIN')).toEqual({
      id: 'balangan-34',
      lat: -2.33611803,
      lng: 115.46003189,
      name: 'Bundaran Paringin (area) · Paringin',
      city: 'Kabupaten Balangan',
      country: 'Indonesia',
      source: 'CCTV Kab. Balangan',
      stream_url: '/api/cctv/hls?u=https%3A%2F%2Fcctv.balangankab.go.id%2Fhls%2Fbundaran-paringin-area%2Findex.m3u8',
      stream_type: 'hls',
    });
  });

  it('drops offline or maintenance entries, bad coordinates and off-host streams', () => {
    expect(balanganCamera(tag({ status: 'offline' }), '')).toBeNull();
    expect(balanganCamera(tag({ status: 'maintenance' }), '')).toBeNull();
    expect(balanganCamera(tag({ lat: '51', lng: '0' }), '')).toBeNull();
    expect(balanganCamera(tag({ hls: 'https://evil.example/hls/x/index.m3u8' }), '')).toBeNull();
  });

  it('assigns each camera the kecamatan block it sits in and dedupes ids', () => {
    const html = `<div class="wilayah-block" data-wilayah="PARINGIN">${tag()}${tag()}</div>
      <div class="wilayah-block" data-wilayah="PARINGIN SELATAN">${tag({ id: '2', nama: 'Depan Diskominfo (utama)' })}</div>`;
    expect(parseBalangan(html).map(c => c.name)).toEqual([
      'Bundaran Paringin (area) · Paringin',
      'Depan Diskominfo (utama) · Paringin Selatan',
    ]);
  });

  it('is allowlisted in the HLS proxy so chunk playlists are rewritten through it', () => {
    const base = new URL('https://cctv.balangankab.go.id/hls/bundaran-paringin-area/index.m3u8');
    expect(rewriteHlsPlaylist('#EXTM3U\nstream_0.m3u8', base)).toContain('/api/cctv/hls?u=');
  });

  /* Balangan serves fMP4 LL-HLS: the init segment and parts are attribute URIs.
     Left relative, the browser resolved them against /api/cctv/ and got 404s. */
  it('rewrites attribute URIs (init map, parts) and leaves off-host ones alone', () => {
    const base = new URL('https://cctv.balangankab.go.id/hls/x/video1_stream.m3u8');
    const out = rewriteHlsPlaylist(
      '#EXT-X-MAP:URI="abc_init.mp4"\n#EXT-X-PART:DURATION=0.2,URI="seg1.0.m4s"\n#EXT-X-KEY:METHOD=AES-128,URI="https://evil.example/k"',
      base,
    ).split('\n');
    expect(out[0]).toBe(`#EXT-X-MAP:URI="/api/cctv/hls?u=${encodeURIComponent('https://cctv.balangankab.go.id/hls/x/abc_init.mp4')}"`);
    expect(out[1]).toContain('URI="/api/cctv/hls?u=');
    expect(out[2]).toBe('#EXT-X-KEY:METHOD=AES-128,URI="https://evil.example/k"');
  });
});
