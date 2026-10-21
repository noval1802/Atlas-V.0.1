import { describe, expect, it } from 'vitest';
import { mapDataList, marketSection, type MapData, type MarketsSnapshot } from './map-data';

describe('mapDataList', () => {
  const data: MapData = {
    commercial_flights: [{ lat: 1, lng: 2, callsign: 'ABC' }],
    satellites_at: '2026-10-10T00:00:00Z',
    earthquakes: [],
  };

  it('returns a stored list', () => {
    expect(mapDataList(data, 'commercial_flights')).toEqual([{ lat: 1, lng: 2, callsign: 'ABC' }]);
  });

  it('treats an empty list as present', () => {
    expect(mapDataList(data, 'earthquakes')).toEqual([]);
  });

  it('skips a field that is not a list and a key that was never written', () => {
    expect(mapDataList(data, 'satellites_at')).toBeUndefined();
    expect(mapDataList(data, 'fires')).toBeUndefined();
  });

  it('skips a malformed payload instead of counting it', () => {
    expect(mapDataList({ earthquakes: 'not-an-array' }, 'earthquakes')).toBeUndefined();
  });
});

describe('marketSection', () => {
  const markets: MarketsSnapshot = {
    stocks: { RTX: { name: 'RTX', symbol: 'RTX', price: 100, change_percent: 1, up: true } },
  };

  it('returns the quotes for a known section', () => {
    expect(marketSection(markets, 'stocks').RTX.symbol).toBe('RTX');
  });

  it('treats a missing section and an unknown one as an empty bag', () => {
    expect(marketSection(markets, 'crypto')).toEqual({});
    expect(marketSection(markets, 'bonds')).toEqual({});
  });
});
