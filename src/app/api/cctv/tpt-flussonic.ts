import { getTptAccessToken } from '@/lib/tpt-vault';

/**
 * Jakarta TPT streams (Balitower Flussonic) are NOT played with the portal
 * access token. The portal mints a short-lived Flussonic stream token:
 *
 *   POST https://api.e-smarteye.com/flussonic/token   (JSON body `{}`,
 *   authenticated by the session) -> { access_token: "<stream token>" }
 *
 * and appends it as `?token=<stream token>` on the Flussonic URL. The token is
 * short-lived; the portal refreshes it every 540000ms (9 min). This mirrors the
 * portal's `useTokenPolling` hook. The access token (list credential) is only
 * used to authenticate this mint call and is never sent to Flussonic.
 */

const MINT_URL = 'https://api.e-smarteye.com/flussonic/token';
const REFRESH_MS = 9 * 60 * 1000; // refresh a minute before the ~10 min expiry

let cached: { token: string; at: number } | null = null;
let inflight: Promise<string | null> | null = null;

/** The current Flussonic stream token, minted and cached, refreshed before it
 *  expires. Returns null when no access token is configured or the mint fails. */
export async function getFlussonicStreamToken(): Promise<string | null> {
  if (cached && Date.now() - cached.at < REFRESH_MS) return cached.token;
  if (!inflight) {
    const work = mint().finally(() => { if (inflight === work) inflight = null; });
    inflight = work;
  }
  return inflight;
}

/** Drop the cached stream token (e.g. after the access token is replaced). */
export function clearFlussonicToken(): void {
  cached = null;
  inflight = null;
}

async function mint(): Promise<string | null> {
  const access = await getTptAccessToken();
  if (!access) return null;
  let response: Response;
  try {
    response = await fetch(MINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: `access_token=${access}`,
      },
      body: '{}',
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch {
    return cached?.token ?? null;
  }
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({})) as { access_token?: unknown };
  const token = typeof data.access_token === 'string' && data.access_token ? data.access_token : null;
  if (token) cached = { token, at: Date.now() };
  return token;
}
