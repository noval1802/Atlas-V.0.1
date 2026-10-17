import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFetchEvent } from 'next/server';
import { NextRequest } from 'next/server';
import { configuredUmamiWebsiteId, trackPageView, umamiCollectUrl } from './umami-analytics';

const RETIRED_WEBSITE_ID = 'cd8f216c-fc3f-45f5-ba1a-e10309a61d18';
const helperSource = readFileSync(fileURLToPath(new URL('./umami-analytics.ts', import.meta.url)), 'utf8');
const proxySourcePath = fileURLToPath(new URL('../proxy.ts', import.meta.url));
const middlewareSourcePath = fileURLToPath(new URL('../middleware.ts', import.meta.url));

function gateSource(): string {
  if (existsSync(proxySourcePath)) return readFileSync(proxySourcePath, 'utf8');
  return readFileSync(middlewareSourcePath, 'utf8');
}

function pageRequest(path = '/peta'): NextRequest {
  return new NextRequest(`http://127.0.0.1:3005${path}`, {
    headers: { 'x-forwarded-for': '203.0.113.8', 'user-agent': 'atlas-test' },
  });
}

function pageEvent(): NextFetchEvent {
  return { waitUntil: vi.fn() } as unknown as NextFetchEvent;
}

describe('unconfigured Umami analytics', () => {
  const original = process.env.UMAMI_WEBSITE_ID;

  afterEach(() => {
    if (original === undefined) delete process.env.UMAMI_WEBSITE_ID;
    else process.env.UMAMI_WEBSITE_ID = original;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('does not keep the retired site id, collector host, or client-ip event', () => {
    const source = `${helperSource}\n${gateSource()}`;
    expect(source).not.toContain(RETIRED_WEBSITE_ID);
    expect(source).not.toContain('umami-umami-1');
    expect(source).not.toContain('Network Log');
    expect(helperSource).not.toContain('fetch(');
    expect(umamiCollectUrl()).toBeNull();
  });

  it('treats a missing, empty, or non-UUID website id as unconfigured', () => {
    expect(configuredUmamiWebsiteId(undefined)).toBeNull();
    expect(configuredUmamiWebsiteId('')).toBeNull();
    expect(configuredUmamiWebsiteId('   ')).toBeNull();
    expect(configuredUmamiWebsiteId('not-a-site')).toBeNull();
    expect(configuredUmamiWebsiteId(undefined)).not.toBe(RETIRED_WEBSITE_ID);
  });

  it('sends no request when UMAMI_WEBSITE_ID is unset', () => {
    delete process.env.UMAMI_WEBSITE_ID;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const event = pageEvent();
    trackPageView(pageRequest(), event);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(event.waitUntil).not.toHaveBeenCalled();
  });

  it('sends no request for an empty id or a valid id without a collector host', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const value of ['', '   ', 'not-a-site', '11111111-1111-4111-8111-111111111111']) {
      process.env.UMAMI_WEBSITE_ID = value;
      const event = pageEvent();
      trackPageView(pageRequest(), event);
      expect(event.waitUntil).not.toHaveBeenCalled();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps API protection and does not call analytics from the operational proxy', async () => {
    if (!existsSync(proxySourcePath)) return;
    delete process.env.UMAMI_WEBSITE_ID;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { proxy } = await import('../proxy');
    const event = { waitUntil: vi.fn() } as unknown as NextFetchEvent;
    const open = await proxy(pageRequest('/api/health'), event);
    expect(open.status).toBe(200);
    const closed = await proxy(pageRequest('/api/cctv'), event);
    expect(closed.status).toBe(401);
    await expect(closed.json()).resolves.toEqual({ error: 'Masuk diperlukan.' });
    const map = await proxy(pageRequest('/peta'), event);
    expect(map.status).toBe(307);
    expect(map.headers.get('location')).toContain('/masuk');
    expect(map.headers.get('location')).toContain('next=%2Fpeta');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(event.waitUntil).not.toHaveBeenCalled();
  });
});
