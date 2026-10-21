import { describe, expect, it } from 'vitest';
import { conflictFeed } from './map-overlays';

describe('conflictFeed', () => {
  it('keeps zone anchors and live events', () => {
    const feed = conflictFeed({
      zones: [{ label: 'UKRAINE WAR', lat: 48.5, lng: 31.2, eventCount: 3 }],
      liveEvents: [{ title: 'strike', lat: 48.1, lng: 31.4, url: 'https://example.test' }],
    });
    expect(feed.zones).toHaveLength(1);
    expect(feed.zones[0].label).toBe('UKRAINE WAR');
    expect(feed.liveEvents[0].url).toBe('https://example.test');
  });

  it('returns empty lists when the body or a list is not an array', () => {
    expect(conflictFeed(null)).toEqual({ zones: [], liveEvents: [] });
    expect(conflictFeed('zones')).toEqual({ zones: [], liveEvents: [] });
    expect(conflictFeed({ zones: { label: 'nope' }, liveEvents: [] })).toEqual({ zones: [], liveEvents: [] });
  });
});
