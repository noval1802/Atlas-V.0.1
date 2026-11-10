/**
 * TPT refresh orchestration core. No provider URL, HTTP call, storage or secret
 * is hardcoded. A disabled feature flag NEVER invokes the refresh adapter.
 *
 * Integrate only after provider authorization and contract verification.
 */
export type TptCredentials = Readonly<{
  accessToken: string;
  refreshToken: string;
  deviceId?: string;
}>;

export type RefreshOutcome =
  | { ok: true; next: TptCredentials }
  | { ok: false; reason: 'rejected' | 'unavailable' };

export type TptAuthState =
  | 'CONNECTED'
  | 'TOKEN_EXPIRED'
  | 'AUTH_REQUIRED'
  | 'NETWORK_ERROR'
  | 'FORBIDDEN'
  | 'PROVIDER_UNAVAILABLE';

export interface SessionVault {
  /** Store all credentials encrypted at rest; never expose via browser APIs. */
  read(): Promise<TptCredentials | null>;
  /** Atomic compare-and-swap: protect against multi-instance token rotation. */
  compareAndSwap(expectedRefreshToken: string, next: TptCredentials): Promise<boolean>;
}

export interface ProviderRefresh {
  /** Only implement with an authorized, verified provider refresh contract. */
  refresh(current: TptCredentials): Promise<RefreshOutcome>;
}

export type TokenRequest = (accessToken: string) => Promise<Response>;

export class TptSessionCore {
  private inflight: Promise<boolean> | null = null;
  private failureUntil = 0;

  private readonly vault: SessionVault;
  private readonly provider: ProviderRefresh;
  private readonly enabled: boolean;
  private readonly now: () => number;
  private readonly backoffMs: number;

  constructor(
    vault: SessionVault,
    provider: ProviderRefresh,
    enabled: boolean = false,
    now: () => number = Date.now,
    backoffMs: number = 30_000,
  ) {
    this.vault = vault;
    this.provider = provider;
    this.enabled = enabled;
    this.now = now;
    this.backoffMs = backoffMs;
  }

  /** A refresh is attempted only when enabled and only once per burst. */
  async refreshOnce(): Promise<boolean> {
    if (!this.enabled || this.now() < this.failureUntil) return false;
    if (this.inflight) return this.inflight;
    const work = this.performRefresh();
    this.inflight = work;
    try { return await work; }
    finally { if (this.inflight === work) this.inflight = null; }
  }

  private async performRefresh(): Promise<boolean> {
    const current = await this.vault.read();
    if (!current?.refreshToken || !current.accessToken) return false;
    try {
      const outcome = await this.provider.refresh(current);
      if (!outcome.ok) {
        this.failureUntil = this.now() + this.backoffMs;
        return false;
      }
      if (!outcome.next.accessToken || !outcome.next.refreshToken) {
        this.failureUntil = this.now() + this.backoffMs;
        return false;
      }
      // Atomic rotation: do not write access and refresh token separately.
      const swapped = await this.vault.compareAndSwap(current.refreshToken, outcome.next);
      if (!swapped) {
        // Another instance may have rotated. Accept only when vault changed.
        const fresh = await this.vault.read();
        return Boolean(fresh?.refreshToken && fresh.refreshToken !== current.refreshToken);
      }
      this.failureUntil = 0;
      return true;
    } catch {
      // Deliberately do not log secrets or response bodies.
      this.failureUntil = this.now() + this.backoffMs;
      return false;
    }
  }

  /**
   * Sends the authorized request using current credentials. On 401 only, one
   * refresh attempt and one retry. Never refresh on 403, 5xx, or network errors.
   */
  async authorizedRequest(send: TokenRequest): Promise<{ state: TptAuthState; response?: Response }> {
    const existing = await this.vault.read();
    if (!existing?.accessToken) return { state: 'AUTH_REQUIRED' };
    let first: Response;
    try { first = await send(existing.accessToken); }
    catch { return { state: 'NETWORK_ERROR' }; }
    if (first.status !== 401) return { state: classify(first.status), response: first };
    if (!await this.refreshOnce()) return { state: 'TOKEN_EXPIRED', response: first };
    const updated = await this.vault.read();
    if (!updated?.accessToken || updated.accessToken === existing.accessToken) {
      return { state: 'AUTH_REQUIRED' };
    }
    try {
      const retry = await send(updated.accessToken);
      return { state: classify(retry.status), response: retry };
    } catch {
      return { state: 'NETWORK_ERROR' };
    }
  }
}

export function classify(code: number): TptAuthState {
  if (code === 401) return 'TOKEN_EXPIRED';
  if (code === 403) return 'FORBIDDEN';
  if (code >= 500) return 'PROVIDER_UNAVAILABLE';
  if (code >= 200 && code < 300) return 'CONNECTED';
  return 'PROVIDER_UNAVAILABLE';
}
