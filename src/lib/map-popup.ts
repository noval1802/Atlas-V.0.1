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
}

export interface FirePopup extends Record<string, unknown> {
  brightness?: number | string;
}

export interface MalwarePopup extends Record<string, unknown> {
  threat_type?: string;
  status?: string;
  city?: string;
  country?: string;
  as_name?: string;
  asn?: string | number;
  url_count?: number | string;
  reference?: string;
  malware?: string;
  ip?: string;
  port?: number | string;
  last_seen?: string;
  first_seen?: string;
  reporter?: string;
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

export interface OutagePopup extends Record<string, unknown> {
  ongoing?: boolean | string;
  url?: string;
  country_name?: string;
  description?: string;
  cause?: string;
  scope?: string;
  start?: string;
  end?: string;
}

export interface AttackPopup extends Record<string, unknown> {
  country_name?: string;
  share?: number | string;
  country?: string;
}

export interface IncidentPopup extends Record<string, unknown> {
  url?: string;
  kind?: string;
  name?: string;
}

export interface ConflictPopup extends Record<string, unknown> {
  severity?: string;
  label?: string;
  description?: string;
  sourceUrl?: string;
}

export interface SdkLinkPopup extends Record<string, unknown> {
  url?: string;
  source?: string;
  domain?: string;
  fromName?: string;
  toName?: string;
}

export interface CyberPopup extends Record<string, unknown> {
  status?: string;
  malware?: string;
  ip?: string;
  port?: number | string;
  country?: string;
  as_number?: string | number;
  first_seen?: string;
  last_online?: string;
  hostname?: string;
  source_url?: string;
}

export interface ScanPopup extends Record<string, unknown> {
  id?: string;
  city?: string;
  country?: string;
  isp?: string;
  type?: string;
}

export interface SupplierPopup extends Record<string, unknown> {
  risk_level?: string;
  active_threats?: string;
  name?: string;
  category?: string;
  city?: string;
  country?: string;
}

export interface SweepPopup extends Record<string, unknown> {
  ports?: string;
  vulns?: string;
  hostnames?: string;
  color?: string;
  device_type?: string;
  ip?: string;
  risk_level?: string;
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
}

export interface FacilityPopup extends Record<string, unknown> {
  status?: string;
  sourceUrl?: string;
  name?: string;
  city?: string;
  country?: string;
  owner?: string;
  reactors?: string | number;
  capacityMW?: string | number;
}

export interface KotamaopsPopup extends Record<string, unknown> {
  logo?: string;
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
