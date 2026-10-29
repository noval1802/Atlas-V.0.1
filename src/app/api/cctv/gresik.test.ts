import { describe, expect, it } from 'vitest';
import { gresikCamera } from './gresik';

const REC = {
  id: 'de05c73a-459e-4e56-9bdf-f1d3245a5d56',
  name: 'BANDARA BAWEAN 1',
  status: 'online',
  hls_url: '/hls/bandara-bawean-1/index.m3u8',
  latitude: -5.727238338952839,
  longitude: 112.68248140811922,
};

describe('gresik cameras', () => {
  it('maps a camera to an absolute, direct HLS stream (no proxy)', () => {
    const camera = gresikCamera(REC);
    expect(camera).toMatchObject({
      id: 'gresik-de05c73a-459e-4e56-9bdf-f1d3245a5d56',
      name: 'BANDARA BAWEAN 1',
      city: 'Kabupaten Gresik',
      source: 'CCTV Kanjeng Gresik',
      stream_type: 'hls',
    });
    expect(camera?.stream_url).toBe('https://cctvkanjeng.gresikkab.go.id/hls/bandara-bawean-1/index.m3u8');
  });

  it('rejects bad coordinates, non-playlist paths, and absolute stream URLs', () => {
    expect(gresikCamera({ ...REC, latitude: 51, longitude: 0 })).toBeNull();
    expect(gresikCamera({ ...REC, hls_url: '/webrtc/bandara-bawean-1' })).toBeNull();
    expect(gresikCamera({ ...REC, hls_url: 'https://evil.example/x.m3u8' })).toBeNull();
    expect(gresikCamera({ ...REC, latitude: 'x' })).toBeNull();
  });
});
