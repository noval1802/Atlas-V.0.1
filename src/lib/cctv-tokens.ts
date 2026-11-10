import { readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import { dropSnapshotRegion } from '@/lib/cctv-snapshot';
import { storeTptAccessToken } from '@/lib/tpt-vault';

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
  // A pasted cookie header may carry more than one cookie, e.g.
  // "access_token=…; SERVER=…". Keep only the access_token value.
  const cookieMatch = /(?:^|;\s*)access_token=([^;]+)/i.exec(value);
  if (cookieMatch) value = cookieMatch[1].trim();
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
  return path.join(/*turbopackIgnore: true*/ process.cwd(), '.env');
}

/**
 * Replace the stored token. The previous value is removed from the env file
 * and from the running process, and cameras fetched with it are dropped from
 * the saved catalogue before the file change can reload the server.
 * The new value is not logged.
 *
 * The vault is written first: it is the durable copy. The env file is best
 * effort, because the Docker image has no .env (compose injects it as
 * variables), and reading it unconditionally made every save fail with a 500.
 * `persisted: false` means the value lives only in this process (and the vault,
 * for Jakarta) and the host .env must be updated before the next restart.
 */
export async function updateStoredCctvToken(
  id: string,
  raw: unknown,
  file = defaultEnvPath(),
): Promise<{ ok: true; persisted: boolean } | { ok: false; error: string }> {
  const source = cctvTokenSource(id);
  if (!source) return { ok: false, error: 'Sumber token tidak dikenal.' };
  const value = normalizeCctvToken(raw);
  if (!value) return { ok: false, error: 'Token kosong atau berisi karakter yang tidak dipakai.' };
  // Keep the vault (when configured) in step with the manual write so the list
  // and the media proxy always read the same access token.
  if (source.id === 'jakarta') await storeTptAccessToken(value);
  await dropSnapshotRegion(source.region);
  delete process.env[source.env];
  process.env[source.env] = value;
  try {
    // turbopackIgnore: runtime state file; tracing a cwd-relative path otherwise copies the whole repo (.env included) into the build output.
    const current = readFileSync(/*turbopackIgnore: true*/ file, 'utf8');
    const temporary = `${file}.tmp`;
    writeFileSync(temporary, upsertEnvAssignment(current, source.env, value), { mode: 0o600 });
    renameSync(temporary, file);
    return { ok: true, persisted: true };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown';
    console.warn(`[OSIRIS] CCTV token ${source.id} applied in memory only; env file not written (${code})`);
    return { ok: true, persisted: false };
  }
}
