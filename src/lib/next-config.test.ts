import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';

/** The CSP Next sends for a path: the last matching rule wins. Covers the two source shapes in use. */
async function cspFor(path: string): Promise<string | undefined> {
  let csp: string | undefined;
  for (const rule of (await nextConfig.headers?.()) ?? []) {
    if (rule.source !== '/(.*)' && rule.source !== path) continue;
    csp = rule.headers.find(h => h.key === 'Content-Security-Policy')?.value ?? csp;
  }
  return csp;
}

describe('proxy CSP', () => {
  it.each(['/api/cctv/hls', '/api/cctv/tpt/media', '/api/cctv/proxy', '/api/proxy-tiles'])(
    '%s keeps the sandbox, not the page policy',
    async path => {
      expect(await cspFor(path)).toBe("default-src 'none'; sandbox");
    },
  );

  it('pages keep their own policy', async () => {
    expect(await cspFor('/peta')).toContain("script-src 'self'");
  });
});
