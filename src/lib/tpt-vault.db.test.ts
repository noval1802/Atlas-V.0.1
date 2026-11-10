import crypto from 'crypto';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertTestDatabase } from './ops/test-db-guard';
import { DbSessionVault } from './tpt-vault';

/*
 * Atomic session vault against a throwaway database. Opt-in:
 *   TEST_DATABASE_URL=postgresql://osiris@127.0.0.1:5433/osiris_ops_test \
 *     TPT_VAULT_KEY=<base64 32 bytes> npx vitest run src/lib/tpt-vault.db.test.ts
 * The guard refuses any database other than osiris_ops_test on localhost.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('DbSessionVault against a real database', () => {
  let db: PrismaClient;
  const key = crypto.randomBytes(32).toString('base64');

  beforeAll(async () => {
    assertTestDatabase(url!);
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
    db = new PrismaClient({ datasources: { db: { url } } });
    process.env.TPT_VAULT_KEY = key;
  }, 120_000);

  beforeEach(async () => {
    process.env.TPT_VAULT_KEY = key;
    await db.tptSession.deleteMany();
  });

  afterAll(async () => {
    await db.tptSession.deleteMany();
    await db.$disconnect();
  });

  it('round-trips credentials and never stores a raw token', async () => {
    const vault = new DbSessionVault(db);
    await vault.put({ accessToken: 'a1', refreshToken: 'r1', deviceId: 'd1' });
    expect(await vault.read()).toEqual({ accessToken: 'a1', refreshToken: 'r1', deviceId: 'd1' });
    const row = await db.tptSession.findUnique({ where: { sourceId: 'jakarta' } });
    expect(row?.ciphertext).not.toContain('a1');
    expect(row?.ciphertext).not.toContain('r1');
    expect(row?.refreshHash).toBe(crypto.createHash('sha256').update('r1').digest('hex'));
  });

  it('compare-and-swap rotates and bumps version when the refresh token matches', async () => {
    const vault = new DbSessionVault(db);
    await vault.put({ accessToken: 'a1', refreshToken: 'r1' });
    const before = await db.tptSession.findUnique({ where: { sourceId: 'jakarta' } });
    const ok = await vault.compareAndSwap('r1', { accessToken: 'a2', refreshToken: 'r2' });
    expect(ok).toBe(true);
    const after = await db.tptSession.findUnique({ where: { sourceId: 'jakarta' } });
    expect(after!.version).toBe(before!.version + 1);
    expect(await vault.read()).toEqual({ accessToken: 'a2', refreshToken: 'r2', deviceId: undefined });
  });

  it('compare-and-swap refuses a stale refresh token and leaves the row unchanged', async () => {
    const vault = new DbSessionVault(db);
    await vault.put({ accessToken: 'a1', refreshToken: 'r1' });
    const ok = await vault.compareAndSwap('stale', { accessToken: 'a2', refreshToken: 'r2' });
    expect(ok).toBe(false);
    expect((await vault.read())?.accessToken).toBe('a1');
  });

  it('only one of two concurrent swaps on the same base wins', async () => {
    const vault = new DbSessionVault(db);
    await vault.put({ accessToken: 'a1', refreshToken: 'r1' });
    const [first, second] = await Promise.all([
      vault.compareAndSwap('r1', { accessToken: 'aX', refreshToken: 'rX' }),
      vault.compareAndSwap('r1', { accessToken: 'aY', refreshToken: 'rY' }),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
  });

  it('read returns null when the key no longer matches the stored blob', async () => {
    await new DbSessionVault(db).put({ accessToken: 'a1', refreshToken: 'r1' });
    process.env.TPT_VAULT_KEY = crypto.randomBytes(32).toString('base64');
    expect(await new DbSessionVault(db).read()).toBeNull();
  });
});
