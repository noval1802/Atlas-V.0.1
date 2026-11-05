import { describe, it, expect } from 'vitest';
import { checkCameras, isOffline, probeTarget, withHealth } from './cctv-health';
import type { CatalogCamera } from './camera-catalog';

describe('probeTarget', () => {
  it('prefers the stream, then the still', () => {
    expect(probeTarget({ id: 1, stream_url: 'https://a/x.m3u8', feed_url: 'https://a/x.jpg' })).toBe('https://a/x.m3u8');
    expect(probeTarget({ id: 1, feed_url: 'https://a/x.jpg' })).toBe('https://a/x.jpg');
  });

  it('unwraps our own HLS proxy to the upstream it wraps', () => {
    const up = 'https://pelindung.bandung.go.id:3443/video/DAHUA/BatasKo.m3u8';
    expect(probeTarget({ id: 1, stream_url: `/api/cctv/hls?u=${encodeURIComponent(up)}` })).toBe(up);
  });

  it('skips session-bound routes and link-only cameras, flags cameras with nothing', () => {
    expect(probeTarget({ id: 1, stream_url: '/api/cctv/tpt/media?id=7' })).toBeNull();
    expect(probeTarget({ id: 1, external_url: 'https://jid.jasamarga.com/cctv2/k' })).toBeNull();
    expect(probeTarget({ id: 1 })).toBe('none');
  });
});

describe('checkCameras', () => {
  it('marks failed and empty cameras offline and leaves the rest untouched', async () => {
    const cameras: CatalogCamera[] = [
      { id: 'up', stream_url: 'https://ok/x.m3u8' },
      { id: 'down', stream_url: 'https://dead/x.m3u8' },
      { id: 'empty' },
      { id: 'link', external_url: 'https://site/cam' },
    ];
    const dead = await checkCameras(cameras, async url => url.startsWith('https://ok'));
    expect(dead).toBe(2);
    expect(['up', 'down', 'empty', 'link'].map(isOffline)).toEqual([false, true, true, false]);
    expect(withHealth(cameras).map(c => c.offline === true)).toEqual([false, true, true, false]);
    expect(cameras[1]).not.toHaveProperty('offline'); // the cached object is not mutated
  });
});
