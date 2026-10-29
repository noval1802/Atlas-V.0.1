import { describe, expect, it } from 'vitest';
import { fetchSurakartaCameras } from './surakarta';

describe('surakarta cameras', () => {
  it('builds FLV cameras with in-bounds coords and direct stream URLs', async () => {
    const cams = await fetchSurakartaCameras();
    expect(cams.length).toBeGreaterThan(80);
    for (const c of cams) {
      expect(c.stream_type).toBe('flv');
      expect(c.city).toBe('Kota Surakarta');
      expect(c.stream_url).toMatch(
        /^https:\/\/surakarta\.atcsindonesia\.info:8086\/camera\/[A-Za-z0-9]+\.flv$/,
      );
      expect(c.lat).toBeGreaterThan(-12);
      expect(c.lat).toBeLessThan(7);
      expect(c.lng).toBeGreaterThan(94);
      expect(c.lng).toBeLessThan(142);
    }
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  });
});
