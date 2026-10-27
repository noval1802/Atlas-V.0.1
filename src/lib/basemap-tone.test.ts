import { describe, expect, it } from 'vitest';
import { applyBasemapTone } from './basemap-tone';

describe('applyBasemapTone', () => {
  it('repaints the layers the style has and skips the rest', () => {
    const present = new Set(['background', 'water']);
    const calls: string[] = [];
    applyBasemapTone({
      getLayer: id => (present.has(id) ? {} : undefined),
      setPaintProperty: (id, property, value) => calls.push(`${id}.${property}=${value}`),
    });
    expect(calls).toEqual(['background.background-color=#1a1e26', 'water.fill-color=#34424f']);
  });
});
