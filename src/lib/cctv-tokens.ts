import { readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import { dropSnapshotRegion } from '@/lib/cctv-snapshot';

export const CCTV_TOKEN_SOURCES = [
  {
    id: 'jakarta',
    label: 'CCTV Jakarta',
    env: 'TPT_CCTV_TOKEN',
    region: 'tpt',
    hint: 'Cookie access_token dari portal e-Smarteye.',
  },
  {
    id: 'jasamarga',
    label: 'CCTV Jasa Marga',
    env: 'JASAMARGA_WFS_TOKEN',
    region: 'jasamarga',
    hint: 'Parameter token pada layer WFS JID.',
  },
] as const;

export type CctvTokenId = (typeof CCTV_TOKEN_SOURCES)[number]['id'];

export function cctvTokenSource(id: string) {
  return CCTV_TOKEN_SOURCES.find(source => source.id === id) ?? null;
}

/** Accept a bare token, an `access_token=` cookie, or a WFS URL that carries `token`. */
export function normalizeCctvToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let value = raw.trim();
  if (/^access_token=/i.test(value)) value = value.slice('access_token='.length).trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).searchParams.get('token')?.trim() ?? '';
    } catch {
      return null;
    }
  }
  if (!value || value.length > 2000 || /[\s"'<>]/.test(value)) return null;
  return value;
}

/** True for an active assignment, including `export KEY=`. Comments are left alone. */
function isEnvAssignment(line: string, key: string): boolean {
  return new RegExp(`^\\s*(?:export\\s+)?${key}=`).test(line);
}

/**
 * Delete every previous assignment of `key` and write the new value once.
 * A repeated old token must not survive beside the replacement.
 */
export function upsertEnvAssignment(text: string, key: string, value: string): string {
  const lines = text.split('\n');
  let written = false;
  const next: string[] = [];
  for (const line of lines) {
    if (!isEnvAssignment(line, key)) {
      next.push(line);
      continue;
    }
    if (!written) {
      next.push(`${key}=${value}`);
      written = true;
    }
  }
  if (!written) next.push(`${key}=${value}`);
  const body = next.join('\n');
  return body.endsWith('\n') ? body : `${body}\n`;
}

export function listCctvTokenStatus() {
  return CCTV_TOKEN_SOURCES.map(source => ({
    id: source.id,
    label: source.label,
    hint: source.hint,
    configured: Boolean(process.env[source.env]?.trim()),
  }));
}

export function defaultEnvPath(): string {
  return path.join(process.cwd(), '.env');
}

/**
 * Replace the stored token. The previous value is removed from the env file
 * and from the running process, and cameras fetched with it are dropped from
 * the saved catalogue before the file change can reload the server.
 * The new value is not logged.
 */
export async function updateStoredCctvToken(id: string, raw: unknown, file = defaultEnvPath()): Promise<{ ok: true } | { ok: false; error: string }> {
  const source = cctvTokenSource(id);
  if (!source) return { ok: false, error: 'Sumber token tidak dikenal.' };
  const value = normalizeCctvToken(raw);
  if (!value) return { ok: false, error: 'Token kosong atau berisi karakter yang tidak dipakai.' };
  const current = readFileSync(file, 'utf8');
  const next = upsertEnvAssignment(current, source.env, value);
  await dropSnapshotRegion(source.region);
  delete process.env[source.env];
  process.env[source.env] = value;
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, next, { mode: 0o600 });
  renameSync(temporary, file);
  return { ok: true };
}
