/**
 * How fresh each data source is, judged by when the upstream last answered —
 * not when the browser last asked this server. A cache that keeps serving an
 * old list while its source is down must show as late, not as live.
 */

/** ok: fresh · lambat: old or failing but still showing data · gagal: no data · nonaktif: not loaded / not configured */
export type SourceState = 'ok' | 'lambat' | 'gagal' | 'nonaktif';

export interface SourceStatus {
  id: string;
  label: string;
  source: string;
  state: SourceState;
  /** Epoch ms of the last answer with data; null when unknown (never loaded, or restored from disk). */
  fetchedAt: number | null;
  /** Epoch ms since refreshes have been failing; null while healthy. */
  failingSince: number | null;
  count: number;
  /** Extra line for the tooltip, e.g. which CCTV regions are down. */
  note?: string;
  /** Short text shown instead of the age, e.g. "21/23" regions for CCTV. */
  badge?: string;
}

export function classify(
  health: { count: number; fetchedAt?: number; failedAt?: number } | undefined,
  staleAfterMs: number,
  now: number,
): SourceState {
  if (!health) return 'nonaktif';
  if (health.count === 0) return health.failedAt ? 'gagal' : 'nonaktif';
  if (health.failedAt || health.fetchedAt === undefined || now - health.fetchedAt > staleAfterMs) return 'lambat';
  return 'ok';
}

/** "baru" · "5 mnt" · "3 jam" · "2 hari" — short enough for the status bar. */
export function formatAge(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return 'baru';
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}

const STATE_TEXT: Record<SourceState, string> = {
  ok: 'Data terkini',
  lambat: 'Data terlambat',
  gagal: 'Gagal: tidak ada data',
  nonaktif: 'Belum dimuat',
};

/** Hover text: what the source is, when it last answered, since when it fails. `now` is on the server clock. */
export function statusTitle(s: SourceStatus, now: number, formatTime: (ms: number) => string): string {
  const lines = [`${s.label} · ${s.source}`, STATE_TEXT[s.state]];
  if (s.fetchedAt !== null) {
    const age = formatAge(now - s.fetchedAt);
    lines.push(`Diambil ${formatTime(s.fetchedAt)} (${age === 'baru' ? 'baru saja' : `${age} lalu`})`);
  }
  if (s.failingSince !== null) lines.push(`Gagal diperbarui sejak ${formatTime(s.failingSince)}`);
  if (s.note) lines.push(s.note);
  return lines.join('\n');
}
