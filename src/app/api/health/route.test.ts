import { describe, expect, it } from 'vitest';
import { API_GROUPS } from '@/app/(en)/docs/apiCatalog';
import { GET } from './route';

const HEALTH_KEYS = [
  'checks_performed',
  'detail',
  'nominatim',
  'platform',
  'scope',
  'status',
  'timestamp',
  'uptime_seconds',
  'version',
];

describe('GET /api/health', () => {
  it('names the platform ATLAS and keeps the serving payload', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(Object.keys(body).sort()).toEqual(HEALTH_KEYS);
    expect(body.platform).toBe('ATLAS');
    expect(body.status).toBe('serving');
    expect(body.scope).toBe('process');
    expect(body.checks_performed).toBe('none');
    expect(body.version).toBe('1.0.0');
    expect(typeof body.detail).toBe('string');
    expect(body.detail.length).toBeGreaterThan(0);
    expect(body.uptime_seconds === null || typeof body.uptime_seconds === 'number').toBe(true);
    expect(body.nominatim).toEqual(expect.objectContaining({
      served: expect.any(Number),
      fromCache: expect.any(Number),
      sent: expect.any(Number),
      refused: expect.any(Number),
      failed: expect.any(Number),
      cached: expect.any(Number),
      queueDepth: expect.any(Number),
    }));
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(body)).not.toContain('OSIRIS');
  });
});

describe('health catalog', () => {
  it('documents the live serving status without renaming the payload', () => {
    const health = API_GROUPS.flatMap(group => group.endpoints).find(endpoint => endpoint.path === '/api/health');
    expect(health?.method).toBe('GET');
    expect(health?.returns).toEqual(['status', 'platform', 'version', 'uptime', 'timestamp', 'endpoints']);
    expect(health?.notes).toContain('`serving`');
    expect(health?.notes).not.toContain('operational');
  });
});
