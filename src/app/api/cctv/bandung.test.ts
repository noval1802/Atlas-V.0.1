import { describe, expect, it } from 'vitest';
import { bandungCamera } from './bandung';
import { rewriteHlsPlaylist } from './hls/route';

const REC = {
  id: '48a4d270-9db2-4111-b94e-d026129b2802',
  cctv_name: 'CCTV BATAS KOTA 01',
  lat: '-6.910573',
  lng: '107.569273',
  stream_cctv: 'https://pelindung.bandung.go.id:3443/video/DAHUA/BatasKo.m3u8',
  dinas: 'DISKOMINFO',
};

describe('bandung cameras', () => {
  it('maps a camera and routes its stream through the HLS proxy', () => {
    const camera = bandungCamera(REC);
    expect(camera).toMatchObject({
      id: 'bandung-48a4d270-9db2-4111-b94e-d026129b2802',
      name: 'CCTV BATAS KOTA 01 · DISKOMINFO',
      city: 'Kota Bandung',
      source: 'Pelindung Bandung',
      stream_type: 'hls',
    });
    expect(camera?.stream_url).toBe(
      '/api/cctv/hls?u=' + encodeURIComponent('https://pelindung.bandung.go.id:3443/video/DAHUA/BatasKo.m3u8'),
    );
  });

  it('rejects coordinates outside Indonesia, non-Bandung hosts, and missing playlists', () => {
    expect(bandungCamera({ ...REC, lat: '51', lng: '0' })).toBeNull();
    expect(bandungCamera({ ...REC, stream_cctv: 'https://evil.example/x.m3u8' })).toBeNull();
    expect(bandungCamera({ ...REC, stream_cctv: '' })).toBeNull();
  });
});

describe('hls proxy playlist rewrite', () => {
  const base = new URL('https://pelindung.bandung.go.id:3443/video/DAHUA/BatasKo.m3u8');

  it('rewrites relative segments to same-origin proxy URLs and leaves tags alone', () => {
    const out = rewriteHlsPlaylist('#EXTINF:13.7,\nBatasKo6.ts\n', base);
    expect(out).toContain('#EXTINF:13.7,');
    expect(out).toContain(
      '/api/cctv/hls?u=' + encodeURIComponent('https://pelindung.bandung.go.id:3443/video/DAHUA/BatasKo6.ts'),
    );
  });

  it('does not rewrite a segment that resolves to a non-allowlisted host', () => {
    const out = rewriteHlsPlaylist('https://evil.example/a.ts\n', base);
    expect(out).toContain('https://evil.example/a.ts');
    expect(out).not.toContain('/api/cctv/hls');
  });
});
