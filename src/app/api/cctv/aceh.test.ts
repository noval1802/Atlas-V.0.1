import { describe, expect, it } from 'vitest';
import { acehCamera } from './aceh';

const REC = {
  id: 12,
  name: 'Bustanussalatin 7',
  region: 'Kecamatan Baiturrahman - Kampung Baru',
  url: 'https://api.bandaacehkota.go.id/cctv/5031c4f6-655d-4610-9adf-85a0f5f3b52e.html',
  latitude: '5.550149912709836',
  longitude: '95.3175013579752',
  is_active: true,
};

describe('banda aceh cameras', () => {
  it('derives the direct memfs HLS stream from the embed URL', () => {
    const camera = acehCamera(REC);
    expect(camera).toMatchObject({
      id: 'aceh-12',
      name: 'Bustanussalatin 7 · Kecamatan Baiturrahman - Kampung Baru',
      city: 'Kota Banda Aceh',
      source: 'CCTV Banda Aceh',
      stream_type: 'hls',
    });
    expect(camera?.stream_url).toBe(
      'https://api.bandaacehkota.go.id/cctv/memfs/5031c4f6-655d-4610-9adf-85a0f5f3b52e.m3u8',
    );
  });

  it('handles the alternate stream host', () => {
    const camera = acehCamera({
      ...REC,
      id: 71,
      url: 'https://cctv-stream.bandaacehkota.info/4d43bfe3-89a4-4858-9715-51085407a3c0.html',
    });
    expect(camera?.stream_url).toBe(
      'https://cctv-stream.bandaacehkota.info/memfs/4d43bfe3-89a4-4858-9715-51085407a3c0.m3u8',
    );
  });

  it('rejects offline cameras, bad coords, and unknown hosts', () => {
    expect(acehCamera({ ...REC, is_active: false })).toBeNull();
    expect(acehCamera({ ...REC, latitude: '51', longitude: '0' })).toBeNull();
    expect(acehCamera({ ...REC, url: 'https://evil.example/x.html' })).toBeNull();
  });
});
