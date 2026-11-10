import { describe, expect, it, vi } from 'vitest';
import { serangCamera } from './serang';

/** One feature from cctv.serangkota.go.id/api/cctv (Nov 2026); note the `:/` typo in rtsp_ip. */
const FEATURE = {
  type: 'Feature',
  properties: {
    id: 2,
    place_name: 'CCTV Ciceri 1',
    rtsp_ip: 'https://stream.serangkota.go.id:/LiveApp/play.html?name=ciceri1',
    status_cctv: 'on',
  },
  geometry: { type: 'Point', coordinates: ['106.17210296598', '-6.120359729315'] },
};

// safeFetch isn't exercised in these unit tests, but importing serang.ts pulls in ssrf-guard.
vi.mock('@/lib/ssrf-guard', () => ({ safeFetch: vi.fn() }));

describe('serang cameras', () => {
  it('turns the Ant Media embed into a direct HLS stream URL', () => {
    expect(serangCamera(FEATURE)).toEqual({
      id: 'serang-2',
      lat: -6.120359729315,
      lng: 106.17210296598,
      name: 'CCTV Ciceri 1',
      city: 'Kota Serang',
      country: 'Indonesia',
      source: 'CCTV Diskominfo Kota Serang',
      stream_url: 'https://stream.serangkota.go.id/LiveApp/streams/ciceri1.m3u8',
      stream_type: 'hls',
    });
  });

  it('drops off cameras, off-host embeds, bad names and out-of-range points', () => {
    expect(serangCamera({ ...FEATURE, properties: { ...FEATURE.properties, status_cctv: 'off' } })).toBeNull();
    expect(serangCamera({ ...FEATURE, properties: { ...FEATURE.properties, rtsp_ip: 'https://evil.example/LiveApp/play.html?name=x' } })).toBeNull();
    expect(serangCamera({ ...FEATURE, properties: { ...FEATURE.properties, rtsp_ip: 'https://stream.serangkota.go.id/LiveApp/play.html?name=../x' } })).toBeNull();
    expect(serangCamera({ ...FEATURE, geometry: { coordinates: ['0', '51.5'] } })).toBeNull();
  });
});
