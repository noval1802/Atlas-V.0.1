import { describe, expect, it } from 'vitest';
import { mapDataList, type MapData } from './map-data';

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
