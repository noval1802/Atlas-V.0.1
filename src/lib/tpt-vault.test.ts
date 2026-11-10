import crypto from 'crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { decryptCredentials, encryptCredentials, getTptAccessToken, vaultConfigured } from './tpt-vault';

const KEY = crypto.randomBytes(32);
const creds = { accessToken: 'access-1', refreshToken: 'refresh-1', deviceId: 'device-1' };

const savedKey = process.env.TPT_VAULT_KEY;
const savedToken = process.env.TPT_CCTV_TOKEN;
afterEach(() => {
  if (savedKey === undefined) delete process.env.TPT_VAULT_KEY; else process.env.TPT_VAULT_KEY = savedKey;
  if (savedToken === undefined) delete process.env.TPT_CCTV_TOKEN; else process.env.TPT_CCTV_TOKEN = savedToken;
});

describe('credential encryption', () => {
  it('round-trips credentials through AES-256-GCM', () => {
    expect(decryptCredentials(encryptCredentials(creds, KEY), KEY)).toEqual(creds);
  });

  it('produces a fresh IV each time, so the same plaintext never yields the same blob', () => {
    expect(encryptCredentials(creds, KEY)).not.toBe(encryptCredentials(creds, KEY));
  });

  it('rejects a tampered blob (auth tag mismatch)', () => {
    const blob = Buffer.from(encryptCredentials(creds, KEY), 'base64');
    blob[blob.length - 1] ^= 0x01;
    expect(() => decryptCredentials(blob.toString('base64'), KEY)).toThrow();
  });

  it('cannot be decrypted with the wrong key', () => {
    const blob = encryptCredentials(creds, KEY);
    expect(() => decryptCredentials(blob, crypto.randomBytes(32))).toThrow();
  });
});

describe('getTptAccessToken fallback (no vault key)', () => {
  it('returns the manual env token when the vault is not configured', async () => {
    delete process.env.TPT_VAULT_KEY;
    process.env.TPT_CCTV_TOKEN = 'manual-token';
    expect(vaultConfigured()).toBe(false);
    expect(await getTptAccessToken()).toBe('manual-token');
  });

  it('returns null when neither vault nor env token is set', async () => {
    delete process.env.TPT_VAULT_KEY;
    delete process.env.TPT_CCTV_TOKEN;
    expect(await getTptAccessToken()).toBeNull();
  });
});
