import type { Bloc } from '@/lib/alert-digest';
import type { CatalogCamera } from '@/lib/camera-catalog';
import type { KotamaopsPoint } from '@/lib/kotamaops-points';

/**
 * One map row whose fields differ by feed.
 * Named coordinates stay typed; the rest of an upstream record stays open.
 */
export interface MapRecord {
  lat?: number;
  lng?: number;
  source?: unknown;
  id?: string | number;
  icao24?: string;
  mmsi?: string | number;
  imo?: string | number;
  noradId?: string | number;
  callsign?: string;
  name?: string;
  place?: string;
  model?: string;
  alt?: number;
  altitude?: number;
  destination?: string;
  flag?: string;
  city?: string;
  country?: string;
  magnitude?: number;
  type?: string;
  title?: string;
  category?: string;
  [key: string]: unknown | undefined;
}

interface MapPointRow {
  lat?: number;
  lng?: number;
}

/** An aircraft position the map and the watch panel read. */
export interface FlightRow extends MapPointRow {
  callsign?: string;
  heading?: number;
  alt?: number;
  model?: string;
  speed_knots?: number;
  registration?: string;
  icao24?: string;
  grounded?: boolean;
  squawk?: string;
}

export interface PortRow extends MapPointRow {
  name?: string;
  country?: string;
  type?: string;
  volume?: string | number;
  fleet?: string | number;
  rank?: string | number;
  congestion?: string;
  dwell_time?: string;
}

export interface ChokepointRow extends MapPointRow {
  name?: string;
  traffic?: string | number;
  risk?: string;
}

export interface ShipRow extends MapPointRow {
  id?: string | number;
  name?: string;
  mmsi?: string | number;
  type?: string;
  speed?: number;
  heading?: number;
  destination?: string;
  flag?: string;
}

export interface EarthquakeRow extends MapPointRow {
  id?: string;
  depth?: number;
  magnitude?: number;
  place?: string;
  source?: string;
  time?: number;
  url?: string;
  tsunami?: number;
  type?: string;
  felt?: number;
  alert?: string | null;
}

export interface FireRow extends MapPointRow {
  brightness?: number;
}

export interface WeatherRow extends MapPointRow {
  id?: string;
  title?: string;
  type?: string;
  icon?: string;
  severity?: string;
  source?: string;
  description?: string;
  infographic?: string;
}

export interface GdeltRow extends MapPointRow {
  name?: string;
  url?: string;
  type?: string;
}

export interface GdeltEventRow extends MapPointRow {
  name?: string;
  country?: string;
  quad?: string;
  quad_label?: string;
  tone?: number;
  goldstein?: number;
  articles?: number;
  url?: string;
  date?: string;
}

export interface BalloonRow extends MapPointRow {
  callsign?: string;
  type?: string;
  status?: string;
  altitude?: number;
  speed?: number;
  verticalRate?: number;
  temperature?: number;
  color?: string;
}

export interface RadiationRow extends MapPointRow {
  name?: string;
  city?: string;
  country?: string;
  reading?: string | number;
  status?: string;
  network?: string;
}

export interface LiveFeedRow extends MapPointRow {
  name?: string;
  city?: string;
  country?: string;
  url?: string;
  category?: string;
  /** Some feeds send the string "false" instead of a boolean. */
  embed_allowed?: boolean | string;
}

export interface NewsRow {
  title?: string;
  source?: string;
  link?: string;
  published?: string;
  risk_score?: number;
  keyword_assessment?: string;
  coords_anchor?: string;
  coords?: [number, number] | null;
}

/** Fields the satellite layer and its popup read. */
export interface SatellitePoint {
  name: string;
  lat: number;
  lng: number;
  alt: number;
  color?: string;
  mission?: string;
  category?: string;
  noradId?: string;
}

/** A Live Alerts report as the pin layer reads it. */
export interface AlertPinReport {
  id: string;
  alert_kind?: string;
  title: string;
  source_name: string;
  lean?: string | null;
  published: string;
  link?: string | null;
  coords?: [number, number] | null;
  place?: { name: string; label: string; precision: string } | null;
  media?: { kind?: string; video?: string | null; thumb?: string | null; duration?: string | null } | null;
}

export interface NewsSourceHealth {
  handle: string;
  name: string;
  lean: string;
  bloc: Bloc;
  kind?: 'telegram' | 'wire';
  count: number;
  latest: string | null;
}

export interface NewsMeta {
  sources?: NewsSourceHealth[];
  fetchedAt?: string | null;
}

/**
 * The dashboard store. Every feed writes one of these fields.
 * A missing field means that feed has not landed yet.
 */
export interface MapData {
  kotamaops?: KotamaopsPoint[];
  commercial_flights?: FlightRow[];
  private_flights?: FlightRow[];
  private_jets?: FlightRow[];
  military_flights?: FlightRow[];
  maritime_ports?: PortRow[];
  maritime_chokepoints?: ChokepointRow[];
  maritime_ships?: ShipRow[];
  satellites?: SatellitePoint[];
  /** Epoch the satellite positions were propagated for. */
  satellites_at?: string;
  category_counts?: Record<string, number>;
  cameras?: CatalogCamera[];
  earthquakes?: EarthquakeRow[];
  fires?: FireRow[];
  weather_events?: WeatherRow[];
  gdelt?: GdeltRow[];
  gdelt_events?: GdeltEventRow[];
  balloons?: BalloonRow[];
  radiation?: RadiationRow[];
  live_feeds?: LiveFeedRow[];
  news?: NewsRow[];
  news_meta?: NewsMeta;
  alert_pins?: AlertPinReport[];
}

/**
 * The array stored under a catalog key such as `commercial_flights`.
 * A missing key or a non-array (a feed that has not landed, or a bad payload)
 * is skipped, so callers do not report a confident zero.
 */
export function mapDataList(data: object, key: string): MapRecord[] | undefined {
  const value = (data as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return undefined;
  return value as MapRecord[];
}
