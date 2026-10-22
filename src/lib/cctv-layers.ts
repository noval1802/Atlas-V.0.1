/** Jasa Marga toll cameras, drawn by the CCTV JM toggle. */
export const JASAMARGA_SOURCE = 'Jasa Marga';

/** Jakarta TPT cameras, drawn by the CCTV JAKARTA toggle. */
export const TPT_SOURCE = 'TPT CCTV';

/**
 * Splits that used to live inside CCTV Cameras. A link saved before a split
 * existed omits both the key and its off marker, and those links follow CCTV.
 */
const CAMERA_SPLITS = [
  { key: 'cctv_jm', off: '!cctv_jm' },
  { key: 'cctv_jakarta', off: '!cctv_jakarta' },
] as const;

export const CCTV_JM_OFF = CAMERA_SPLITS[0].off;
export const CCTV_JAKARTA_OFF = CAMERA_SPLITS[1].off;

export function isJasaMargaCamera(camera: { source?: unknown } | null | undefined): boolean {
  return camera?.source === JASAMARGA_SOURCE;
}

export function isTptCamera(camera: { source?: unknown } | null | undefined): boolean {
  return camera?.source === TPT_SOURCE;
}

/** Apply a `?layers=` list. A link saved before a camera split follows the CCTV switch. */
export function applyLayerQuery<T extends object>(current: T, listed: string): T {
  const active = listed.split(',').map(item => item.trim()).filter(Boolean);
  const next: Record<string, boolean> = {};
  for (const key of Object.keys(current)) next[key] = active.includes(key);
  for (const split of CAMERA_SPLITS) {
    if (!(split.key in current)) continue;
    if (active.includes(split.off)) next[split.key] = false;
    else if (!active.includes(split.key)) next[split.key] = active.includes('cctv');
  }
  return next as T;
}

/**
 * Persist each split explicitly so a reload does not turn it back on. The off marker is only
 * needed while CCTV is on; with CCTV off, applyLayerQuery already reads a missing split as off.
 */
export function serializeLayers(state: object): string {
  const offByKey = new Map(CAMERA_SPLITS.map(split => [split.key, split.off]));
  const cctvOn = (state as Record<string, unknown>).cctv === true;
  const names = Object.entries(state).flatMap(([key, on]) => {
    const off = offByKey.get(key as typeof CAMERA_SPLITS[number]['key']);
    if (off) return on === true ? [key] : cctvOn ? [off] : [];
    return on === true ? [key] : [];
  });
  return names.join(',');
}
