/** Toll-road cameras (Jasa Marga and BPJT), drawn by the CCTV TOL toggle (key cctv_jm). */
const TOLL_SOURCES = ['Jasa Marga', 'BPJT'];

/** Jakarta TPT cameras, drawn by the CCTV JAKARTA toggle. */
export const TPT_SOURCE = 'TPT CCTV';

/**
 * Switches that sit under a parent layer and default to on with it: the cameras
 * split out of CCTV, and the volcano level filters. A link saved before a split
 * existed omits both the key and its off marker, and those links follow the parent.
 */
const LAYER_SPLITS = [
  { key: 'cctv_jm', off: '!cctv_jm', parent: 'cctv' },
  { key: 'cctv_jakarta', off: '!cctv_jakarta', parent: 'cctv' },
  ...(['volcano_l1', 'volcano_l2', 'volcano_l3', 'volcano_l4', 'volcano_erupt'] as const)
    .map(key => ({ key, off: `!${key}` as const, parent: 'volcanoes' })),
] as const;

export const CCTV_JM_OFF = LAYER_SPLITS[0].off;
export const CCTV_JAKARTA_OFF = LAYER_SPLITS[1].off;

export function isTollCamera(camera: { source?: unknown } | null | undefined): boolean {
  return TOLL_SOURCES.includes(camera?.source as string);
}

export function isTptCamera(camera: { source?: unknown } | null | undefined): boolean {
  return camera?.source === TPT_SOURCE;
}

/** Cameras outside Indonesia, drawn by the GLOBAL toggle. Feeds spell Indonesia as either name or ISO code. */
export function isGlobalCamera(camera: { country?: unknown } | null | undefined): boolean {
  const country = camera?.country;
  return country !== 'Indonesia' && country !== 'ID';
}

/** Apply a `?layers=` list. A link saved before a split follows its parent switch. */
export function applyLayerQuery<T extends object>(current: T, listed: string): T {
  const active = listed.split(',').map(item => item.trim()).filter(Boolean);
  const next: Record<string, boolean> = {};
  for (const key of Object.keys(current)) next[key] = active.includes(key);
  for (const split of LAYER_SPLITS) {
    if (!(split.key in current)) continue;
    if (active.includes(split.off)) next[split.key] = false;
    else if (!active.includes(split.key)) next[split.key] = active.includes(split.parent);
  }
  return next as T;
}

/**
 * Persist each split explicitly so a reload does not turn it back on. The off marker is only
 * needed while the parent is on; with it off, applyLayerQuery already reads a missing split as off.
 */
export function serializeLayers(state: object): string {
  const splitByKey = new Map<string, (typeof LAYER_SPLITS)[number]>(LAYER_SPLITS.map(split => [split.key, split]));
  const on = (key: string) => (state as Record<string, unknown>)[key] === true;
  const names = Object.keys(state).flatMap(key => {
    const split = splitByKey.get(key);
    if (split) return on(key) ? [key] : on(split.parent) ? [split.off] : [];
    return on(key) ? [key] : [];
  });
  return names.join(',');
}
