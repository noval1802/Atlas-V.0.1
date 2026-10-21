import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { writeSnapshot, readSnapshot } from '@/lib/cctv-snapshot';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { normalizeCctvToken, updateStoredCctvToken, upsertEnvAssignment } from './cctv-tokens';

describe('cctv token input', () => {
  it('keeps a bare token and strips a cookie prefix or a WFS url', () => {
    expect(normalizeCctvToken('  abc_DEF-123  ')).toBe('abc_DEF-123');
    expect(normalizeCctvToken('access_token=abc_DEF-123')).toBe('abc_DEF-123');
    expect(normalizeCctvToken('https://jid.jasamarga.com/wfs?service=WFS&token=uuid-1&request=GetFeature')).toBe('uuid-1');
  });

  it('rejects an empty value, whitespace, and quotes', () => {
    expect(normalizeCctvToken('')).toBeNull();
    expect(normalizeCctvToken('two words')).toBeNull();
    expect(normalizeCctvToken('has"quote')).toBeNull();
  });

  it('replaces one assignment and leaves the rest of the file', () => {
    const next = upsertEnvAssignment('A=1\nTPT_CCTV_TOKEN=old\nB=2\n', 'TPT_CCTV_TOKEN', 'new');
    expect(next).toBe('A=1\nTPT_CCTV_TOKEN=new\nB=2\n');
  });

  it('deletes a repeated old token and keeps a single new assignment', () => {
    const next = upsertEnvAssignment(
      'A=1\nTPT_CCTV_TOKEN=old\nexport TPT_CCTV_TOKEN=older\nB=2\n',
      'TPT_CCTV_TOKEN',
      'new',
    );
    expect(next).toBe('A=1\nTPT_CCTV_TOKEN=new\nB=2\n');
    expect(next.match(/TPT_CCTV_TOKEN/g)).toHaveLength(1);
  });

  it('writes the new value to disk without echoing it into another key', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cctv-token-'));
    const file = path.join(dir, '.env');
    const previousSnapshot = process.env.OSIRIS_CCTV_SNAPSHOT;
    process.env.OSIRIS_CCTV_SNAPSHOT = path.join(dir, 'missing-catalog.json');
    writeFileSync(file, 'OTHER=keep\nTPT_CCTV_TOKEN=old\nTPT_CCTV_TOKEN=older\n');
    try {
      const result = await updateStoredCctvToken('jakarta', 'access_token=fresh-token', file);
      expect(result).toEqual({ ok: true });
      expect(readFileSync(file, 'utf8')).toBe('OTHER=keep\nTPT_CCTV_TOKEN=fresh-token\n');
      expect(process.env.TPT_CCTV_TOKEN).toBe('fresh-token');
    } finally {
      delete process.env.TPT_CCTV_TOKEN;
      if (previousSnapshot === undefined) delete process.env.OSIRIS_CCTV_SNAPSHOT;
      else process.env.OSIRIS_CCTV_SNAPSHOT = previousSnapshot;
    }
  });

  it('drops saved cameras for the replaced token and leaves other regions', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cctv-token-'));
    const file = path.join(dir, '.env');
    const previousSnapshot = process.env.OSIRIS_CCTV_SNAPSHOT;
    process.env.OSIRIS_CCTV_SNAPSHOT = path.join(dir, 'catalog.json');
    writeFileSync(file, 'JASAMARGA_WFS_TOKEN=old-token\n');
    await writeSnapshot({
      jasamarga: [{ id: 'jm-old' }],
      tpt: [{ id: 'tpt-keep' }],
    });
    try {
      const result = await updateStoredCctvToken('jasamarga', 'new-token', file);
      expect(result).toEqual({ ok: true });
      expect(readFileSync(file, 'utf8')).toBe('JASAMARGA_WFS_TOKEN=new-token\n');
      const restored = await readSnapshot();
      expect(restored?.regions.jasamarga).toBeUndefined();
      expect(restored?.regions.tpt).toEqual([{ id: 'tpt-keep' }]);
    } finally {
      delete process.env.JASAMARGA_WFS_TOKEN;
      if (previousSnapshot === undefined) delete process.env.OSIRIS_CCTV_SNAPSHOT;
      else process.env.OSIRIS_CCTV_SNAPSHOT = previousSnapshot;
    }
  });
});
