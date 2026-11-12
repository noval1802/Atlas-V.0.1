import { describe, expect, it } from 'vitest';
import { mapDataList, type MapData } from './map-data';

describe('mapDataList', () => {
  const data: MapData = {
    fires: [{ lat: 1, lng: 2 }],
    news_meta: { fetchedAt: '2026-10-10T00:00:00Z' },
    earthquakes: [],
  };

  it('returns a stored list', () => {
    expect(mapDataList(data, 'fires')).toEqual([{ lat: 1, lng: 2 }]);
  });

  it('treats an empty list as present', () => {
    expect(mapDataList(data, 'earthquakes')).toEqual([]);
  });

  it('skips a field that is not a list and a key that was never written', () => {
    expect(mapDataList(data, 'news_meta')).toBeUndefined();
    expect(mapDataList(data, 'volcanoes')).toBeUndefined();
  });

  it('skips a malformed payload instead of counting it', () => {
    expect(mapDataList({ earthquakes: 'not-an-array' }, 'earthquakes')).toBeUndefined();
  });
});
