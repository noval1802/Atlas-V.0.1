import { describe, expect, it } from 'vitest';
import { parsePekalongan, pekalonganChannelCamera } from './pekalongan';

const UUID = '089e9315-6dd5-4d33-a8eb-cd9b164cff32';
/** One channel from cctv.pekalongankota.go.id/api/config, rtsp url omitted on purpose. */
const CH = { latitude: '-6.8897', longitude: '109.6780', name: 'ATCS Simpang Dr. Cipto PTZ', on_demand: 1, public: 1 };

describe('pekalongan cameras', () => {
  it('maps a public channel to the relay HLS url and never exposes rtsp', () => {
    const camera = pekalonganChannelCamera(UUID, '0', { ...CH, url: 'rtsp://atcs:p3kalongan!@10.28.110.54:554/Streaming' } as typeof CH, 'ATCS');
    expect(camera).toEqual({
      id: `pekalongan-${UUID}-0`,
      lat: -6.8897,
      lng: 109.678,
      name: 'ATCS Simpang Dr. Cipto PTZ',
      city: 'Kota Pekalongan',
      country: 'Indonesia',
      source: 'CCTV Kota Pekalongan',
      stream_url: `https://cctv.pekalongankota.go.id/stream/${UUID}/channel/0/hls/live/index.m3u8`,
      stream_type: 'hls',
    });
    expect(JSON.stringify(camera)).not.toContain('rtsp');
    expect(JSON.stringify(camera)).not.toContain('10.28');
  });

  it('drops non-public channels, 0/0 coordinates and bad uuids', () => {
    expect(pekalonganChannelCamera(UUID, '0', { ...CH, public: 0 }, '')).toBeNull();
    expect(pekalonganChannelCamera(UUID, '0', { ...CH, latitude: '0', longitude: '0' }, '')).toBeNull();
    expect(pekalonganChannelCamera('not-a-uuid!', '0', CH, '')).toBeNull();
  });

  it('flattens streams into one camera per public channel', () => {
    const cams = parsePekalongan({
      [UUID]: { category: 'atcs', name: 'Node A', channels: { '0': CH, '1': { ...CH, public: 0 } } },
    });
    expect(cams.map(c => c.id)).toEqual([`pekalongan-${UUID}-0`]);
  });
});
