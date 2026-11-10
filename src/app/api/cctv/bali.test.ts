import { describe, expect, it } from 'vitest';
import { baliCamera } from './bali';

/** One record from balisatudata.baliprov.go.id/api/v1/report-cctv (Nov 2026). */
const RECORD = {
  cctv_id: 297,
  lat: -8.6569866,
  lng: 115.2607693,
  ch_id: 'simpang-padang-galak',
  ch_name: 'Simpang Padang Galak',
  streaming_url: 'https://transcode.baliprov.go.id/cctv-player.html?id=simpang-padang-galak',
};

describe('bali cameras', () => {
  it('maps a record to the transcode HLS url behind its player', () => {
    expect(baliCamera(RECORD)).toEqual({
      id: 'bali-297',
      lat: -8.6569866,
      lng: 115.2607693,
      name: 'Simpang Padang Galak',
      city: 'Provinsi Bali',
      country: 'Indonesia',
      source: 'Satu Data Bali',
      stream_url: 'https://transcode.baliprov.go.id/cctv/simpang-padang-galak/index.m3u8',
      stream_type: 'hls',
    });
  });

  it('drops a bad slug, 0/0 point and out-of-range coordinates', () => {
    expect(baliCamera({ ...RECORD, ch_id: '../evil' })).toBeNull();
    expect(baliCamera({ ...RECORD, lat: 0, lng: 0 })).toBeNull();
    expect(baliCamera({ ...RECORD, lat: 51.5, lng: 0 })).toBeNull();
  });
});
