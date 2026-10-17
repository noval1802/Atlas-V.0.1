import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { rotateApiKey } from './ai-engine';
import { POST } from '@/app/api/ai/overview/route';

const engineSource = readFileSync(fileURLToPath(new URL('./ai-engine.ts', import.meta.url)), 'utf8');
const overviewSource = readFileSync(fileURLToPath(new URL('../app/api/ai/overview/route.ts', import.meta.url)), 'utf8');

function promptBlock(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe('AI persona prompts', () => {
  it('names the analyst ATLAS and keeps the Gemini model', () => {
    const system = promptBlock(engineSource, 'const SYSTEM_PROMPT', 'const BRIEFING_PROMPT');
    const briefing = promptBlock(engineSource, 'const BRIEFING_PROMPT', 'export function createGeminiClient');
    const overviewPrompts = promptBlock(overviewSource, 'const SYSTEM_DEFAULT', 'async function geminiOverview');

    expect(system).toContain('You are ATLAS Intelligence Analyst');
    expect(system).toContain('ATLAS Global Intelligence Platform');
    expect(system).toContain('the ATLAS platform');
    expect(system).not.toContain('OSIRIS');
    expect(briefing).toContain('ATLAS Daily Intelligence Briefing');
    expect(briefing).toContain('## ATLAS INTELLIGENCE BRIEFING');
    expect(briefing).not.toContain('OSIRIS');
    expect(overviewPrompts).toContain('You are ATLAS, a terse intelligence analyst');
    expect(overviewPrompts).toContain('You are ATLAS, an OSINT analyst');
    expect(overviewPrompts).not.toContain('OSIRIS');

    expect(engineSource.match(/model: 'gemini-2\.0-flash'/g)).toHaveLength(2);
    expect(overviewSource.match(/model: 'gemini-2\.0-flash'/g)).toHaveLength(1);
    expect(overviewSource).toContain('process.env[`GEMINI_API_KEY_${i}`]');
  });

  it('rotates configured keys without choosing another provider', () => {
    expect(() => rotateApiKey([])).toThrow('No API keys available');
    expect(rotateApiKey(['first-key', 'second-key'])).toBe('first-key');
    expect(rotateApiKey(['first-key', 'second-key'])).toBe('second-key');
  });
});

describe('POST /api/ai/overview heuristic', () => {
  const saved = new Map<string, string | undefined>();

  afterEach(() => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    saved.clear();
  });

  function withoutGeminiKeys() {
    for (let i = 1; i <= 8; i++) {
      const name = `GEMINI_API_KEY_${i}`;
      if (!saved.has(name)) saved.set(name, process.env[name]);
      delete process.env[name];
    }
  }

  function post(body: string, path = '/api/ai/overview') {
    return POST(new NextRequest(`http://127.0.0.1:3005${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }));
  }

  it('keeps the analyst fallback and the response fields when no key is set', async () => {
    withoutGeminiKeys();
    const response = await post(JSON.stringify({ mode: 'alerts', payload: {} }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['brief', 'generatedAt', 'generatedBy', 'highlights', 'mode', 'overview']);
    expect(body.mode).toBe('alerts');
    expect(body.generatedBy).toBe('analyst');
    expect(typeof body.overview).toBe('string');
    expect(body.overview.length).toBeGreaterThan(0);
    expect(Array.isArray(body.highlights)).toBe(true);
    expect(body.overview).not.toContain('You are ATLAS');
    expect(typeof body.generatedAt).toBe('string');
  });

  it('omits the alerts brief for a markets read-out', async () => {
    withoutGeminiKeys();
    const response = await post(JSON.stringify({ mode: 'markets', payload: {} }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['generatedAt', 'generatedBy', 'highlights', 'mode', 'overview']);
    expect(body.mode).toBe('markets');
    expect(body.generatedBy).toBe('analyst');
    expect(body.brief).toBeUndefined();
  });

  it('rejects a body that is not JSON', async () => {
    withoutGeminiKeys();
    const response = await post('not-json');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
  });
});
