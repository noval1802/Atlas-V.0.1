import { describe, expect, it } from 'vitest';
import { playerFor, rewriteTptPlaylist, safeMediaPath, tptCamera } from './tpt';

const session = 'portal-session-cookie-value';

describe('TPT cameras', () => {
  it('plays a Flussonic embed through the server and leaves the session off the camera', () => {
    const mapped = tptCamera({
      id: 'cam-1',
      site_name: 'Stasiun Grogol-C01',
      dinas_name: 'Dishub',
      kota_name: 'Jakarta Barat',
      lat: -6.162,
      lng: 106.79,
      is_active: true,
      link_embed: `https://cctv-diskominfotik.balitower.co.id:10211/stream/embed.html?token=${session}`,
    });
    expect(mapped?.camera).toMatchObject({
      id: 'tpt-cam-1',
      name: 'Stasiun Grogol-C01 · Dishub',
      city: 'Jakarta Barat',
      stream_type: 'hls',
      stream_url: '/api/cctv/tpt/media?id=cam-1',
      source: 'TPT CCTV',
    });
    expect(mapped?.embed).toBe('https://cctv-diskominfotik.balitower.co.id:10211/stream/embed.html');
    const packed = JSON.stringify(mapped?.camera);
    expect(packed.includes(session)).toBe(false);
    expect(packed.includes('rtsp://')).toBe(false);
  });

  it('keeps a browser player that does not need the portal session', () => {
    const mapped = tptCamera({
      id: 'webrtc1',
      site_name: 'RPTRA Marunda',
      kota_name: 'Jakarta Utara',
      lat: -6.12,
      lng: 106.95,
      link_embed: 'http://103.164.12.208:5080/WebRTCApp/play.html?id=abc12345&playOrder=hls',
    });
    expect(mapped?.camera.stream_type).toBe('iframe');
    expect(mapped?.camera.stream_url).toContain('play.html?id=abc12345');
    expect(mapped?.embed).toBeUndefined();
  });

  it('drops a camera outside Indonesia or aimed at a private encoder', () => {
    expect(tptCamera({
      id: 'paris1',
      lat: 48.8,
      lng: 2.3,
      link_embed: 'https://example.com/a/embed.html',
    })).toBeNull();
    const mapped = tptCamera({
      id: 'local1',
      site_name: 'Encoder',
      lat: -6.2,
      lng: 106.8,
      link_embed: 'http://10.17.2.117/embed.html',
    });
    expect(mapped?.camera.stream_url).toBeUndefined();
    expect(JSON.stringify(mapped).includes('10.17')).toBe(false);
  });

  it('rewrites playlist entries onto this server and drops the session query', () => {
    const master = rewriteTptPlaylist(
      `#EXTM3U\ntracks-v1/mono.ts.m3u8?token=${session}`,
      'cam-1',
      'index.m3u8',
    );
    const media = rewriteTptPlaylist(
      `#EXTINF:5.000,\n2026/10/02/11/38/07-05000.ts?token=${session}`,
      'cam-1',
      'tracks-v1/mono.ts.m3u8',
    );
    expect(master).toContain('/api/cctv/tpt/media?id=cam-1&file=tracks-v1%2Fmono.ts.m3u8');
    expect(media).toContain('file=tracks-v1%2F2026%2F10%2F02%2F11%2F38%2F07-05000.ts');
    expect(master.includes(session)).toBe(false);
    expect(media.includes(session)).toBe(false);
    expect(safeMediaPath('../secret.ts')).toBeNull();
    expect(safeMediaPath('https://other.example/a.ts')).toBeNull();
  });

  it('recognises the three published player shapes', () => {
    expect(playerFor('https://vms1.jsclab.id/vsaas/embed/jalan?token=abc').stream_type).toBe('iframe');
    expect(playerFor('https://rtc.transjakarta.co.id/stream.html?src=halte').stream_type).toBe('iframe');
    expect(playerFor('notaurl')).toEqual({});
  });
});
