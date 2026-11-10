import { describe, expect, it } from 'vitest';
import { bandarLampungCamera } from './bandarlampung';

/** One record from api-newseribuwajah.bandarlampungkota.go.id/cctvs (Nov 2026). */
const RECORD = {
  id: 19,
  name: 'JEMBATAN MILLENIAL 2 (PTZ)',
  category: 'Jalan Protokol',
  latitude: -5.42945503,
  longitude: 105.26151437,
  isHidden: false,
  status: 'online',
  streamUrl: 'https://stream-newseribuwajah.bandarlampungkota.go.id/cctv_19/index.m3u8',
  kelurahan: { name: 'SUMUR BATU', kecamatan: { name: 'TELUK BETUNG UTARA' } },
};

describe('bandar lampung cameras', () => {
  it('maps a visible online record to its HLS stream, with kecamatan in the name', () => {
    expect(bandarLampungCamera(RECORD)).toEqual({
      id: 'bandarlampung-19',
      lat: -5.42945503,
      lng: 105.26151437,
      name: 'JEMBATAN MILLENIAL 2 (PTZ) · Teluk Betung Utara',
      city: 'Kota Bandar Lampung',
      country: 'Indonesia',
      source: 'Seribu Wajah Bandar Lampung',
      stream_url: 'https://stream-newseribuwajah.bandarlampungkota.go.id/cctv_19/index.m3u8',
      stream_type: 'hls',
    });
  });

  it('drops hidden, offline, bad-coordinate and off-host records', () => {
    expect(bandarLampungCamera({ ...RECORD, isHidden: true })).toBeNull();
    expect(bandarLampungCamera({ ...RECORD, status: 'offline' })).toBeNull();
    expect(bandarLampungCamera({ ...RECORD, latitude: 51.5, longitude: 0 })).toBeNull();
    expect(bandarLampungCamera({ ...RECORD, streamUrl: 'https://evil.example/cctv_19/index.m3u8' })).toBeNull();
  });
});
