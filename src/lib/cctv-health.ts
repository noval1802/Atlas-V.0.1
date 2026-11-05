/* Which cameras show nothing. A camera carries no status from its operator, so
   the server opens each stream on a timer and remembers the ones that fail;
   the map paints those red. */
import { safeFetch } from '@/lib/ssrf-guard';
import type { CatalogCamera } from '@/lib/camera-catalog';

const PROBE_TIMEOUT_MS = 10_000;
/* Per stream server, not overall: jmlive.jasamarga.com answers 502 to ~half its
   cameras when asked 40 at a time, and 91% of them play when asked one by one. */
const PER_HOST = 2;

/** The URL to open, or null when there is nothing to judge by. */
export function probeTarget(camera: CatalogCamera): string | null | 'none' {
  const url = camera.stream_url || camera.feed_url;
  if (!url) return camera.external_url ? null : 'none';
  // Bandung streams go through our own HLS proxy; check the upstream it wraps.
  if (url.startsWith('/api/cctv/hls?u=')) return new URLSearchParams(url.slice(url.indexOf('?'))).get('u');
  // Other same-site routes (TPT media) need the operator's session; not ours to judge.
  if (url.startsWith('/')) return null;
  return url;
}

/** True when the stream answers with something a player could show. */
export async function streamAlive(url: string): Promise<boolean> {
  try {
    const res = await safeFetch(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok || !res.body) { void res.body?.cancel(); return false; }
    // Read one chunk only: MJPEG and FLV streams never end.
    const reader = res.body.getReader();
    const { value } = await reader.read();
    void reader.cancel().catch(() => {});
    if (!value?.length) return false;
    if (/\.m3u8(\?|$)/i.test(new URL(url).pathname)) return new TextDecoder().decode(value.slice(0, 200)).includes('#EXTM3U');
    return true;
  } catch {
    return false; // timeout, DNS, refused, bad certificate: the browser fails the same way
  }
}

let offline = new Set<string>();

export function isOffline(id: string | number): boolean {
  return offline.has(String(id));
}

/** Cameras as served: the dead ones carry `offline: true`. */
export function withHealth<T extends CatalogCamera>(cameras: T[]): T[] {
  if (!offline.size) return cameras;
  return cameras.map(c => (offline.has(String(c.id)) ? { ...c, offline: true } : c));
}

/** Probe every camera once and replace the offline set with the result. */
export async function checkCameras(cameras: CatalogCamera[], alive = streamAlive): Promise<number> {
  const next = new Set<string>();
  const byHost = new Map<string, Array<[string, string]>>();
  for (const camera of cameras) {
    const target = probeTarget(camera);
    if (target === 'none') next.add(String(camera.id));
    else if (target) {
      let host = '';
      try { host = new URL(target).host; } catch { /* streamAlive fails it too */ }
      const queue = byHost.get(host) ?? byHost.set(host, []).get(host)!;
      queue.push([String(camera.id), target]);
    }
  }
  await Promise.all([...byHost.values()].flatMap(queue => Array.from({ length: PER_HOST }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      if (!(await alive(job[1]))) next.add(job[0]);
    }
  })));
  offline = next;
  return next.size;
}
