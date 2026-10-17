import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

describe('legacy token panel', () => {
  it('stays off both HUDs and keeps the chart implementation', () => {
    const panel = readFileSync(join(here, 'TokenPanel.tsx'), 'utf8');
    const dashboard = readFileSync(join(here, '../app/(en)/peta/monitoring-dashboard.tsx'), 'utf8');

    expect(panel).toContain('export const SHOW_LEGACY_TOKEN_PANEL = false');
    expect(panel).toContain('if (!SHOW_LEGACY_TOKEN_PANEL) return null');
    expect(panel).toContain('$OSIRIS');
    expect(panel).toContain('https://dexscreener.com/solana/G3rchnZ2WLsBDZSrVME4fTyzFP57F3yvvqWMxAy2b4ce');
    expect(panel).not.toContain('$ATLAS');
    expect(dashboard.match(/<TokenPanel \/>/g)).toHaveLength(2);
  });
});
