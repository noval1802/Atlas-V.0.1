/**
 * OSIRIS — map layer palette.
 *
 * The colours the *map* draws with, as opposed to the chrome around it: the
 * camera dots. They live as `--map-*` custom properties beside
 * the rest of the design tokens, so the two themes set them in globals.css and
 * the Style Studio overrides them the same way it overrides everything else.
 *
 * Everything here is pure. Reading the properties off the document is the
 * caller's job — `readMapPalette` takes the lookup as an argument.
 */

export interface MapPalette {
  cctv: string;
}

export type MapPaletteKey = keyof MapPalette;

/** Custom property backing each entry. Must match the block in globals.css. */
export const MAP_VARS: Record<MapPaletteKey, string> = {
  cctv: '--map-cctv',
};

/**
 * The core theme's values, and the fallback when a property is missing.
 * Duplicated in globals.css because CSS cannot import them; the test suite
 * pins the two copies together.
 */
export const MAP_DEFAULTS: MapPalette = {
  cctv: '#00e676',
};

export const MAP_PALETTE_KEYS = Object.keys(MAP_DEFAULTS) as MapPaletteKey[];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Expand shorthand and lowercase, so two spellings of a colour compare equal. */
function canonical(hex: string): string {
  const h = hex.slice(1).toLowerCase();
  return '#' + (h.length === 3 ? h.split('').map(c => c + c).join('') : h);
}

/**
 * Resolve a colour the CSS build may have rewritten.
 *
 * Lightning CSS minifies hex to a keyword wherever that is shorter, so a
 * `#ff0000` property comes back out of getComputedStyle as `red`. The value
 * has to be parsed rather than pattern-matched. A 2d context is the browser's own
 * parser; assigning a colour and reading it back yields `#rrggbb`.
 *
 * Two seeds and an agreement check, because a value the parser rejects leaves
 * `fillStyle` at whatever it already held — with one seed, garbage would come
 * back as that seed rather than as a rejection.
 */
let probe: CanvasRenderingContext2D | null | undefined;
function parseColorValue(value: string): string | null {
  if (probe === undefined) {
    probe = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  if (!probe) return null;
  probe.fillStyle = '#000000';
  probe.fillStyle = value;
  const a = probe.fillStyle;
  probe.fillStyle = '#ffffff';
  probe.fillStyle = value;
  const b = probe.fillStyle;
  return a === b && typeof a === 'string' && HEX.test(a) ? canonical(a) : null;
}

/**
 * Read the palette out of a resolved-style lookup, e.g. `getComputedStyle`.
 *
 * Anything that is not a colour — an unresolved var(), a stylesheet that has
 * not loaded, a string pasted in to escape the declaration — falls back rather
 * than reaching a paint property.
 */
export function readMapPalette(lookup: (varName: string) => string): MapPalette {
  const out = {} as MapPalette;
  for (const key of MAP_PALETTE_KEYS) {
    const raw = (lookup(MAP_VARS[key]) || '').trim();
    out[key] = (HEX.test(raw) ? canonical(raw) : parseColorValue(raw)) ?? MAP_DEFAULTS[key];
  }
  return out;
}
