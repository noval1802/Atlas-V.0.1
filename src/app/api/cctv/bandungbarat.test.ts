import { afterEach, describe, expect, it, vi } from 'vitest';
import { bandungBaratCamera, fetchBandungBaratCameras } from './bandungbarat';

/** One record from atcs.bandungbaratkab.go.id/get-cctv (Nov 2026). */
const RECORD = {
  nama_cctv: 'CIBURUY - CIPATAT',
  alias: 'ciburuy_cipatat',
  koordinat: '-6.833915591335607, 107.46786140543834',
  link: 'https://atcs-dishubkbb.urbanaccess.net/9512d5e6-2424-44f0-869a-4026ea91b2ed.html',
};

afterEach(() => vi.unstubAllGlobals());

describe('bandung barat cameras', () => {
  it('maps a record to the Restreamer HLS playlist behind its embed page', () => {
    expect(bandungBaratCamera(RECORD)).toEqual({
      id: 'bandungbarat-9512d5e6-2424-44f0-869a-4026ea91b2ed',
      lat: -6.833915591335607,
      lng: 107.46786140543834,
      name: 'Ciburuy - Cipatat',
      city: 'Kabupaten Bandung Barat',
      country: 'Indonesia',
      source: 'ATCS Dishub KBB',
      stream_url: 'https://atcs-dishubkbb.urbanaccess.net/memfs/9512d5e6-2424-44f0-869a-4026ea91b2ed.m3u8',
      stream_type: 'hls',
    });
  });

  it('keeps short codes upper-case in names', () => {
    expect(bandungBaratCamera({ ...RECORD, nama_cctv: 'PADALARANG - JL. SUNDIAL KBP - TOL' })?.name)
      .toBe('Padalarang - JL. Sundial KBP - Tol');
  });

  it('drops bad coordinates and links that are not a Restreamer channel on the known host', () => {
    expect(bandungBaratCamera({ ...RECORD, koordinat: '51.5, 0' })).toBeNull();
    expect(bandungBaratCamera({ ...RECORD, koordinat: 'x' })).toBeNull();
    expect(bandungBaratCamera({ ...RECORD, link: 'https://evil.example/9512d5e6-2424-44f0-869a-4026ea91b2ed.html' })).toBeNull();
    expect(bandungBaratCamera({ ...RECORD, link: 'https://atcs-dishubkbb.urbanaccess.net/../admin.html' })).toBeNull();
  });

  it('dedupes and throws when nothing usable comes back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: [RECORD, RECORD] })));
    expect(await fetchBandungBaratCameras()).toHaveLength(1);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: [{ ...RECORD, link: 'x' }] })));
    await expect(fetchBandungBaratCameras()).rejects.toThrow('no usable cameras');
  });
});
