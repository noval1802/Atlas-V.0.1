import { describe, expect, it } from 'vitest';
import { classify, formatAge, statusTitle, type SourceStatus } from './source-status';

const MIN = 60_000;
const NOW = 1_800_000_000_000;

describe('classify', () => {
  it('is ok while the last answer is younger than the limit', () => {
    expect(classify({ count: 5, fetchedAt: NOW - 2 * MIN }, 10 * MIN, NOW)).toBe('ok');
  });

  it('is late when the data is old, even though the cache still serves it', () => {
    expect(classify({ count: 5, fetchedAt: NOW - 30 * MIN }, 10 * MIN, NOW)).toBe('lambat');
  });

  it('is late as soon as a refresh fails, however recent the data', () => {
    expect(classify({ count: 5, fetchedAt: NOW - MIN, failedAt: NOW }, 10 * MIN, NOW)).toBe('lambat');
  });

  it('is late when the age is unknown (restored from disk)', () => {
    expect(classify({ count: 5 }, 10 * MIN, NOW)).toBe('lambat');
  });

  it('fails when there is nothing to show and the upstream failed', () => {
    expect(classify({ count: 0, failedAt: NOW }, 10 * MIN, NOW)).toBe('gagal');
  });

  it('is inactive when never loaded', () => {
    expect(classify(undefined, 10 * MIN, NOW)).toBe('nonaktif');
  });
});

describe('formatAge', () => {
  it.each([[0, 'baru'], [59_000, 'baru'], [5 * MIN, '5 mnt'], [3 * 60 * MIN, '3 jam'], [3 * 24 * 60 * MIN, '3 hari'], [-5000, 'baru']])(
    '%i ms → %s', (ms, text) => expect(formatAge(ms)).toBe(text),
  );
});

describe('statusTitle', () => {
  it('says when the data was fetched and since when it fails', () => {
    const s: SourceStatus = { id: 'gempa', label: 'Gempa', source: 'BMKG', state: 'lambat', fetchedAt: NOW - 20 * MIN, failingSince: NOW - 5 * MIN, count: 3 };
    const title = statusTitle(s, NOW, ms => `T${(NOW - ms) / MIN}`);
    expect(title).toBe('Gempa · BMKG\nData terlambat\nDiambil T20 (20 mnt lalu)\nGagal diperbarui sejak T5');
  });

  it('reads naturally for data under a minute old', () => {
    const s: SourceStatus = { id: 'gempa', label: 'Gempa', source: 'BMKG', state: 'ok', fetchedAt: NOW - 10_000, failingSince: null, count: 3 };
    expect(statusTitle(s, NOW, () => 'T')).toContain('Diambil T (baru saja)');
  });
});
