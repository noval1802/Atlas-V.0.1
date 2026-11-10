import { describe, expect, test } from 'vitest';
import { TptSessionCore, type ProviderRefresh, type SessionVault, type TptCredentials } from './tpt-session-core';

class MemoryVault implements SessionVault {
  data: TptCredentials | null;
  constructor(data: TptCredentials | null) { this.data = data; }
  async read() { return this.data; }
  async compareAndSwap(expected: string, next: TptCredentials) {
    if (this.data?.refreshToken !== expected) return false;
    this.data = next;
    return true;
  }
}

const old = { accessToken: 'access-old', refreshToken: 'refresh-old', deviceId: 'device-test' };
const rotated = { accessToken: 'access-new', refreshToken: 'refresh-new', deviceId: 'device-test' };
const response = (status: number) => new Response(null, { status });

describe('TptSessionCore', () => {
  test('feature flag disabled: never calls refresh adapter', async () => {
    let called = 0;
    const provider: ProviderRefresh = { async refresh() { called++; return { ok: true, next: rotated }; } };
    const core = new TptSessionCore(new MemoryVault(old), provider, false);
    const result = await core.authorizedRequest(async () => response(401));
    expect(result.state).toBe('TOKEN_EXPIRED');
    expect(called).toBe(0);
  });

  test('refresh rotates both credentials and retries exactly once', async () => {
    const vault = new MemoryVault(old);
    let calls = 0;
    const core = new TptSessionCore(vault, { async refresh() { return { ok: true, next: rotated }; } }, true);
    const result = await core.authorizedRequest(async (token) => {
      calls++;
      return response(token === 'access-old' ? 401 : 200);
    });
    expect(result.state).toBe('CONNECTED');
    expect(calls).toBe(2);
    expect(vault.data).toEqual(rotated);
  });

  test('403 does not trigger refresh', async () => {
    let count = 0;
    const core = new TptSessionCore(new MemoryVault(old), { async refresh() { count++; return { ok: true, next: rotated }; } }, true);
    expect((await core.authorizedRequest(async () => response(403))).state).toBe('FORBIDDEN');
    expect(count).toBe(0);
  });

  test('network failures never trigger refresh', async () => {
    let count = 0;
    const core = new TptSessionCore(new MemoryVault(old), { async refresh() { count++; return { ok: true, next: rotated }; } }, true);
    expect((await core.authorizedRequest(async () => { throw new Error('network'); })).state).toBe('NETWORK_ERROR');
    expect(count).toBe(0);
  });

  test('refresh rejected: no retry, backoff prevents repeated calls', async () => {
    let count = 0;
    const core = new TptSessionCore(new MemoryVault(old), { async refresh() { count++; return { ok: false, reason: 'rejected' }; } }, true);
    expect((await core.authorizedRequest(async () => response(401))).state).toBe('TOKEN_EXPIRED');
    expect((await core.authorizedRequest(async () => response(401))).state).toBe('TOKEN_EXPIRED');
    expect(count).toBe(1);
  });

  test('concurrent requests only invoke one refresh', async () => {
    const vault = new MemoryVault(old);
    let count = 0;
    const provider: ProviderRefresh = { async refresh() {
      count++;
      await new Promise(resolve => setTimeout(resolve, 10));
      return { ok: true, next: rotated };
    } };
    const core = new TptSessionCore(vault, provider, true);
    const result = await Promise.all(Array.from({ length: 12 }, () => core.authorizedRequest(async token => response(token === 'access-old' ? 401 : 200))));
    expect(count).toBe(1);
    expect(result.every(item => item.state === 'CONNECTED')).toBe(true);
  });

  test('no configured access token: no provider request', async () => {
    const core = new TptSessionCore(new MemoryVault(null), { async refresh() { throw new Error('should not call'); } }, true);
    expect((await core.authorizedRequest(async () => { throw new Error('should not call'); })).state).toBe('AUTH_REQUIRED');
  });

  test('retry 401 stops after one retry', async () => {
    let calls = 0;
    const core = new TptSessionCore(new MemoryVault(old), { async refresh() { return { ok: true, next: rotated }; } }, true);
    expect((await core.authorizedRequest(async () => { calls++; return response(401); })).state).toBe('TOKEN_EXPIRED');
    expect(calls).toBe(2);
  });
});
