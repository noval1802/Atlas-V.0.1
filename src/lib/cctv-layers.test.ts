import { describe, expect, it } from 'vitest';
import { applyLayerQuery, CCTV_JAKARTA_OFF, CCTV_JM_OFF, isGlobalCamera, isTollCamera, isTptCamera, serializeLayers } from './cctv-layers';

describe('isGlobalCamera', () => {
  it('treats both spellings of Indonesia as local and everything else as global', () => {
    expect(isGlobalCamera({ country: 'Indonesia' })).toBe(false);
    expect(isGlobalCamera({ country: 'ID' })).toBe(false);
    expect(isGlobalCamera({ country: 'Japan' })).toBe(true);
    expect(isGlobalCamera({ country: 'US' })).toBe(true);
  });
});

const base = { cctv: true, cctv_previews: true, cctv_jm: true, cctv_jakarta: true, flights: false };

describe('split CCTV layer query', () => {
  it('keeps the split cameras with CCTV on a link saved before the splits', () => {
    const next = applyLayerQuery(base, 'cctv,cctv_previews');
    expect(next.cctv).toBe(true);
    expect(next.cctv_jm).toBe(true);
    expect(next.cctv_jakarta).toBe(true);
    expect(next.flights).toBe(false);
  });

  it('leaves the split cameras off when CCTV was off', () => {
    const next = applyLayerQuery(base, 'cctv_previews');
    expect(next.cctv_jm).toBe(false);
    expect(next.cctv_jakarta).toBe(false);
  });

  it('remembers an explicit off choice without turning the other split off', () => {
    const next = applyLayerQuery(base, `cctv,cctv_jm,${CCTV_JAKARTA_OFF}`);
    expect(next.cctv).toBe(true);
    expect(next.cctv_jm).toBe(true);
    expect(next.cctv_jakarta).toBe(false);
  });

  it('round-trips an explicit on choice', () => {
    const next = applyLayerQuery(base, 'cctv,cctv_jm,cctv_jakarta');
    const saved = serializeLayers(next).split(',');
    expect(saved).toContain('cctv_jm');
    expect(saved).toContain('cctv_jakarta');
    const off = serializeLayers({ ...next, cctv_jm: false, cctv_jakarta: false });
    expect(off).toContain(CCTV_JM_OFF);
    expect(off).toContain(CCTV_JAKARTA_OFF);
  });

  it('drops the off markers while CCTV itself is off, and still reloads to the same state', () => {
    const state = { cctv: false, cctv_previews: false, cctv_jm: false, cctv_jakarta: false, flights: false, tni_ad: true };
    const saved = serializeLayers(state);
    expect(saved).toBe('tni_ad');
    expect(applyLayerQuery(state, saved)).toEqual(state);
  });

  it('recognises the toll and Jakarta sources', () => {
    expect(isTollCamera({ source: 'Jasa Marga' })).toBe(true);
    expect(isTollCamera({ source: 'BPJT' })).toBe(true);
    expect(isTollCamera({ source: 'TPT CCTV' })).toBe(false);
    expect(isTollCamera({ source: 'Pelindung Bandung' })).toBe(false);
    expect(isTptCamera({ source: 'TPT CCTV' })).toBe(true);
    expect(isTptCamera({ source: 'Jasa Marga' })).toBe(false);
    expect(isTptCamera(null)).toBe(false);
  });
});

describe('volcano level filters in the layer query', () => {
  const volcanoBase = { volcanoes: true, volcano_l1: true, volcano_l2: true, volcano_l3: true, volcano_l4: true, volcano_erupt: true };

  it('shows every level on a link that names only the volcano layer', () => {
    expect(applyLayerQuery(volcanoBase, 'volcanoes')).toEqual(volcanoBase);
  });

  it('round-trips a level switched off', () => {
    const state = { ...volcanoBase, volcano_l1: false };
    expect(applyLayerQuery(volcanoBase, serializeLayers(state))).toEqual(state);
  });
});
