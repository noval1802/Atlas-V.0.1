import { describe, it, expect } from 'vitest';
import { pointInPolygon, bboxOf, selectInPolygon, MAX_ITEMS_PER_GROUP } from './aoi';

/** A 2x2 degree square centred on 0,0. */
const SQUARE = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

/** Concave, to catch anything that only handles convex rings. */
const L_SHAPE = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];

describe('pointInPolygon', () => {
  it('accepts a point well inside', () => {
    expect(pointInPolygon(0, 0, SQUARE)).toBe(true);
  });

  it('rejects points outside on every side', () => {
    expect(pointInPolygon(2, 0, SQUARE)).toBe(false);
    expect(pointInPolygon(-2, 0, SQUARE)).toBe(false);
    expect(pointInPolygon(0, 2, SQUARE)).toBe(false);
    expect(pointInPolygon(0, -2, SQUARE)).toBe(false);
  });

  it('handles a closed ring identically to an open one', () => {
    const closed = [...SQUARE, SQUARE[0]];
    expect(pointInPolygon(0.5, 0.5, closed)).toBe(pointInPolygon(0.5, 0.5, SQUARE));
  });

  it('respects concavity — the notch of an L is outside', () => {
    expect(pointInPolygon(0.5, 0.5, L_SHAPE)).toBe(true);   // in the corner
    expect(pointInPolygon(3.5, 0.5, L_SHAPE)).toBe(true);   // in the foot
    expect(pointInPolygon(0.5, 3.5, L_SHAPE)).toBe(true);   // in the upright
    expect(pointInPolygon(2.5, 2.5, L_SHAPE)).toBe(false);  // the notch
  });

  it('is stable for a point on a horizontal edge', () => {
    // The half-open crossing rule must count this once, not twice.
    const onEdge = pointInPolygon(0, -1, SQUARE);
    expect(typeof onEdge).toBe('boolean');
    expect(pointInPolygon(0, -1, [...SQUARE, SQUARE[0]])).toBe(onEdge);
  });

  it('treats a degenerate ring as empty', () => {
    expect(pointInPolygon(0, 0, [[0, 0], [1, 1]])).toBe(false);
  });
});

describe('bboxOf', () => {
  it('bounds a ring', () => {
    expect(bboxOf(SQUARE)).toEqual({ west: -1, south: -1, east: 1, north: 1 });
  });
});

describe('selectInPolygon', () => {
  const data = {
    maritime_ships: [
      { name: 'KRI ABC', lat: 0, lng: 0, destination: 'Surabaya' }, // in
      { name: 'FAR999', lat: 40, lng: 40 },                          // out
      { name: 'NOPOS' },                                             // no position
    ],
    weather_events: [{ title: 'Storm', lat: 0.5, lng: -0.5 }],       // in
    cameras: [{ name: 'Cam A', lat: 0.2, lng: 0.2, city: 'Test', country: 'XX' }], // in
    gdelt: [],                            // present but empty
    earthquakes: 'not-an-array',          // malformed
  };

  it('counts only what is inside, across layers', () => {
    const r = selectInPolygon(SQUARE, data);
    expect(r.total).toBe(3);
    const keys = r.groups.map(g => g.key).sort();
    expect(keys).toEqual(['cameras', 'maritime_ships', 'weather_events']);
  });

  it('skips entities with no position rather than counting them', () => {
    const r = selectInPolygon(SQUARE, data);
    const ships = r.groups.find(g => g.key === 'maritime_ships')!;
    expect(ships.count).toBe(1);
    expect(ships.items[0].label).toBe('KRI ABC');
  });

  it('omits empty and malformed layers instead of reporting zero', () => {
    const r = selectInPolygon(SQUARE, data);
    expect(r.groups.find(g => g.key === 'gdelt')).toBeUndefined();
    expect(r.groups.find(g => g.key === 'earthquakes')).toBeUndefined();
  });

  it('sorts groups by count, densest first', () => {
    const many = {
      cameras: Array.from({ length: 5 }, (_, i) => ({ name: 'C' + i, lat: 0, lng: 0 })),
      maritime_ships: [{ name: 'M1', lat: 0, lng: 0 }],
    };
    const r = selectInPolygon(SQUARE, many);
    expect(r.groups[0].key).toBe('cameras');
    expect(r.groups[0].count).toBe(5);
  });

  it('caps the listing but keeps the count exact', () => {
    const lots = {
      cameras: Array.from({ length: MAX_ITEMS_PER_GROUP + 25 }, (_, i) => ({ name: 'C' + i, lat: 0, lng: 0 })),
    };
    const r = selectInPolygon(SQUARE, lots);
    expect(r.total).toBe(MAX_ITEMS_PER_GROUP + 25);
    expect(r.groups[0].count).toBe(MAX_ITEMS_PER_GROUP + 25);
    expect(r.groups[0].items).toHaveLength(MAX_ITEMS_PER_GROUP);
  });

  it('returns nothing for a ring that is not a polygon', () => {
    expect(selectInPolygon([[0, 0], [1, 1]], data)).toEqual({ total: 0, groups: [] });
  });

  it('surfaces layer detail for the readout', () => {
    const r = selectInPolygon(SQUARE, data);
    const cam = r.groups.find(g => g.key === 'cameras')!;
    expect(cam.items[0].detail).toBe('Test, XX');
  });
});
