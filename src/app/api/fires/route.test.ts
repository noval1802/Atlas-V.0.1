import { describe, expect, it } from 'vitest';
import { parseCSV } from './route';

const csv = (rows: [number, number][]) =>
  ['latitude,longitude,bright_ti4,confidence,acq_date,acq_time,frp', ...rows.map(([lat, lng]) => `${lat},${lng},330,n,2026-11-10,0130,5`)].join('\n');

describe('parseCSV', () => {
  /* The global file used to be sampled evenly: 3,000 Kalimantan hotspots in a
     200k-row file became about 30. */
  it('keeps every hotspot inside Indonesia and samples only the rest of the world', () => {
    const kalimantan = Array.from({ length: 3000 }, (_, i): [number, number] => [-1 - i / 10000, 113]);
    const world = Array.from({ length: 50_000 }, (_, i): [number, number] => [40, -100 + i / 1000]);
    const fires = parseCSV(csv([...world, ...kalimantan]));
    expect(fires.filter(f => f.lng === 113)).toHaveLength(3000);
    expect(fires.filter(f => f.lng !== 113)).toHaveLength(2000);
  });

  it('skips rows without coordinates', () => {
    expect(parseCSV(csv([[-2, 110]]) + '\nx,y,1,n,,,')).toHaveLength(1);
  });
});
