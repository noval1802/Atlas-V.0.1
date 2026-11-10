import { describe, expect, it } from 'vitest';
import { palembangCamera } from './palembang';

/** One record from cctv.palembang.go.id/api/cctv (Nov 2026). */
const RECORD = {
  _id: '6a8866f32840d934ee905309',
  cctv_id: 'CCTV-BSA-39',
  cctv_title: 'CCTV Bank Sumsel Atmo',
  cctv_scope: 'publik',
  cctv_status: 'active',
  cctv_link: 'https://stream.palembang.go.id/cam39/index.m3u8',
  location: { type: 'Point', coordinates: [104.75699830153796, -2.9807292478454235] },
  kecamatan: { namaKecamatan: 'ALANG-ALANG LEBAR' },
};

describe('palembang cameras', () => {
  it('maps a public record (GeoJSON lng,lat) to its direct HLS stream', () => {
    expect(palembangCamera(RECORD)).toEqual({
      id: 'palembang-6a8866f32840d934ee905309',
      lat: -2.9807292478454235,
      lng: 104.75699830153796,
      name: 'CCTV Bank Sumsel Atmo · Alang-Alang Lebar',
      city: 'Kota Palembang',
      country: 'Indonesia',
      source: 'CCTV Kota Palembang',
      stream_url: 'https://stream.palembang.go.id/cam39/index.m3u8',
      stream_type: 'hls',
    });
  });

  it('drops non-public, off-host and out-of-range records', () => {
    expect(palembangCamera({ ...RECORD, cctv_scope: 'privat' })).toBeNull();
    expect(palembangCamera({ ...RECORD, cctv_link: 'https://evil.example/cam39/index.m3u8' })).toBeNull();
    expect(palembangCamera({ ...RECORD, location: { coordinates: [0, 51.5] } })).toBeNull();
  });
});
