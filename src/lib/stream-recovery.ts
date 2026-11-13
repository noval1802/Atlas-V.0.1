/**
 * How a live camera player recovers on its own. Regional camera servers drop a
 * segment or a connection often; showing an error on the first one made the
 * operator press RETRY for what was a two-second hiccup.
 */

/** Wait before each automatic reconnect. After the last one the error is shown. */
export const RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;

/** A live video stuck this long is treated as stalled: jump to the live edge, then reconnect. */
export const STALL_MS = 8_000;

/** No first frame by then: reconnect once, then give up (a source this slow rarely recovers within minutes). */
export const START_TIMEOUT_MS = 30_000;

/** Waiting shorter than this is a normal hiccup and shows nothing. */
export const BUFFERING_BADGE_MS = 1_500;

/** Delay before reconnect attempt `attempt` (0-based), or null when it is time to give up. */
export function nextRetryDelay(attempt: number): number | null {
  return RETRY_DELAYS_MS[attempt] ?? null;
}
