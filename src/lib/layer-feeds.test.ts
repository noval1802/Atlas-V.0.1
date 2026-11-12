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
      'fires',
      'volcanoes',
      'maritime',
      'balloons',
      'radiation',
      'live_news',
      'weather',
      'gdelt',
      'gdelt_events',
    ]);
    expect(onceFeeds(withEveryLayer(true), new Set(feeds.map(feed => feed.key)))).toEqual([]);
  });

  it('lets a failed events load be asked again, and keeps a failed fires load marked', () => {
    const layers = withEveryLayer(false);
    layers.gdelt_events = true;
    layers.fires = true;
    const feeds = onceFeeds(layers, new Set());
    expect(feeds.find(feed => feed.key === 'gdelt_events')).toMatchObject({
      url: '/api/gdelt-events?limit=600',
      retryOnFailure: true,
    });
    expect(feeds.find(feed => feed.key === 'fires')?.retryOnFailure).toBe(false);
    expect(onceFeeds(layers, new Set(['gdelt_events'])).some(feed => feed.key === 'gdelt_events')).toBe(false);
  });

  it('opens the operations map with only the Kotamaops layers, so no feed loads until asked for', () => {
    // The volcano level filters default on, but draw nothing until the volcano layer is.
    const on = (Object.keys(DEFAULT_ACTIVE_LAYERS) as (keyof ActiveLayers)[])
      .filter(key => DEFAULT_ACTIVE_LAYERS[key] && !key.startsWith('volcano_'));
    expect(on).toEqual(['tni_ad', 'tni_al', 'tni_au']);
    expect(DEFAULT_ACTIVE_LAYERS.volcanoes).toBe(false);
    expect(onceFeeds(DEFAULT_ACTIVE_LAYERS, new Set())).toEqual([]);
  });

  it('skips weather once Live Alerts has already fetched it', () => {
    const layers = { ...withEveryLayer(false), weather: true, maritime: true };
    expect(onceFeeds(layers, new Set(['weather'])).map(feed => feed.key)).toEqual(['maritime']);
  });

  it('leaves cameras, earthquakes, and Kotamaops to their own loaders', () => {
    const keys = new Set(onceFeeds(withEveryLayer(true), new Set()).map(feed => feed.key));
    for (const key of ['cctv', 'cctv_jm', 'cctv_jakarta', 'earthquakes', 'tni_ad', 'alert_pins', 'war_alerts']) {
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

  it('polls balloons, radiation, volcanoes, and vessels when they are on', () => {
    const feeds = pollFeeds(withEveryLayer(true));
    expect(feeds.map(feed => feed.key)).toEqual(['balloons', 'radiation', 'volcanoes', 'maritime']);
    expect(feeds.every(feed => feed.everyMs === LAYER_POLL_MS)).toBe(true);
  });

  it('waits ten seconds only while vessels are on the map', () => {
    expect(maritimePollGapMs(0)).toBe(LAYER_POLL_MS);
    expect(maritimePollGapMs(1)).toBe(MARITIME_LIVE_MS);
  });
});

describe('applyFeedTransform', () => {
  it('keeps the field names the map already reads', () => {
    expect(applyFeedTransform('none', { fires: [] })).toEqual({ fires: [] });
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
    expect(applyFeedTransform('gdelt-events', { events: [1] })).toEqual({ gdelt_events: [1] });
  });
});
