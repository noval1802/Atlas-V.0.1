import crypto from 'crypto';
import type { SessionVault, TptCredentials } from './tpt-session-core';
import { opsDb } from './ops/db';

/**
 * Encrypted session store for the Jakarta TPT (e-Smarteye) integration.
 *
 * Credentials (access token, refresh token, device id) are kept as a single
 * AES-256-GCM blob in Postgres. The key comes from the server environment
 * (`TPT_VAULT_KEY`, injected by a secret manager in production) and is never
 * stored in the database. `refreshHash` is a SHA-256 of the refresh token used
 * ONLY for an atomic compare-and-swap on rotation; no raw token is stored in a
 * queryable column, and nothing here is ever logged or returned to the browser.
 *
 * When no key is configured the vault is inert and the system falls back to the
 * manual `TPT_CCTV_TOKEN` env value, so existing behaviour is unchanged.
 */

const SOURCE_ID = 'jakarta';
const KEY_ENV = 'TPT_VAULT_KEY';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function vaultConfigured(): boolean {
  return Boolean(process.env[KEY_ENV]?.trim());
}

/** The refresh feature stays OFF until a provider is authorized. Server-only. */
export function autoRefreshEnabled(): boolean {
  return process.env.TPT_AUTO_REFRESH_ENABLED === 'true';
}

function vaultKey(): Buffer {
  const raw = process.env[KEY_ENV]?.trim();
  if (!raw) throw new Error('TPT vault key not configured');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('TPT vault key must be 32 bytes, base64-encoded');
  return buf;
}

export function encryptCredentials(creds: TptCredentials, key: Buffer = vaultKey()): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(creds), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function decryptCredentials(blob: string, key: Buffer = vaultKey()): TptCredentials {
  const buf = Buffer.from(blob, 'base64');
  if (buf.length <= IV_BYTES + TAG_BYTES) throw new Error('ciphertext too short');
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const enc = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  return JSON.parse(plain) as TptCredentials;
}

function refreshHash(refreshToken: string): string {
  return crypto.createHash('sha256').update(refreshToken ?? '', 'utf8').digest('hex');
}

export class DbSessionVault implements SessionVault {
  private readonly db: ReturnType<typeof opsDb>;
  private readonly sourceId: string;

  constructor(db: ReturnType<typeof opsDb> = opsDb(), sourceId: string = SOURCE_ID) {
    this.db = db;
    this.sourceId = sourceId;
  }

  async read(): Promise<TptCredentials | null> {
    const row = await this.db.tptSession.findUnique({ where: { sourceId: this.sourceId } });
    if (!row) return null;
    try {
      return decryptCredentials(row.ciphertext);
    } catch {
      // Wrong key or tampered blob: treat as no session. Never surface the error
      // (it could leak ciphertext) and never throw into the request path.
      return null;
    }
  }

  /**
   * Atomic compare-and-swap: a single conditional UPDATE rotates the stored
   * credentials only while the refresh token still matches what the caller read,
   * and bumps `version`. Returns false if another writer rotated first.
   */
  async compareAndSwap(expectedRefreshToken: string, next: TptCredentials): Promise<boolean> {
    const result = await this.db.tptSession.updateMany({
      where: { sourceId: this.sourceId, refreshHash: refreshHash(expectedRefreshToken) },
      data: {
        ciphertext: encryptCredentials(next),
        refreshHash: refreshHash(next.refreshToken),
        version: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  /** Seed or fully replace the session (manual admin write / authorized seeding). */
  async put(creds: TptCredentials): Promise<void> {
    const ciphertext = encryptCredentials(creds);
    const hash = refreshHash(creds.refreshToken);
    await this.db.tptSession.upsert({
      where: { sourceId: this.sourceId },
      create: { sourceId: this.sourceId, ciphertext, refreshHash: hash, version: 0 },
      update: { ciphertext, refreshHash: hash, version: { increment: 1 } },
    });
  }
}

/**
 * The single source of truth for the Jakarta access token, used by BOTH the
 * camera list and the media proxy so they can never diverge. Prefers the
 * encrypted vault when configured and seeded; otherwise falls back to the
 * manual `TPT_CCTV_TOKEN` env value.
 */
export async function getTptAccessToken(): Promise<string | null> {
  if (vaultConfigured()) {
    try {
      const creds = await new DbSessionVault().read();
      if (creds?.accessToken) return creds.accessToken;
    } catch {
      // fall back to env below
    }
  }
  const env = process.env.TPT_CCTV_TOKEN?.trim();
  return env || null;
}

/** Mirror a manual access-token write into the vault, preserving any stored
 *  refresh token / device id. No-op when the vault is not configured. */
export async function storeTptAccessToken(accessToken: string): Promise<void> {
  if (!vaultConfigured()) return;
  const vault = new DbSessionVault();
  const current = await vault.read();
  await vault.put({
    accessToken,
    refreshToken: current?.refreshToken ?? '',
    deviceId: current?.deviceId,
  });
}
