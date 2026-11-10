import { describe, expect, it } from 'vitest';
import { cirebonKotaCamera } from './cirebonkota';

/** One record from cctv.cirebonkota.go.id/api/status (Nov 2026). */
const RECORD = { slug: 'depan-ataqwa', name: 'Depan Masjid Raya At-Taqwa', online: true, lat: -6.710498, lon: 108.558485, kecamatan: 'Pekalipan' };
const upstream = 'https://cctv.cirebonkota.go.id/hls/depan-ataqwa/index.m3u8';

describe('cirebon kota cameras', () => {
  it('maps a record to a proxied HLS stream with kecamatan in the name', () => {
    expect(cirebonKotaCamera(RECORD)).toEqual({
      id: 'cirebonkota-depan-ataqwa',
      lat: -6.710498,
      lng: 108.558485,
      name: 'Depan Masjid Raya At-Taqwa · Pekalipan',
      city: 'Kota Cirebon',
      country: 'Indonesia',
      source: 'Cirebon Mata Hatiku',
      stream_url: `/api/cctv/hls?u=${encodeURIComponent(upstream)}`,
      stream_type: 'hls',
    });
  });

  it('drops a bad slug or coordinates outside Indonesia', () => {
    expect(cirebonKotaCamera({ ...RECORD, slug: '../etc' })).toBeNull();
    expect(cirebonKotaCamera({ ...RECORD, slug: '' })).toBeNull();
    expect(cirebonKotaCamera({ ...RECORD, lat: 51.5, lon: 0 })).toBeNull();
  });
});
