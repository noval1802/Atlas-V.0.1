import { describe, expect, it } from 'vitest';
import { newsTransform } from './news-transform';

describe('newsTransform', () => {
  it('keeps the feed metadata beside the reports', () => {
    const out = newsTransform({
      news: [{ title: 'A', place: null }],
      sources: [],
      timestamp: '2026-10-11T00:00:00Z',
    });
    expect(out.news).toHaveLength(1);
    expect(out.news_meta).toEqual({ sources: [], fetchedAt: '2026-10-11T00:00:00Z' });
    expect(out.alert_pins).toEqual([]);
  });

  it('pins only a report that names a place', () => {
    const out = newsTransform({
      news: [
        { title: 'Placed', place: { name: 'Tokyo', label: 'Tokyo', precision: 'settlement' } },
        { title: 'Loose' },
      ],
    });
    expect(out.alert_pins).toHaveLength(1);
    expect(out.alert_pins?.[0].title).toBe('Placed');
    expect(out.news_meta?.fetchedAt).toBeNull();
  });
});
