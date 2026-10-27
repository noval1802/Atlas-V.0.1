/**
 * Lifts CARTO dark-matter one step so land and sea separate in a lit operations room.
 *
 * The style is CARTO's live one, not public/dark-matter-style.json, so the colours
 * are patched after it loads. A layer the style does not have is skipped.
 */
export const BASEMAP_TONE: ReadonlyArray<[layer: string, property: string, color: string]> = [
  ['background', 'background-color', '#1a1e26'],
  ['landcover', 'fill-color', '#1a1e26'],
  ['landuse', 'fill-color', '#1a1e26'],
  ['park_national_park', 'fill-color', '#1a1e26'],
  ['park_nature_reserve', 'fill-color', '#1a1e26'],
  ['water', 'fill-color', '#34424f'],
  ['boundary_country_outline', 'line-color', '#3e4c58'],
];

interface PaintableMap {
  getLayer(id: string): unknown;
  setPaintProperty(id: string, property: string, value: string): void;
}

export function applyBasemapTone(map: PaintableMap): void {
  for (const [layer, property, color] of BASEMAP_TONE) {
    if (map.getLayer(layer)) map.setPaintProperty(layer, property, color);
  }
}
