import { describe, expect, it } from 'vitest';
import { parseSemarang, semarangCamera } from './semarang';

const MARKER = { cctv_id: 414, owner_name: 'KYAI SALEH', lat: '-6.986660206981591', lng: '110.41393529540247' };
const LINK = {
  id: 307,
  name: 'KYAI SALEH',
  url: 'https://livepantau.semarangkota.go.id/b040a494-b725-4116-8fe2-4dbbea45d9bb/index.m3u8',
  status: 1,
};

describe('semarang cameras', () => {
  it('maps a marker link to a direct HLS stream', () => {
    const camera = semarangCamera(MARKER, LINK);
    expect(camera).toMatchObject({
      id: 'semarang-307',
      name: 'KYAI SALEH',
      city: 'Kota Semarang',
      source: 'Pantau Semar',
      stream_type: 'hls',
    });
    expect(camera?.stream_url).toBe(LINK.url);
  });

  it('rejects offline links, bad coords, and off-host URLs', () => {
    expect(semarangCamera(MARKER, { ...LINK, status: 0 })).toBeNull();
    expect(semarangCamera({ ...MARKER, lat: '51', lng: '0' }, LINK)).toBeNull();
    expect(semarangCamera(MARKER, { ...LINK, url: 'https://evil.example/x/index.m3u8' })).toBeNull();
  });

  it('scrapes inline markers, one camera per link', () => {
    const html = `junk ${JSON.stringify({ ...MARKER, links: [LINK, { ...LINK, id: 308 }] })} more`;
    const cams = parseSemarang(html);
    expect(cams.map(c => c.id)).toEqual(['semarang-307', 'semarang-308']);
  });
});
