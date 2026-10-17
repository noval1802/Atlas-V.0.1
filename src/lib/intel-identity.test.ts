import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const serverPath = fileURLToPath(new URL('../../intel/server.js', import.meta.url));
const { resolveResponse } = require(serverPath) as {
  resolveResponse: (type: string, id: string, result: { nodes: unknown[]; links: unknown[] }) => Record<string, unknown>;
};

describe('intel resolve identity', () => {
  it('labels the response ATLAS and leaves the Wikidata client alone', () => {
    const source = readFileSync(serverPath, 'utf8');
    expect(source).toContain("source: 'ATLAS Intelligence Layer'");
    expect(source).not.toMatch(/source:\s*'OSIRIS Intelligence Layer'/);
    expect(source).toContain("const WIKIDATA_UA = 'OSIRIS-Intel/1.0 (https://osirisai.live; ontology engine)'");
    expect(source).toContain("properties: { source: 'Wikidata' }");
  });

  it('keeps the resolve envelope fields and types', () => {
    const body = resolveResponse('aircraft', 'ABC123', {
      nodes: [{ id: 'n1' }],
      links: [{ source: 'n1', target: 'n2', label: 'OPERATED BY' }],
    });
    expect(Object.keys(body)).toEqual([
      'nodes',
      'links',
      'entity',
      'source',
      'sanctions_index_size',
      'wikidata_cache_hits',
      'timestamp',
    ]);
    expect(body.source).toBe('ATLAS Intelligence Layer');
    expect(body.entity).toEqual({ type: 'aircraft', id: 'ABC123' });
    expect(body.nodes).toEqual([{ id: 'n1' }]);
    expect(body.links).toEqual([{ source: 'n1', target: 'n2', label: 'OPERATED BY' }]);
    expect(typeof body.sanctions_index_size).toBe('number');
    expect(typeof body.wikidata_cache_hits).toBe('number');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
