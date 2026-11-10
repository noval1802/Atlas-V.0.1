import { describe, expect, it } from 'vitest';
import { parseTasikmalaya, tasikmalayaCamera } from './tasikmalaya';

/** One entry from the inline `cctv` object on atcs.tasikmalayakota.go.id (Nov 2026). */
const RECORD = {
  id: '15',
  nama: 'Batas Kota Arah Bandung',
  jenis: 'PTZ',
  link: 'https://atcs.tasikmalayakota.go.id/camera/bataskotaarahbandung.m3u8',
  lokasi_lat: '-7.27380239',
  lokasi_lng: '108.19348812',
};

describe('tasikmalaya cameras', () => {
  it('maps an inline record to its direct HLS stream with the camera type in the name', () => {
    expect(tasikmalayaCamera(RECORD)).toEqual({
      id: 'tasikmalaya-15',
      lat: -7.27380239,
      lng: 108.19348812,
      name: 'Batas Kota Arah Bandung (PTZ)',
      city: 'Kota Tasikmalaya',
      country: 'Indonesia',
      source: 'ATCS Kota Tasikmalaya',
      stream_url: 'https://atcs.tasikmalayakota.go.id/camera/bataskotaarahbandung.m3u8',
      stream_type: 'hls',
    });
  });

  it('drops bad coordinates and off-host streams', () => {
    expect(tasikmalayaCamera({ ...RECORD, lokasi_lat: '0', lokasi_lng: '0' })).toBeNull();
    expect(tasikmalayaCamera({ ...RECORD, lokasi_lat: '51.5', lokasi_lng: '0' })).toBeNull();
    expect(tasikmalayaCamera({ ...RECORD, link: 'https://evil.example/camera/x.m3u8' })).toBeNull();
  });

  it('reads the inline cctv object and dedupes', () => {
    const html = `<script>var cctv = ${JSON.stringify({ '15': RECORD, '5': { ...RECORD, id: '5', nama: 'Simpang Wasita' } })};</script>`;
    // JS orders integer-like object keys numerically, so 5 comes before 15.
    expect(parseTasikmalaya(html).map(c => c.id).sort()).toEqual(['tasikmalaya-15', 'tasikmalaya-5']);
  });
});
