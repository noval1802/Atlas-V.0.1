import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetch } from 'undici';
import { pinnedAgent, safeFetch } from './ssrf-guard';

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => res.end(`host=${req.headers.host}`));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

describe('pinnedAgent', () => {
  it('connects to the pinned address, not to whatever DNS would answer', async () => {
    // .invalid never resolves, so reaching the server proves the pin was used. Host still names the URL.
    const res = await fetch(`http://camera.invalid:${port}/`, { dispatcher: pinnedAgent(['127.0.0.1']) });
    expect(await res.text()).toBe(`host=camera.invalid:${port}`);
  });

  it('refuses to connect with nothing validated', async () => {
    await expect(fetch(`http://camera.invalid:${port}/`, { dispatcher: pinnedAgent([]) })).rejects.toThrow();
  });
});

describe('safeFetch', () => {
  it('blocks private targets before connecting', async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toThrow(/blocked target/);
    await expect(safeFetch(`http://localhost:${port}/`)).rejects.toThrow(/blocked target/);
  });
});
