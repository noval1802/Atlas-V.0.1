import { describe, expect, it } from 'vitest';
import { mergeQuakes, parseBmkgQuakes, parseNowcastCap, parseWarningList } from './bmkg';

const quake = {
  DateTime: '2026-10-27T14:43:13+00:00',
  Coordinates: '-9.20,110.39',
  Magnitude: '5.4',
  Kedalaman: '10 km',
  Wilayah: '136 km BaratDaya GUNUNGKIDUL-DIY',
  Potensi: 'Tidak berpotensi tsunami',
};

describe('parseBmkgQuakes', () => {
  it('reads coordinates, magnitude, depth and time from a list', () => {
    const [row] = parseBmkgQuakes({ Infogempa: { gempa: [quake] } });
    expect(row).toMatchObject({ lat: -9.2, lng: 110.39, magnitude: 5.4, depth: 10, source: 'BMKG', tsunami: 0 });
    expect(row.time).toBe(Date.parse('2026-10-27T14:43:13+00:00'));
  });

  it('accepts the single-object autogempa shape and flags a tsunami potential', () => {
    const [row] = parseBmkgQuakes({ Infogempa: { gempa: { ...quake, Potensi: 'Berpotensi tsunami' } } });
    expect(row.tsunami).toBe(1);
  });

  it('drops rows it cannot place and survives an empty body', () => {
    expect(parseBmkgQuakes({ Infogempa: { gempa: [{ ...quake, Coordinates: 'x' }] } })).toEqual([]);
    expect(parseBmkgQuakes(null)).toEqual([]);
  });

  it('keeps one copy of a quake listed in both files, newest first', () => {
    const older = parseBmkgQuakes({ Infogempa: { gempa: [{ ...quake, DateTime: '2026-10-20T00:00:00+00:00' }] } });
    const felt = parseBmkgQuakes({ Infogempa: { gempa: [{ ...quake, Dirasakan: 'II Bantul' }] } });
    const merged = mergeQuakes([older, parseBmkgQuakes({ Infogempa: { gempa: [quake] } }), felt]);
    expect(merged).toHaveLength(2);
    expect(merged[0].time).toBeGreaterThan(merged[1].time!);
  });
});

describe('nowcast', () => {
  it('turns bulletin codes into CAP links and keeps only BMKG infographics', () => {
    const list = parseWarningList([
      { ID_Kode: 'CLG20261027005', description: ' Hujan lebat di Lampung ', infografis: 'https://api-apps.bmkg.go.id/api/warningcuaca/image?path=CLG-2026-10-27-CLG20261027005_image0.jpg' },
      { ID_Kode: 'CKT20261027003', infografis: 'https://evil.example/x.jpg' },
      { ID_Kode: '../../etc', infografis: '' },
    ]);
    expect(list).toEqual([
      { code: 'CLG20261027005', capUrl: 'https://www.bmkg.go.id/alerts/nowcast/id/CLG20261027005_alert.xml', description: 'Hujan lebat di Lampung', infographic: 'https://api-apps.bmkg.go.id/api/warningcuaca/image?path=CLG-2026-10-27-CLG20261027005_image0.jpg' },
      { code: 'CKT20261027003', capUrl: 'https://www.bmkg.go.id/alerts/nowcast/id/CKT20261027003_alert.xml', description: undefined, infographic: undefined },
    ]);
    expect(parseWarningList({ error: 1 })).toEqual([]);
  });

  it('places a CAP alert at its polygon mean and maps severity', () => {
    const cap = `<alert><identifier>2.49.0.1</identifier><info><event>Hujan Lebat dan Petir</event>
      <severity>Moderate</severity><effective>2026-10-28T00:10:00+08:00</effective><expires>2026-10-28T02:00:00+08:00</expires>
      <headline>Hujan Lebat disertai Petir di Kalimantan Timur</headline>
      <area><areaDesc>Kalimantan Timur</areaDesc><polygon>-1.0,116.0 -2.0,116.0 -2.0,117.0 -1.0,117.0</polygon></area></info></alert>`;
    expect(parseNowcastCap(cap)).toMatchObject({
      id: 'bmkg-2.49.0.1', severity: 'medium', lat: -1.5, lng: 116.5, area: 'Kalimantan Timur',
      headline: 'Hujan Lebat disertai Petir di Kalimantan Timur',
    });
    expect(parseNowcastCap('<alert></alert>')).toBeNull();
  });
});
