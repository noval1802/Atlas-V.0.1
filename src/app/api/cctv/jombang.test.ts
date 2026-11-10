import { describe, expect, it } from 'vitest';
import { jombangCamera, parseJombang } from './jombang';

/** Shape of one inline `cctvData` entry on cctv.jombangkab.go.id/v2/ (Nov 2026); token shortened. */
const RECORD = {
  id: '3',
  nama: 'Alun-alun Jombang - Lapangan Sintetis',
  lat: '-7.557116',
  lng: '112.233742',
  url: 'https://cctv.jombangkab.go.id/zm/cgi-bin/nph-zms?monitor=120&token=eyJ0eXAi.abc.def',
  kategori: 'Area Publik',
  status: 'online',
};

describe('jombang cameras', () => {
  it('maps an online entry to its ZoneMinder MJPEG stream', () => {
    expect(jombangCamera(RECORD)).toEqual({
      id: 'jombang-3',
      lat: -7.557116,
      lng: 112.233742,
      name: 'Alun-alun Jombang - Lapangan Sintetis · Area Publik',
      city: 'Kabupaten Jombang',
      country: 'Indonesia',
      source: 'Jombang Smart Service',
      stream_url: RECORD.url,
      stream_type: 'mjpeg',
    });
  });

  it('drops offline entries, bad coordinates and anything that is not a ZoneMinder stream on the host', () => {
    expect(jombangCamera({ ...RECORD, status: 'offline' })).toBeNull();
    expect(jombangCamera({ ...RECORD, lat: '51', lng: '0' })).toBeNull();
    expect(jombangCamera({ ...RECORD, url: 'https://evil.example/zm/cgi-bin/nph-zms?monitor=1' })).toBeNull();
    expect(jombangCamera({ ...RECORD, url: 'http://cctv.jombangkab.go.id/zm/cgi-bin/nph-zms?monitor=1' })).toBeNull();
    expect(jombangCamera({ ...RECORD, url: 'https://cctv.jombangkab.go.id/zm/index.php?view=console' })).toBeNull();
  });

  it('reads the inline array out of the page and dedupes', () => {
    const html = `<script>const catColors = {};\n    const cctvData = ${JSON.stringify([RECORD, RECORD, { ...RECORD, id: '4' }])};\n    const markers = [];</script>`;
    expect(parseJombang(html).map(c => c.id)).toEqual(['jombang-3', 'jombang-4']);
    expect(parseJombang('<html>no data</html>')).toEqual([]);
  });
});
