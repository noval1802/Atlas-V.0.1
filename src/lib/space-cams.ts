import { useSyncExternalStore } from 'react';
import type { WatchedCamera } from './dashboard-state';

/** CCTV dipilih tiap pengguna untuk multiviewer SPACE, disimpan di browser pengguna itu. Tanpa batas jumlah. */
export const SPACE_CAMS_KEY = 'atlas.spaceCams';

export function spaceCamKey(camera: WatchedCamera): string {
  return camera.id != null ? `id:${camera.id}` : `at:${camera.lat},${camera.lng}`;
}

export function isSpaceCam(list: WatchedCamera[], camera: WatchedCamera | null): boolean {
  if (!camera) return false;
  const key = spaceCamKey(camera);
  return list.some((item) => spaceCamKey(item) === key);
}

/** Adds the camera, or removes it if already chosen. */
export function toggleSpaceCam(list: WatchedCamera[], camera: WatchedCamera): WatchedCamera[] {
  const key = spaceCamKey(camera);
  if (list.some((item) => spaceCamKey(item) === key)) return list.filter((item) => spaceCamKey(item) !== key);
  return [...list, pickCamera(camera)];
}

const URL_FIELDS = ['feed_url', 'stream_url', 'external_url'] as const;
const TEXT_FIELDS = ['name', 'city', 'country', 'source', 'stream_type'] as const;

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Keeps only the fields the player reads; URLs must be http(s) because they end up in iframe/img/video src. */
function pickCamera(raw: WatchedCamera): WatchedCamera {
  const camera: WatchedCamera = { lat: raw.lat, lng: raw.lng };
  if (typeof raw.id === 'string' || typeof raw.id === 'number') camera.id = raw.id;
  for (const field of TEXT_FIELDS) if (typeof raw[field] === 'string') camera[field] = raw[field];
  for (const field of URL_FIELDS) {
    const url = httpUrl(raw[field]);
    if (url) camera[field] = url;
  }
  return camera;
}

/** Reads the stored list. Anything malformed is dropped rather than trusted. */
export function parseSpaceCams(stored: string | null): WatchedCamera[] {
  if (!stored) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: WatchedCamera[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { lat, lng } = item as Record<string, unknown>;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (isSpaceCam(out, item as WatchedCamera)) continue;
    out.push(pickCamera(item as WatchedCamera));
  }
  return out;
}

/** Columns and rows for `count` tiles: the most square grid that fits them, wider than tall on a landscape screen. */
export function autoGrid(count: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  return { cols, rows: Math.max(1, Math.ceil(count / cols)) };
}

/* ── Shared store: the map tab and the multiviewer tab read the same list. ── */

const EMPTY: WatchedCamera[] = [];
const listeners = new Set<() => void>();
/** Used when localStorage throws (blocked storage), so the list still works for this tab. */
let memory: string | null = null;
let cachedRaw: string | null | undefined;
let cachedList: WatchedCamera[] = EMPTY;

function readRaw(): string | null {
  try {
    return localStorage.getItem(SPACE_CAMS_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function snapshot(): WatchedCamera[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parseSpaceCams(raw);
  }
  return cachedList;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Fired by the browser when another tab writes the key.
  const onStorage = (event: StorageEvent) => {
    if (event.key === SPACE_CAMS_KEY || event.key === null) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function writeSpaceCams(next: WatchedCamera[]): void {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(SPACE_CAMS_KEY, raw);
  } catch {
    memory = raw;
  }
  for (const listener of listeners) listener();
}

/** The chosen CCTV, kept in sync across this browser's tabs. Empty during server render. */
export function useSpaceCams(): WatchedCamera[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
