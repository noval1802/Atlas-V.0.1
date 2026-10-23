import { describe, expect, it } from 'vitest';
import type { WatchedCamera } from './dashboard-state';
import { autoGrid, isSpaceCam, parseSpaceCams, toggleSpaceCam } from './space-cams';

const cam = (id: number, extra: Record<string, unknown> = {}): WatchedCamera => ({ id, lat: -6.2 + id, lng: 106.8, name: `CAM ${id}`, ...extra });

describe('space cams', () => {
  it('adds, recognises, and removes a camera', () => {
    const one = toggleSpaceCam([], cam(1));
    expect(isSpaceCam(one, cam(1))).toBe(true);
    expect(isSpaceCam(one, cam(2))).toBe(false);
    expect(toggleSpaceCam(one, cam(1))).toEqual([]);
  });

  it('identifies a camera without an id by its position', () => {
    const noId = { lat: 1, lng: 2, name: 'x' };
    expect(isSpaceCam(toggleSpaceCam([], noId), { lat: 1, lng: 2 })).toBe(true);
  });

  it('has no upper limit', () => {
    let list: WatchedCamera[] = [];
    for (let i = 1; i <= 30; i += 1) list = toggleSpaceCam(list, cam(i));
    expect(list).toHaveLength(30);
    expect(parseSpaceCams(JSON.stringify(list))).toHaveLength(30);
  });

  it('drops non-http URLs and unknown fields before they reach a player', () => {
    const [stored] = toggleSpaceCam([], cam(1, {
      stream_url: 'javascript:alert(1)',
      feed_url: 'https://cctv.example/snap.jpg',
      external_url: 'data:text/html,<script>',
      evil: 'x',
    }));
    expect(stored).toEqual({ id: 1, lat: -5.2, lng: 106.8, name: 'CAM 1', feed_url: 'https://cctv.example/snap.jpg' });
  });

  it('parses stored data defensively', () => {
    expect(parseSpaceCams(null)).toEqual([]);
    expect(parseSpaceCams('not json')).toEqual([]);
    expect(parseSpaceCams('{"lat":1}')).toEqual([]);
    const mixed = JSON.stringify([cam(1), cam(1), { lat: 'x', lng: 1 }, null, cam(2)]);
    expect(parseSpaceCams(mixed).map((item) => item.id)).toEqual([1, 2]);
  });
});

describe('autoGrid', () => {
  it.each([
    [0, 1, 1], [1, 1, 1], [2, 2, 1], [3, 2, 2], [4, 2, 2], [5, 3, 2], [6, 3, 2],
    [7, 3, 3], [9, 3, 3], [10, 4, 3], [12, 4, 3], [13, 4, 4], [16, 4, 4], [17, 5, 4], [25, 5, 5],
  ])('%i cameras → %i×%i', (count, cols, rows) => {
    expect(autoGrid(count)).toEqual({ cols, rows });
  });
});
