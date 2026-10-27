import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/overview/route';

const overviewSource = readFileSync(fileURLToPath(new URL('../app/api/ai/overview/route.ts', import.meta.url)), 'utf8');

describe('AI overview data boundary', () => {
  it('builds the read-out on this server without an external model', () => {
    expect(overviewSource).not.toMatch(/generativelanguage|@google\/generative-ai|GEMINI_API_KEY/);
    expect(overviewSource).not.toMatch(/fetch\(/);
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

  it('rejects a body that is not JSON', async () => {
    withoutGeminiKeys();
    const response = await post('not-json');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
  });
});
