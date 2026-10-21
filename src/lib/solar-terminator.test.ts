import { describe, expect, it } from 'vitest';
import { computeSolarTerminator } from './solar-terminator';

describe('computeSolarTerminator', () => {
  const at = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));

  it('draws a closed ring from the date line back to itself', () => {
    const ring = computeSolarTerminator(at);
    expect(ring.length).toBeGreaterThan(3);
    expect(ring[0][0]).toBe(-180);
    expect(ring.at(-1)).toEqual(ring[0]);
    for (const [lng, lat] of ring) {
      expect(Number.isFinite(lng)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });

  it('answers the same ring for the same instant', () => {
    expect(computeSolarTerminator(at)).toEqual(computeSolarTerminator(at));
  });
});
