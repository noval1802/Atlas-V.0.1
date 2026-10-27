import { afterEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('@/lib/ops/db', () => ({
  opsDb: () => ({ $queryRaw: db.query }),
}));

import { GET } from './route';

describe('GET /api/health/ready', () => {
  afterEach(() => vi.useRealTimers());

  it('is ready when Postgres answers', async () => {
    db.query.mockResolvedValue([{ '?column?': 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ready', database: 'ok' });
  });

  it('answers 503 without the driver error when Postgres is down', async () => {
    db.query.mockImplementation(() => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret')));
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'not_ready', database: 'unreachable' });
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('answers 503 when Postgres hangs', async () => {
    vi.useFakeTimers();
    db.query.mockReturnValue(new Promise(() => {}));
    const pending = GET();
    await vi.advanceTimersByTimeAsync(3000);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ database: 'timeout' });
  });
});
