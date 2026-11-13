import { describe, it, expect, beforeEach } from 'vitest';
import { cachedSource, clearSourceCache, forgetSource, peekSource, seedSource, sourceHealth } from './sourceCache';

type Cam = { id: string };
const cam = (id: string): Cam => ({ id });

beforeEach(() => clearSourceCache());

describe('cachedSource', () => {
  it('fetches once and serves the cached list afterwards', async () => {
    let calls = 0;
    const load = cachedSource<Cam>('t1', async () => { calls++; return [cam('a')]; });

    expect(await load()).toEqual([cam('a')]);
    expect(await load()).toEqual([cam('a')]);
    expect(calls).toBe(1);
  });

  it('refetches once the TTL has elapsed', async () => {
    let calls = 0;
    const load = cachedSource<Cam>('t2', async () => { calls++; return [cam(`v${calls}`)]; }, 10);

    await load();
    await new Promise((r) => setTimeout(r, 25));
    expect(await load()).toEqual([cam('v2')]);
    expect(calls).toBe(2);
  });

  // region=all fans out to every source at once — a cold cache must not
  // multiply into N concurrent upstream requests.
  it('collapses concurrent misses into a single upstream call', async () => {
    let calls = 0;
    const load = cachedSource<Cam>('t3', async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 30));
      return [cam('a')];
    });

    const all = await Promise.all([load(), load(), load(), load()]);
    expect(calls).toBe(1);
    for (const r of all) expect(r).toEqual([cam('a')]);
  });

  it('keeps serving the last good list when a refresh throws', async () => {
    let mode: 'ok' | 'fail' = 'ok';
    const load = cachedSource<Cam>('t4', async () => {
      if (mode === 'fail') throw new Error('upstream down');
      return [cam('good')];
    }, 10);

    expect(await load()).toEqual([cam('good')]);
    mode = 'fail';
    await new Promise((r) => setTimeout(r, 25));
    // stale data rather than an empty layer
    expect(await load()).toEqual([cam('good')]);
  });

  it('treats an empty refresh as a failed one and holds the previous list', async () => {
    let mode: 'ok' | 'empty' = 'ok';
    const load = cachedSource<Cam>('t5', async () => (mode === 'ok' ? [cam('good')] : []), 10);

    await load();
    mode = 'empty';
    await new Promise((r) => setTimeout(r, 25));
    expect(await load()).toEqual([cam('good')]);
  });

  it('returns empty when the first fetch fails with nothing cached', async () => {
    const load = cachedSource<Cam>('t6', async () => { throw new Error('down'); });
    expect(await load()).toEqual([]);
  });

  it('does not hit a dead upstream again during the failure cooldown', async () => {
    let calls = 0;
    const load = cachedSource<Cam>('t6b', async () => {
      calls += 1;
      throw new Error('down');
    }, 60_000);
    expect(await load()).toEqual([]);
    expect(await load()).toEqual([]);
    expect(calls).toBe(1);
  });

  it('does not let a forgotten fetch write the old list back', async () => {
    let release: (rows: Cam[]) => void = () => {};
    const load = cachedSource<Cam>('forget', () => new Promise(resolve => { release = resolve; }));
    const pending = load();
    forgetSource('forget');
    release([cam('old')]);
    await pending;
    const again = cachedSource<Cam>('forget', async () => [cam('new')]);
    expect(await again()).toEqual([cam('new')]);
  });

  it('keeps separate keys independent', async () => {
    const a = cachedSource<Cam>('t7a', async () => [cam('a')]);
    const b = cachedSource<Cam>('t7b', async () => [cam('b')]);
    expect(await a()).toEqual([cam('a')]);
    expect(await b()).toEqual([cam('b')]);
  });

  it('throws on failure with nothing cached when asked to, including during the cooldown', async () => {
    let calls = 0;
    const load = cachedSource<Cam>('t8', async () => { calls++; throw new Error('down'); }, 60_000, true, { throwOnFailure: true });
    await expect(load()).rejects.toThrow('down');
    await expect(load()).rejects.toThrow('unavailable');
    expect(calls).toBe(1);
  });

  it('retries an empty first result after a short cooldown, not the full TTL', async () => {
    let calls = 0;
    const load = cachedSource<Cam>('t9', async () => { calls++; return []; }, 30 * 60_000);
    const realNow = Date.now;
    try {
      await load();
      await load();
      expect(calls).toBe(1);
      Date.now = () => realNow() + 61_000;
      await load();
      expect(calls).toBe(2);
    } finally {
      Date.now = realNow;
    }
  });

  /* The prebuilt CCTV payload is served without reading cctv:* for minutes at a
     time, while 30 operators typing in search create hundreds of keys. Only the
     per-query keys may be evicted. */
  it('never evicts a fixed source, even one not read while queries overflow the cap', async () => {
    seedSource('cctv:jakarta', [cam('j')]);
    await cachedSource<Cam>('earthquakes:bmkg', async () => [cam('q')])();
    for (let i = 0; i < 600; i++) {
      await cachedSource<Cam>(`geosearch:${i}`, async () => [cam(String(i))], undefined, true, { transient: true })();
    }
    expect(peekSource('cctv:jakarta', true)).toEqual([cam('j')]);
    expect(peekSource('earthquakes:bmkg', true)).toEqual([cam('q')]);
    expect(peekSource('geosearch:0', true)).toBeUndefined();
    expect(peekSource('geosearch:599', true)).toEqual([cam('599')]);
  });

  /* Many CCTV fetchers return [] on error. Holding the old list is right, but
     for the full 30-minute TTL it pinned a regional outage. */
  it('retries soon after an empty refresh that kept the previous list', async () => {
    let mode: 'ok' | 'empty' = 'ok';
    let calls = 0;
    const load = cachedSource<Cam>('t10', async () => { calls++; return mode === 'ok' ? [cam('a')] : []; }, 30 * 60_000);
    const realNow = Date.now;
    try {
      await load();
      mode = 'empty';
      Date.now = () => realNow() + 31 * 60_000;
      expect(await load()).toEqual([cam('a')]);
      mode = 'ok';
      Date.now = () => realNow() + 31 * 60_000 + 61_000;
      await load();
      expect(calls).toBe(3);
    } finally {
      Date.now = realNow;
    }
  });

  /* The status bar reads these. Serving the last good list during an outage is
     right, but it must not look like a fresh answer. */
  it('records when data arrived and since when refreshes fail', async () => {
    let mode: 'ok' | 'fail' = 'ok';
    const load = cachedSource<Cam>('health', async () => {
      if (mode === 'fail') throw new Error('down');
      return [cam('a')];
    }, 10);
    expect(sourceHealth('health')).toBeUndefined();

    await load();
    const first = sourceHealth('health')!;
    expect(first.count).toBe(1);
    expect(first.fetchedAt).toBeTypeOf('number');
    expect(first.failedAt).toBeUndefined();

    mode = 'fail';
    await new Promise(r => setTimeout(r, 25));
    await load();
    const failing = sourceHealth('health')!;
    expect(failing.fetchedAt).toBe(first.fetchedAt);
    expect(failing.failedAt).toBeTypeOf('number');

    mode = 'ok';
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 61_000;
      await load();
    } finally {
      Date.now = realNow;
    }
    const recovered = sourceHealth('health')!;
    expect(recovered.failedAt).toBeUndefined();
    expect(recovered.fetchedAt!).toBeGreaterThan(first.fetchedAt!);
  });

  it('marks an empty answer with nothing cached as failing', async () => {
    await cachedSource<Cam>('health-empty', async () => [])();
    expect(sourceHealth('health-empty')).toMatchObject({ count: 0, failedAt: expect.any(Number) });
  });
});
