import { describe, expect, it } from 'vitest';
import { medanLocationCameras } from './medan';

/** One location from atcsdishub.medan.go.id/api/v3/pv/ldevice (Nov 2026), rtsp url_video omitted on purpose. */
const LOCATION = {
  id_lokasi: 1,
  nama_lokasi: 'RADEN SALEH - BALAI KOTA',
  lat_lokasi: 3.590017,
  lon_lokasi: 98.67763,
  is_active: true,
  tb_device_lokasi: [{ nama_alias: 'SIMPANG LAPANGAN MERDEKA', url_proxy_hls: 'https://atcsdishub.medan.go.id/stream/L1RADENSALEHBALAIKOTA/' }],
};

describe('medan cameras', () => {
  it('maps a location to a direct HLS camera and never exposes the rtsp url', () => {
    const cams = medanLocationCameras({ ...LOCATION, tb_device_lokasi: [{ ...LOCATION.tb_device_lokasi[0], url_video: 'rtsp://admin:secret@10.33.114.240/Streaming' }] });
    expect(cams).toEqual([{
      id: 'medan-1-0',
      lat: 3.590017,
      lng: 98.67763,
      name: 'Raden Saleh - Balai Kota',
      city: 'Kota Medan',
      country: 'Indonesia',
      source: 'ITS Kota Medan',
      stream_url: 'https://atcsdishub.medan.go.id/stream/L1RADENSALEHBALAIKOTA/index.m3u8',
      stream_type: 'hls',
    }]);
    expect(JSON.stringify(cams)).not.toContain('rtsp');
    expect(JSON.stringify(cams)).not.toContain('10.33');
  });

  it('skips inactive locations, bad coordinates and off-host proxy URLs', () => {
    expect(medanLocationCameras({ ...LOCATION, is_active: false })).toEqual([]);
    expect(medanLocationCameras({ ...LOCATION, lat_lokasi: 51.5, lon_lokasi: 0 })).toEqual([]);
    expect(medanLocationCameras({ ...LOCATION, tb_device_lokasi: [{ url_proxy_hls: 'https://evil.example/stream/x/' }] })).toEqual([]);
  });

  it('spreads and labels multiple devices at one location', () => {
    const cams = medanLocationCameras({ ...LOCATION, tb_device_lokasi: [
      { nama_alias: 'CAM A', url_proxy_hls: 'https://atcsdishub.medan.go.id/stream/A/' },
      { nama_alias: 'CAM B', url_proxy_hls: 'https://atcsdishub.medan.go.id/stream/B/' },
    ] });
    expect(cams.map(c => c.name)).toEqual(['Raden Saleh - Balai Kota · Cam A', 'Raden Saleh - Balai Kota · Cam B']);
    expect([cams[0].lat, cams[0].lng]).not.toEqual([cams[1].lat, cams[1].lng]);
  });
});
