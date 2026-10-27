import { describe, expect, it } from 'vitest';
import {
  applyFeedTransform,
  DEFAULT_ACTIVE_LAYERS,
  LAYER_POLL_MS,
  MARITIME_LIVE_MS,
  maritimePollGapMs,
  onceFeeds,
  pollFeeds,
  type ActiveLayers,
} from './layer-feeds';

function withEveryLayer(on: boolean): ActiveLayers {
  const next = { ...DEFAULT_ACTIVE_LAYERS };
  for (const key of Object.keys(next) as (keyof ActiveLayers)[]) next[key] = on;
  return next;
}

describe('onceFeeds', () => {
  it('requests nothing when every layer is off', () => {
    expect(onceFeeds(withEveryLayer(false), new Set())).toEqual([]);
  });

  it('requests each active feed once, in load order', () => {
    const feeds = onceFeeds(withEveryLayer(true), new Set());
    expect(feeds.map(feed => feed.key)).toEqual([
      'flights',
      'satellites',
      'fires',
      'maritime',
      'balloons',
      'radiation',
      'live_news',
      'weather',
      'gdelt',
      'cables',
      'cyber_attacks',
      'gdelt_events',
      'cloudflare_radar',
    ]);
    expect(onceFeeds(withEveryLayer(true), new Set(feeds.map(feed => feed.key)))).toEqual([]);
  });

  it('shares one flights request across the aviation toggles', () => {
    const layers = withEveryLayer(false);
    layers.military = true;
    expect(onceFeeds(layers, new Set())).toEqual([
      { key: 'flights', url: '/api/flights', transform: 'none', retryOnFailure: false, kind: 'json' },
    ]);
  });

  it('shares one satellite catalogue across the sublayers', () => {
    const layers = withEveryLayer(false);
    layers.sat_earth = true;
    const [feed] = onceFeeds(layers, new Set());
    expect(feed.key).toBe('satellites');
    expect(feed.url).toBe('/api/satellites');
  });

  it('lets a failed events or Cloudflare load be asked again, and keeps a failed flights load marked', () => {
    const layers = withEveryLayer(false);
    layers.gdelt_events = true;
    layers.cf_outages = true;
    layers.cf_attacks = true;
    layers.flights = true;
    const feeds = onceFeeds(layers, new Set());
    expect(feeds.find(feed => feed.key === 'gdelt_events')).toMatchObject({
      url: '/api/gdelt-events?limit=600',
      retryOnFailure: true,
    });
    expect(feeds.filter(feed => feed.key === 'cloudflare_radar')).toEqual([
      { key: 'cloudflare_radar', url: '/api/cloudflare-radar', transform: 'cloudflare-radar', retryOnFailure: true, kind: 'json' },
    ]);
    expect(feeds.find(feed => feed.key === 'flights')?.retryOnFailure).toBe(false);
    expect(onceFeeds(layers, new Set(['gdelt_events'])).some(feed => feed.key === 'gdelt_events')).toBe(false);
  });

  it('opens the operations map with only the Kotamaops layers, so no feed loads until asked for', () => {
    const on = (Object.keys(DEFAULT_ACTIVE_LAYERS) as (keyof ActiveLayers)[]).filter(key => DEFAULT_ACTIVE_LAYERS[key]);
    expect(on).toEqual(['tni_ad', 'tni_al', 'tni_au']);
    expect(onceFeeds(DEFAULT_ACTIVE_LAYERS, new Set())).toEqual([]);
  });

  it('skips weather once Live Alerts has already fetched it', () => {
    const layers = { ...withEveryLayer(false), weather: true, maritime: true };
    expect(onceFeeds(layers, new Set(['weather'])).map(feed => feed.key)).toEqual(['maritime']);
  });

  it('leaves cameras, earthquakes, malware, and Kotamaops to their own loaders', () => {
    const keys = new Set(onceFeeds(withEveryLayer(true), new Set()).map(feed => feed.key));
    for (const key of ['cctv', 'cctv_jm', 'cctv_jakarta', 'earthquakes', 'malware', 'tni_ad', 'alert_pins', 'war_alerts', 'sdk_sea']) {
      expect(keys.has(key)).toBe(false);
    }
  });
});

describe('pollFeeds', () => {
  it('repeats only the layers that stay on', () => {
    expect(pollFeeds(DEFAULT_ACTIVE_LAYERS)).toEqual([]);
    expect(pollFeeds({ ...withEveryLayer(false), maritime: true })).toEqual([
      { key: 'maritime', url: '/api/maritime', transform: 'maritime', everyMs: LAYER_POLL_MS, schedule: 'maritime', refreshFetchedKey: undefined },
    ]);
  });

  it('polls aviation, balloons, radiation, vessels, and botnet servers when they are on', () => {
    const feeds = pollFeeds(withEveryLayer(true));
    expect(feeds.map(feed => feed.key)).toEqual(['flights', 'balloons', 'radiation', 'maritime', 'cyber_attacks']);
    expect(feeds.find(feed => feed.key === 'cyber_attacks')?.refreshFetchedKey).toBe('cyber_attacks');
    expect(feeds.every(feed => feed.everyMs === LAYER_POLL_MS)).toBe(true);
  });

  it('waits ten seconds only while vessels are on the map', () => {
    expect(maritimePollGapMs(0)).toBe(LAYER_POLL_MS);
    expect(maritimePollGapMs(1)).toBe(MARITIME_LIVE_MS);
  });
});

describe('applyFeedTransform', () => {
  it('keeps the field names the map already reads', () => {
    expect(applyFeedTransform('none', { commercial_flights: [] })).toEqual({ commercial_flights: [] });
    expect(applyFeedTransform('satellites', { satellites: [], timestamp: 't' })).toEqual({
      satellites: [],
      timestamp: 't',
      satellites_at: 't',
    });
    expect(applyFeedTransform('maritime', { ports: [1], chokepoints: [2], ships: [3], extra: true })).toEqual({
      maritime_ports: [1],
      maritime_chokepoints: [2],
      maritime_ships: [3],
    });
    expect(applyFeedTransform('balloons', { balloons: [1] })).toEqual({ balloons: [1] });
    expect(applyFeedTransform('radiation', { stations: [1] })).toEqual({ radiation: [1] });
    expect(applyFeedTransform('live-news', { feeds: [1] })).toEqual({ live_feeds: [1] });
    expect(applyFeedTransform('weather', { events: [1] })).toEqual({ weather_events: [1] });
    expect(applyFeedTransform('gdelt', { events: [1] })).toEqual({ gdelt: [1] });
    expect(applyFeedTransform('cyber-attacks', { indicators: [1] })).toEqual({ cyber_attacks: [1] });
    expect(applyFeedTransform('gdelt-events', { events: [1] })).toEqual({ gdelt_events: [1] });
    expect(applyFeedTransform('cloudflare-radar', {})).toEqual({ cf_outages: [], cf_attack_origins: [] });
    expect(applyFeedTransform('cloudflare-radar', { outages: [1], attack_origins: [2] })).toEqual({
      cf_outages: [1],
      cf_attack_origins: [2],
    });
  });
});
