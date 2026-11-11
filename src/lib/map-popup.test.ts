import { describe, expect, it } from 'vitest';
import { clickedProperties, earthquakeProperties, formatWib, pointCoordinates, type FlightPopup, htmlEsc, urlSafe } from './map-popup';

describe('pointCoordinates', () => {
  it('reads a point as longitude then latitude', () => {
    expect(pointCoordinates({ type: 'Point', coordinates: [106.8, -6.2] })).toEqual([106.8, -6.2]);
  });

  it('ignores a line, a polygon, and a point with no numbers', () => {
    expect(pointCoordinates({ type: 'LineString', coordinates: [[0, 0], [1, 1]] })).toBeNull();
    expect(pointCoordinates({ type: 'Polygon', coordinates: [] })).toBeNull();
    expect(pointCoordinates({ type: 'Point', coordinates: ['x', 'y'] })).toBeNull();
    expect(pointCoordinates(undefined)).toBeNull();
  });
});

describe('clickedProperties', () => {
  it('returns the feature properties for the popup', () => {
    const properties = clickedProperties<FlightPopup>({
      features: [{ properties: { callsign: 'GIA123', alt: 1000 }, geometry: { type: 'Point', coordinates: [1, 2] } }],
    });
    expect(properties?.callsign).toBe('GIA123');
    expect(properties?.alt).toBe(1000);
  });

  it('returns nothing when the click has no feature', () => {
    expect(clickedProperties({ features: [] })).toBeNull();
    expect(clickedProperties({ features: [{ properties: null }] })).toBeNull();
  });
});

describe('popup escaping', () => {
  it('escapes text so a feed title cannot open a tag', () => {
    expect(htmlEsc('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(htmlEsc(null)).toBe('');
  });

  it('keeps an http(s) link but cannot be broken out of its attribute', () => {
    expect(urlSafe('https://example.com/a?b=1&c=2')).toBe('https://example.com/a?b=1&amp;c=2');
    const out = urlSafe('https://x/" onmouseover="alert(1)" x="');
    expect(out).not.toContain('"');
    expect(`<a href="${out}">`).toBe('<a href="https://x/&quot; onmouseover=&quot;alert(1)&quot; x=&quot;">');
  });

  it('turns every other scheme into #', () => {
    for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', ' https://x', '', undefined]) {
      expect(urlSafe(url)).toBe('#');
    }
  });
});

describe('earthquakeProperties', () => {
  const now = Date.UTC(2026, 10, 11, 6, 0);
  it('carries the event time and its age in hours so the map can fade old quakes', () => {
    const p = earthquakeProperties({ id: 'q1', magnitude: 5.2, time: now - 3 * 3_600_000 }, now);
    expect(p.time).toBe(now - 3 * 3_600_000);
    expect(p.age_h).toBeCloseTo(3);
  });

  it('treats a quake with no time as old, never as current', () => {
    expect(earthquakeProperties({ magnitude: 6 }, now)).toMatchObject({ time: null, age_h: 9999 });
  });

  it('formats the time in WIB', () => {
    expect(formatWib(Date.UTC(2026, 10, 11, 7, 32))).toMatch(/11 Nov 2026.*14.32 WIB$/);
  });
});
