import { describe, expect, it } from 'vitest';
import { parseTangerangKab, tangerangKabCamera } from './tangerangkab';

/** One camera object as it sits in the page's Livewire snapshot (Nov 2026). */
const RECORD = {
  id: '01jsnyfnzn18d0ca1m7p4ctvx1',
  name: 'Jayanti 1 Arah Serang',
  latitude: -6.206589479719354,
  longitude: 106.3742267693221,
  url: 'https://cctv-dishub.tangerangkab.go.id/storage/video/01jsnyfnzn18d0ca1m7p4ctvx1/01jsnyfnzn18d0ca1m7p4ctvx1.m3u8',
};
/** The snapshot is HTML-escaped inside an attribute, with `\/` in URLs. */
const escaped = (record: object) => JSON.stringify(record).replace(/\//g, '\\/').replace(/"/g, '&quot;');

describe('kabupaten tangerang cameras', () => {
  it('maps a snapshot object to a proxied HLS stream', () => {
    expect(tangerangKabCamera(RECORD)).toEqual({
      id: 'tangerangkab-01jsnyfnzn18d0ca1m7p4ctvx1',
      lat: -6.206589479719354,
      lng: 106.3742267693221,
      name: 'Jayanti 1 Arah Serang',
      city: 'Kabupaten Tangerang',
      country: 'Indonesia',
      source: 'Dishub Kab. Tangerang',
      stream_url: `/api/cctv/hls?u=${encodeURIComponent(RECORD.url)}`,
      stream_type: 'hls',
    });
  });

  it('drops bad ids, coordinates outside Indonesia and off-host streams', () => {
    expect(tangerangKabCamera({ ...RECORD, id: 'x' })).toBeNull();
    expect(tangerangKabCamera({ ...RECORD, latitude: 51.5, longitude: 0 })).toBeNull();
    expect(tangerangKabCamera({ ...RECORD, url: 'https://evil.example/storage/video/a/a.m3u8' })).toBeNull();
  });

  it('reads the escaped snapshot and dedupes the list that appears twice', () => {
    const second = { ...RECORD, id: '01jsnyfnzqgp8ey0jpz4hec4xa', name: 'Jayanti 2 Arah Gembong' };
    const html = `<div wire:snapshot="{&quot;data&quot;:{&quot;a&quot;:[[${escaped(RECORD)},{&quot;s&quot;:&quot;arr&quot;}],[${escaped(second)}]],&quot;b&quot;:[[${escaped(RECORD)}]]}}">`;
    expect(parseTangerangKab(html).map(c => c.name)).toEqual(['Jayanti 1 Arah Serang', 'Jayanti 2 Arah Gembong']);
  });
});
