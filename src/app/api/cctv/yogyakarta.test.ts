import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchYogyakartaCameras, yogyakartaCamera } from './yogyakarta';

/** Shape of one record from cctv.jogjakota.go.id/home/getdata (Nov 2026). */
const RECORD = {
  cctv_id: '1',
  cctv_title: 'Simpang APMD (PTZ)',
  cctv_link: 'https://cctvjss.jogjakota.go.id/atcs/ATCS_apmd.stream/playlist.m3u8',
  cctv_latitude: '-7.791971853164589',
  cctv_longitude: '110.39164423942567',
  cctv_status: '0',
  kecamatan_nama: 'GONDOKUSUMAN',
};

afterEach(() => vi.unstubAllGlobals());

describe('yogyakarta cameras', () => {
  it('maps a public record to a direct HLS stream', () => {
    expect(yogyakartaCamera(RECORD)).toEqual({
      id: 'yogyakarta-1',
      lat: -7.791971853164589,
      lng: 110.39164423942567,
      name: 'Simpang Apmd (PTZ) · Gondokusuman',
      city: 'Kota Yogyakarta',
      country: 'Indonesia',
      source: 'CCTV Pemkot Yogyakarta',
      stream_url: RECORD.cctv_link,
      stream_type: 'hls',
    });
  });

  it('drops private or maintenance cameras, bad coordinates, and off-host or plain-http streams', () => {
    expect(yogyakartaCamera({ ...RECORD, cctv_status: '1' })).toBeNull();
    expect(yogyakartaCamera({ ...RECORD, cctv_status: '2' })).toBeNull();
    expect(yogyakartaCamera({ ...RECORD, cctv_latitude: '51', cctv_longitude: '0' })).toBeNull();
    expect(yogyakartaCamera({ ...RECORD, cctv_latitude: 'x' })).toBeNull();
    expect(yogyakartaCamera({ ...RECORD, cctv_link: 'https://evil.example/a/playlist.m3u8' })).toBeNull();
    expect(yogyakartaCamera({ ...RECORD, cctv_link: 'http://cctvjss.jogjakota.go.id/a/playlist.m3u8' })).toBeNull();
  });

  it('dedupes by id and throws when the payload has no usable camera', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([RECORD, RECORD, { ...RECORD, cctv_id: '2' }])));
    expect((await fetchYogyakartaCameras()).map(c => c.id)).toEqual(['yogyakarta-1', 'yogyakarta-2']);

    vi.stubGlobal('fetch', vi.fn(async () => Response.json([{ ...RECORD, cctv_status: '1' }])));
    await expect(fetchYogyakartaCameras()).rejects.toThrow('no public cameras');
  });
});
