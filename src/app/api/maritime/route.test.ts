import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, applyAisFrame, clearMaritimeSnapshot } from './route';

/* The route aggregates over the websocket-fed ship map on globalThis, so the
   tests drive it directly rather than standing up an AIS stream. */
interface Ship {
  id: number; mmsi: number; lat: number; lng: number;
  speed: number; type: string; name: string; timestamp: number;
}

const ships = () => (globalThis as unknown as { shipsCache: Map<number, Ship> }).shipsCache;

function addShip(mmsi: number, lat: number, lng: number) {
  ships().set(mmsi, {
    id: mmsi, mmsi, lat, lng, speed: 0, type: 'cargo',
    name: `SHIP-${mmsi}`, timestamp: Date.now(),
  });
}

describe('GET /api/maritime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    ships().clear();
    clearMaritimeSnapshot();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('still counts the ships sitting off a port', async () => {
    addShip(1, 1.26, 103.84); // on top of Singapore
    const body = await (await GET()).json();

    const singapore = body.ports.find((p: { name: string }) => p.name === 'Singapore');
    expect(singapore.volume).toContain('LIVE: 1');
    expect(singapore.volume).toContain('WAITING: 1');
    expect(body.total_ships).toBe(1);
  });

  it('serves one snapshot to every caller inside the TTL', async () => {
    addShip(1, 1.26, 103.84);
    const first = await (await GET()).json();

    vi.advanceTimersByTime(4_000);
    addShip(2, 1.27, 103.85);
    const second = await (await GET()).json();

    // The aggregation did not run again — the second caller got the first
    // caller's bytes, which is the whole point under load.
    expect(second).toEqual(first);
    expect(second.total_ships).toBe(1);
  });

  it('rebuilds once the TTL has passed', async () => {
    addShip(1, 1.26, 103.84);
    expect((await (await GET()).json()).total_ships).toBe(1);

    vi.advanceTimersByTime(5_000);
    addShip(2, 1.27, 103.85);
    expect((await (await GET()).json()).total_ships).toBe(2);
  });

  it('lets the browser and any CDN reuse the response', async () => {
    const res = await GET();
    const cc = res.headers.get('cache-control') ?? '';

    expect(cc).toContain('s-maxage=5');
    expect(cc).toContain('max-age=5');
    expect(cc).not.toContain('no-store');
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

describe('applyAisFrame', () => {
  const pos = (mmsi: number, p: Record<string, number>) => ({
    MetaData: { MMSI: mmsi }, MessageType: 'PositionReport',
    Message: { PositionReport: { Latitude: 1, Longitude: 104, Sog: 5, ...p } },
  });

  it('uses course over ground when the heading is 511 (not available)', () => {
    const cache = new Map();
    applyAisFrame(cache, pos(1, { TrueHeading: 511, Cog: 90 }), 0);
    expect(cache.get(1).heading).toBe(90);
  });

  it('keeps a true heading of 0 (due north)', () => {
    const cache = new Map();
    applyAisFrame(cache, pos(1, { TrueHeading: 0, Cog: 90 }), 0);
    expect(cache.get(1).heading).toBe(0);
  });

  it('drops a position of 91/181 (not available)', () => {
    const cache = new Map();
    applyAisFrame(cache, pos(1, { Latitude: 91, Longitude: 181 }), 0);
    expect(cache.has(1)).toBe(false);
  });

  it('keeps a ship on the equator or the prime meridian', () => {
    const cache = new Map();
    applyAisFrame(cache, pos(1, { Latitude: 0, Longitude: 104 }), 0);
    applyAisFrame(cache, pos(2, { Latitude: 51, Longitude: 0 }), 0);
    expect(cache.has(1) && cache.has(2)).toBe(true);
  });

  it('evicts the ship heard from longest ago, not the first one inserted', () => {
    const cache = new Map();
    applyAisFrame(cache, pos(1, {}), 0, 2);
    applyAisFrame(cache, pos(2, {}), 0, 2);
    applyAisFrame(cache, pos(1, {}), 0, 2); // ship 1 reports again
    applyAisFrame(cache, pos(3, {}), 0, 2);
    expect([...cache.keys()].sort()).toEqual([1, 3]);
  });
});
