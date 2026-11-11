/**
 * What a map click can see.
 * MapLibre stringifies some properties, so a boolean may arrive as "true"
 * and a number may arrive as a string. Each popup names the fields it reads.
 */

export interface ClickedFeature {
  properties?: Record<string, unknown> | null;
  geometry?: { type?: string; coordinates?: unknown };
}

/** The properties of the feature under the cursor, or nothing if the click missed. */
export function clickedProperties<P extends Record<string, unknown>>(
  event: { features?: ClickedFeature[] },
): P | null {
  const properties = event.features?.[0]?.properties;
  if (!properties) return null;
  return properties as P;
}

/** [lng, lat] for a point feature. A line or a polygon is not a popup anchor. */
export function pointCoordinates(
  geometry: { type?: string; coordinates?: unknown } | undefined,
): [number, number] | null {
  if (!geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) return null;
  const [lng, lat] = geometry.coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  return [lng, lat];
}

export interface FlightPopup extends Record<string, unknown> {
  callsign?: string;
  icao24?: string;
  model?: string;
  alt?: number;
  speed_knots?: number | string;
  heading?: number;
  registration?: string;
}

export interface CameraPopup extends Record<string, unknown> {
  id?: string | number;
  name?: string;
  city?: string;
  country?: string;
  source?: string;
  feed_url?: string;
  stream_url?: string;
  stream_type?: string;
  external_url?: string;
}

export interface EarthquakePopup extends Record<string, unknown> {
  id?: string;
  magnitude?: number | string;
  place?: string;
  depth?: number | string;
  source?: string;
  url?: string;
  /** Epoch ms of the event; null when the feed gave none. */
  time?: number | null;
}

/** BMKG's "latest M5+" list can hold quakes weeks old; past this age a quake gets no magnitude label. */
export const QUAKE_LABEL_MAX_AGE_H = 72;

/**
 * Map properties for one quake. `age_h` drives the circle fade and the label
 * cut-off, so an old event can no longer look like a new one. A quake with no
 * time is treated as old (fully faded, unlabelled) rather than as current.
 */
export function earthquakeProperties(
  eq: { id?: string; magnitude?: number; place?: string; depth?: number; source?: string; url?: string; time?: number },
  now: number,
) {
  const time = typeof eq.time === 'number' && Number.isFinite(eq.time) ? eq.time : null;
  return {
    id: eq.id,
    magnitude: eq.magnitude,
    place: eq.place,
    depth: eq.depth,
    source: eq.source,
    url: eq.url,
    time,
    age_h: time == null ? 9999 : Math.max(0, (now - time) / 3_600_000),
  };
}

const WIB = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** "10 Nov 2026 14.32 WIB" — the time zone Pusdalops reads in. */
export function formatWib(ms: number): string {
  return `${WIB.format(ms)} WIB`;
}

export interface VolcanoPopup extends Record<string, unknown> {
  code?: string;
  name?: string;
  province?: string;
  elevation?: number | string;
  level?: number | string;
  erupting?: boolean | string;
  vona?: boolean | string;
}

export interface FirePopup extends Record<string, unknown> {
  brightness?: number | string;
}

export interface GdeltEventPopup extends Record<string, unknown> {
  quad?: string | number;
  quad_label?: string;
  name?: string;
  goldstein?: number | string;
  tone?: number | string;
  articles?: number | string;
  country?: string;
  date?: string;
  url?: string;
}

export interface IncidentPopup extends Record<string, unknown> {
  url?: string;
  kind?: string;
  name?: string;
}

export interface BalloonPopup extends Record<string, unknown> {
  color?: string;
  callsign?: string;
  type: string;
  status: string;
  altitude?: number | string;
  speed: number;
  verticalRate: number;
  temperature?: number | string;
}

export interface RadiationPopup extends Record<string, unknown> {
  status?: string;
  name?: string;
  city?: string;
  country?: string;
  reading?: number | string;
  network?: string;
}

export interface ShipPopup extends Record<string, unknown> {
  type?: string;
  flag?: string;
  name?: string;
  speed?: number | string;
  heading?: number | string;
  destination?: string;
  mmsi?: string | number;
}

export interface WeatherPopup extends Record<string, unknown> {
  icon?: string;
  type?: string;
  title?: string;
  severity?: string;
  source?: string;
  description?: string;
  infographic?: string;
}

export interface KotamaopsPopup extends Record<string, unknown> {
  logo?: string;
  matra?: string;
  code?: string;
  name?: string;
  region?: string;
  location?: string;
}

export interface PortPopup extends Record<string, unknown> {
  type?: string;
  name?: string;
  country?: string;
  volume?: string | number;
  fleet?: string | number;
  rank?: string | number;
  congestion?: string;
  dwell_time?: string;
}

export interface ChokePopup extends Record<string, unknown> {
  name?: string;
  traffic?: string | number;
  risk?: string;
}

export interface NewsPopup extends Record<string, unknown> {
  name?: string;
  city?: string;
  country?: string;
  url?: string;
  category?: string;
  embed_allowed?: boolean | string;
}

/** Text for an HTML string built by hand (popups go through Popup.setHTML). */
export function htmlEsc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * An http(s) URL ready to sit inside a quoted href/src attribute, or '#'.
 * Escaped here because every caller puts it in quotes: a feed URL containing
 * `" onmouseover="…` passes the scheme check and would otherwise break out.
 */
export function urlSafe(value: unknown): string {
  const url = String(value ?? '');
  return /^https?:\/\//i.test(url) ? htmlEsc(url) : '#';
}
