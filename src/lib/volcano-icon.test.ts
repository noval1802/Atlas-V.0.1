import { describe, it, expect } from 'vitest';
import { volcanoPulses, volcanoShown } from './volcano-icon';

const all = { volcano_l1: true, volcano_l2: true, volcano_l3: true, volcano_l4: true, volcano_erupt: true };

describe('volcanoShown', () => {
  it('files an erupting volcano under Erupsi, whatever its level', () => {
    const dukono = { level: 2, erupting: true };
    expect(volcanoShown(dukono, { ...all, volcano_l2: false })).toBe(true);
    expect(volcanoShown(dukono, { ...all, volcano_erupt: false })).toBe(false);
  });

  it('files a quiet volcano under its level', () => {
    expect(volcanoShown({ level: 3, erupting: false }, { ...all, volcano_l3: false })).toBe(false);
    expect(volcanoShown({ level: 1, erupting: false }, all)).toBe(true);
  });
});

describe('volcanoPulses', () => {
  it('pings Siaga, Awas and any eruption, not a quiet Normal or Waspada', () => {
    expect([[1, false], [2, false], [3, false], [4, false], [1, true], [2, true]].map(([level, erupting]) =>
      volcanoPulses({ level: level as number, erupting: erupting as boolean }))).toEqual([false, false, true, true, true, true]);
  });
});
