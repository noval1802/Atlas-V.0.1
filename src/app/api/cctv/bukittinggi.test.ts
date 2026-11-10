import { describe, expect, it } from 'vitest';
import { bukittinggiLocationCameras } from './bukittinggi';

const stream = (slug: string) => `https://hls.bukittinggikota.go.id/hls1/TOKEN/hls/X/${slug}/s.m3u8`;
/** One location from hls.bukittinggikota.go.id/api/get-list-camera (Nov 2026). */
const LOCATION = {
  id: 1,
  nama_lokasi: 'Simpang Pasar Banto',
  latitude: '-0.30225196',
  longitude: '100.37133447',
  listCamera: [{ nama_kamera: '[D1]', stream_url: stream('cam1d1') }],
};

describe('bukittinggi cameras', () => {
  it('maps a single-camera location to one HLS camera at its point', () => {
    expect(bukittinggiLocationCameras(LOCATION)).toEqual([{
      id: 'bukittinggi-1-0',
      lat: -0.30225196,
      lng: 100.37133447,
      name: 'Simpang Pasar Banto [D1]',
      city: 'Kota Bukittinggi',
      country: 'Indonesia',
      source: 'CCTV Kota Bukittinggi',
      stream_url: stream('cam1d1'),
      stream_type: 'hls',
    }]);
  });

  it('spreads cameras that share a location so markers do not stack', () => {
    const cams = bukittinggiLocationCameras({ ...LOCATION, listCamera: [
      { nama_kamera: '[D1]', stream_url: stream('cam1d1') },
      { nama_kamera: '[D2]', stream_url: stream('cam1d2') },
    ] });
    expect(cams).toHaveLength(2);
    expect([cams[0].lat, cams[0].lng]).not.toEqual([cams[1].lat, cams[1].lng]);
    expect(Math.abs(cams[0].lng - 100.37133447)).toBeLessThan(0.0002);
  });

  it('drops off-host streams and locations with bad coordinates', () => {
    expect(bukittinggiLocationCameras({ ...LOCATION, listCamera: [{ nama_kamera: 'x', stream_url: 'https://evil.example/s.m3u8' }] })).toEqual([]);
    expect(bukittinggiLocationCameras({ ...LOCATION, latitude: '51', longitude: '0' })).toEqual([]);
  });
});
