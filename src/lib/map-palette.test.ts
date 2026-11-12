import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  MAP_DEFAULTS,
  MAP_PALETTE_KEYS,
  MAP_VARS,
  readMapPalette,
} from './map-palette';

describe('readMapPalette', () => {
  it('reads every entry, trimming what getComputedStyle returns', () => {
    const out = readMapPalette(name => (name === '--map-cctv' ? '  #ff0000 ' : ''));
    expect(out.cctv).toBe('#ff0000');
  });

  it('canonicalises so two spellings of one colour compare equal', () => {
    expect(readMapPalette(() => '#0F0').cctv).toBe('#00ff00');
    expect(readMapPalette(() => '#00E676').cctv).toBe('#00e676');
  });

  it('falls back for anything missing or not a colour', () => {
    // An unresolved var() or a stylesheet that has not loaded yields ''.
    expect(readMapPalette(() => '').cctv).toBe(MAP_DEFAULTS.cctv);
    expect(readMapPalette(() => 'red; } * { display: none }').cctv).toBe(MAP_DEFAULTS.cctv);
    // Keywords and rgb() need a parser; without a DOM there is none, so they
    // fall back here. In the browser they resolve — which is the point: the
    // CSS build rewrites #ff0000 to `red` on its way to getComputedStyle.
    expect(readMapPalette(() => 'rgb(1,2,3)').cctv).toBe(MAP_DEFAULTS.cctv);
  });
});

describe('globals.css', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  /** The value `--name: ` is declared with, at its first (i.e. :root) mention. */
  const declared = (name: string): string | null => {
    const at = css.indexOf(name + ':');
    if (at < 0) return null;
    return css.slice(at + name.length + 1, css.indexOf(';', at)).trim().toLowerCase();
  };

  it('declares every property the palette reads', () => {
    for (const key of MAP_PALETTE_KEYS) {
      expect(declared(MAP_VARS[key]), MAP_VARS[key]).not.toBeNull();
    }
  });

  it('agrees with MAP_DEFAULTS', () => {
    // The two copies cannot import each other; this pins them together.
    for (const key of MAP_PALETTE_KEYS) {
      expect(declared(MAP_VARS[key]), MAP_VARS[key]).toBe(MAP_DEFAULTS[key]);
    }
  });
});
