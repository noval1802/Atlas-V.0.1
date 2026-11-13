import { describe, expect, it } from 'vitest';
import { RETRY_DELAYS_MS, nextRetryDelay } from './stream-recovery';

describe('nextRetryDelay', () => {
  it('backs off over the automatic attempts', () => {
    expect([0, 1, 2].map(nextRetryDelay)).toEqual([...RETRY_DELAYS_MS]);
  });

  it('gives up after the last attempt so the error can show', () => {
    expect(nextRetryDelay(RETRY_DELAYS_MS.length)).toBeNull();
  });
});
