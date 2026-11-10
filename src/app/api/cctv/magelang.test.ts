import { describe, expect, it } from 'vitest';
import { magelangCamera, parseMagelang } from './magelang';

/** Markup copied from cctv.dishub.magelangkab.go.id/map-cctv (Nov 2026). */
const marker = (lat: string, lng: string, name: string, embed: string) =>
  `L.marker([${lat}, ${lng}]).addTo(map) \n    \t\t.bindPopup("<b>${name}</b><br> Lokasi : APILL ${name}<br> Kecamatan : Mungkid<br><iframe src=https://www.youtube.com/embed/${embed}></iframe>") \n         `;

describe('magelang cameras', () => {
  it('maps a marker to the YouTube live embed it carries', () => {
    const [camera] = parseMagelang(marker('-7.539212', '110.235363', 'CCTV Simpang Blondo', '68-2nZh2jtw'));
    expect(camera).toEqual({
      id: 'magelang-68-2nZh2jtw',
      lat: -7.539212,
      lng: 110.235363,
      name: 'CCTV Simpang Blondo · Mungkid',
      city: 'Kabupaten Magelang',
      country: 'Indonesia',
      source: 'Dishub Kab. Magelang',
      stream_url: 'https://www.youtube.com/embed/68-2nZh2jtw?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0',
      stream_type: 'iframe',
      external_url: 'https://www.youtube.com/watch?v=68-2nZh2jtw',
    });
  });

  it('drops markers with an empty embed, a malformed id, or coordinates outside Indonesia', () => {
    const html = marker('-7.406154', '110.238881', 'CCTV Simpang Kuwaluhan', '')
      + marker('-7.5', '110.2', 'Bad', 'short')
      + marker('51.5', '0.1', 'London', '68-2nZh2jtw');
    expect(parseMagelang(html)).toEqual([]);
  });

  it('dedupes markers that share one broadcast', () => {
    const html = marker('-7.53', '110.23', 'A', '68-2nZh2jtw') + marker('-7.54', '110.24', 'B', '68-2nZh2jtw');
    expect(parseMagelang(html)).toHaveLength(1);
    expect(magelangCamera(-7.5, 110.2, '<b>X</b><iframe src=https://www.youtube.com/embed/8yG83HMTPhs>')?.name).toBe('X');
  });
});
