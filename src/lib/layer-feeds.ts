import type { MapData } from '@/lib/map-data';

/** Which map layers are on. The page owns the state; this module only decides what to load. */
export interface ActiveLayers {
  flights: boolean;
  private: boolean;
  jets: boolean;
  military: boolean;
  maritime: boolean;
  satellites: boolean;
  sat_comms: boolean;
  sat_military: boolean;
  sat_navigation: boolean;
  sat_earth: boolean;
  sat_science: boolean;
  balloons: boolean;
  cctv: boolean;
  /** Absent on the original map page. The monitoring dashboard sets these. */
  cctv_jm?: boolean;
  cctv_jakarta?: boolean;
  cctv_previews: boolean;
  live_news: boolean;
  earthquakes: boolean;
  fires: boolean;
  weather: boolean;
  radiation: boolean;
  global_incidents: boolean;
  alert_pins: boolean;
  war_alerts: boolean;
  day_night: boolean;
  cables: boolean;
  sdk_sea: boolean;
  sdk_air: boolean;
  sdk_naval: boolean;
  /** Absent on the original map page. The monitoring dashboard sets this. */
  tni_ad?: boolean;
  tni_al?: boolean;
  tni_au?: boolean;
  terrain_3d: boolean;
  terrain_elevation: boolean;
  malware: boolean;
  cyber_attacks: boolean;
  gdelt_events: boolean;
  cf_outages: boolean;
  cf_attacks: boolean;
  /**
   * Read by the map, never written by the dashboard.
   * Absent means the mesh follows the malware layer.
   */
  internet_outages?: boolean;
}

/** Most layers stay off so the first load stays small. */
export const DEFAULT_ACTIVE_LAYERS: ActiveLayers = {
  flights: false,
  private: false,
  jets: false,
  military: false,
  maritime: false,
  satellites: false,
  sat_comms: false,
  sat_military: false,
  sat_navigation: false,
  sat_earth: false,
  sat_science: false,
  balloons: false,
  cctv: false,
  /* Jasa Marga toll cameras, switched separately from the public CCTV catalogue. */
  cctv_jm: false,
  /* Jakarta TPT cameras, switched separately from the public CCTV catalogue. */
  cctv_jakarta: false,
  /* The live preview tiles over the camera dots — see CctvPreviews. */
  cctv_previews: false,
  live_news: false,
  earthquakes: false,
  fires: false,
  weather: false,
  radiation: false,
  global_incidents: false,
  /* Live Alerts reports pinned to the place they name — see alert-places.
     Off until asked for, like the other threat layers: the map opens with
     what a reader has chosen to see, and the feed reads the same without it. */
  alert_pins: false,
  war_alerts: false,
  day_night: false,
  cables: false,
  sdk_sea: false,
  sdk_air: false,
  sdk_naval: false,
  /* Peta operasi dibuka hanya dengan Kotamaops per matra; layer lain dinyalakan sendiri oleh pengguna. */
  tni_ad: true,
  tni_al: true,
  tni_au: true,
  terrain_3d: false,
  terrain_elevation: false,
  malware: false,
  cyber_attacks: false,
  gdelt_events: false,
  cf_outages: false,
  cf_attacks: false,
};

/** How an upstream JSON body is stored on the map data object. */
export type FeedTransform =
  | 'none'
  | 'satellites'
  | 'maritime'
  | 'balloons'
  | 'radiation'
  | 'live-news'
  | 'weather'
  | 'gdelt'
  | 'cyber-attacks'
  | 'gdelt-events'
  | 'cloudflare-radar';

export interface OnceFeed {
  /** Key in the page's already-fetched set. Not always the layer name. */
  key: string;
  url: string;
  transform: FeedTransform;
  /**
   * When true, a failed response must drop `key` so the next run can try again.
   * The page marks the key before awaiting, so a re-render mid-flight cannot
   * double-fetch, and a failed request does not leave the layer empty forever.
   */
  retryOnFailure: boolean;
  /** `static` is the cable file. Everything else goes through the JSON fetcher. */
  kind: 'json' | 'static';
}

export interface PollFeed {
  key: string;
  url: string;
  transform: FeedTransform;
  everyMs: number;
  /** Maritime reschedules from the latest ship count instead of a fixed interval. */
  schedule: 'interval' | 'maritime';
  /** Set only for the botnet poll, which clears this fetched key around the call. */
  refreshFetchedKey?: string;
}

const FLIGHT_LAYERS = ['flights', 'military', 'jets', 'private'] as const satisfies readonly (keyof ActiveLayers)[];
const SATELLITE_LAYERS = ['satellites', 'sat_comms', 'sat_military', 'sat_navigation', 'sat_earth', 'sat_science'] as const satisfies readonly (keyof ActiveLayers)[];

/** Five minutes. These layers used to poll faster; the slower cadence is intentional. */
export const LAYER_POLL_MS = 300_000;

/** A moving vessel is worth a ten-second refresh. An empty AIS reply is not. */
export const MARITIME_LIVE_MS = 10_000;

function anyOn(layers: ActiveLayers, keys: readonly (keyof ActiveLayers)[]): boolean {
  return keys.some(key => layers[key]);
}

interface OnceRule {
  key: string;
  url: string;
  transform: FeedTransform;
  retryOnFailure: boolean;
  kind: 'json' | 'static';
  when: (layers: ActiveLayers) => boolean;
}

const ONCE_RULES: OnceRule[] = [
  { key: 'flights', url: '/api/flights', transform: 'none', retryOnFailure: false, kind: 'json', when: layers => anyOn(layers, FLIGHT_LAYERS) },
  { key: 'satellites', url: '/api/satellites', transform: 'satellites', retryOnFailure: false, kind: 'json', when: layers => anyOn(layers, SATELLITE_LAYERS) },
  { key: 'fires', url: '/api/fires', transform: 'none', retryOnFailure: false, kind: 'json', when: layers => layers.fires },
  { key: 'maritime', url: '/api/maritime', transform: 'maritime', retryOnFailure: false, kind: 'json', when: layers => layers.maritime },
  { key: 'balloons', url: '/api/balloons', transform: 'balloons', retryOnFailure: false, kind: 'json', when: layers => layers.balloons },
  { key: 'radiation', url: '/api/radiation', transform: 'radiation', retryOnFailure: false, kind: 'json', when: layers => layers.radiation },
  { key: 'live_news', url: '/api/live-news', transform: 'live-news', retryOnFailure: false, kind: 'json', when: layers => layers.live_news },
  // The page also loads weather for Live Alerts and marks this key first, so a normal startup does not fetch it twice.
  { key: 'weather', url: '/api/weather', transform: 'weather', retryOnFailure: false, kind: 'json', when: layers => layers.weather },
  { key: 'gdelt', url: '/api/gdelt', transform: 'gdelt', retryOnFailure: false, kind: 'json', when: layers => layers.global_incidents },
  { key: 'cables', url: '/data/submarine-cables.json', transform: 'none', retryOnFailure: false, kind: 'static', when: layers => layers.cables },
  { key: 'cyber_attacks', url: '/api/cyber-attacks', transform: 'cyber-attacks', retryOnFailure: false, kind: 'json', when: layers => layers.cyber_attacks },
  { key: 'gdelt_events', url: '/api/gdelt-events?limit=600', transform: 'gdelt-events', retryOnFailure: true, kind: 'json', when: layers => layers.gdelt_events },
  { key: 'cloudflare_radar', url: '/api/cloudflare-radar', transform: 'cloudflare-radar', retryOnFailure: true, kind: 'json', when: layers => layers.cf_outages || layers.cf_attacks },
];

/** Feeds still needed for the layers that are on and not already fetched. */
export function onceFeeds(layers: ActiveLayers, fetched: ReadonlySet<string>): OnceFeed[] {
  const due: OnceFeed[] = [];
  for (const rule of ONCE_RULES) {
    if (!rule.when(layers) || fetched.has(rule.key)) continue;
    due.push({
      key: rule.key,
      url: rule.url,
      transform: rule.transform,
      retryOnFailure: rule.retryOnFailure,
      kind: rule.kind,
    });
  }
  return due;
}

interface PollRule {
  key: string;
  url: string;
  transform: FeedTransform;
  everyMs: number;
  schedule: 'interval' | 'maritime';
  refreshFetchedKey?: string;
  when: (layers: ActiveLayers) => boolean;
}

const POLL_RULES: PollRule[] = [
  { key: 'flights', url: '/api/flights', transform: 'none', everyMs: LAYER_POLL_MS, schedule: 'interval', when: layers => anyOn(layers, FLIGHT_LAYERS) },
  { key: 'balloons', url: '/api/balloons', transform: 'balloons', everyMs: LAYER_POLL_MS, schedule: 'interval', when: layers => layers.balloons },
  { key: 'radiation', url: '/api/radiation', transform: 'radiation', everyMs: LAYER_POLL_MS, schedule: 'interval', when: layers => layers.radiation },
  { key: 'maritime', url: '/api/maritime', transform: 'maritime', everyMs: LAYER_POLL_MS, schedule: 'maritime', when: layers => layers.maritime },
  { key: 'cyber_attacks', url: '/api/cyber-attacks', transform: 'cyber-attacks', everyMs: LAYER_POLL_MS, schedule: 'interval', refreshFetchedKey: 'cyber_attacks', when: layers => layers.cyber_attacks },
];

/** Repeating loads for layers that are on. The page owns the timers. */
export function pollFeeds(layers: ActiveLayers): PollFeed[] {
  const due: PollFeed[] = [];
  for (const rule of POLL_RULES) {
    if (!rule.when(layers)) continue;
    due.push({
      key: rule.key,
      url: rule.url,
      transform: rule.transform,
      everyMs: rule.everyMs,
      schedule: rule.schedule,
      refreshFetchedKey: rule.refreshFetchedKey,
    });
  }
  return due;
}

export function maritimePollGapMs(shipCount: number): number {
  return shipCount > 0 ? MARITIME_LIVE_MS : LAYER_POLL_MS;
}

/** Store one upstream body the way the map already reads it. */
export function applyFeedTransform(transform: FeedTransform, payload: unknown): Partial<MapData> {
  const body = payload as Record<string, unknown>;
  switch (transform) {
    case 'none':
      return body as Partial<MapData>;
    case 'satellites':
      // The catalogue is fetched once, so an orbit drawn later needs this epoch to pass through the marker.
      return { ...body, satellites_at: body.timestamp } as Partial<MapData>;
    case 'maritime':
      return { maritime_ports: body.ports, maritime_chokepoints: body.chokepoints, maritime_ships: body.ships } as Partial<MapData>;
    case 'balloons':
      return { balloons: body.balloons } as Partial<MapData>;
    case 'radiation':
      return { radiation: body.stations } as Partial<MapData>;
    case 'live-news':
      return { live_feeds: body.feeds } as Partial<MapData>;
    case 'weather':
      return { weather_events: body.events } as Partial<MapData>;
    case 'gdelt':
      return { gdelt: body.events } as Partial<MapData>;
    case 'cyber-attacks':
      return { cyber_attacks: body.indicators } as Partial<MapData>;
    case 'gdelt-events':
      return { gdelt_events: body.events } as Partial<MapData>;
    case 'cloudflare-radar':
      return { cf_outages: body.outages ?? [], cf_attack_origins: body.attack_origins ?? [] } as Partial<MapData>;
  }
}
