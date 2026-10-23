import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import http from 'http';
import net from 'node:net';
import { promises as dns } from 'node:dns';
import { isPublicIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/**
 * CCTV image proxy — bypasses CORS / hotlink protection on camera CDNs.
 * Whitelisted domains only to prevent open-proxy abuse.
 */
const ALLOWED_HOSTS = [
  'cdn.skylinewebcams.com',
  'cdn2.skylinewebcams.com',
  'voyage.aprr.fr',
  // Rijkswaterstaat motorway frames — 401 without a Referer.
  'stream.inmoves.nl',
  'thb.gov.tw',
  'etraffic.dgt.es',
  'eismoinfo.lt',
  // Serves over plain http, which an https page blocks as mixed content.
  'infobanjirjps.selangor.gov.my',
];

// Taiwan Highway Bureau cameras are DigiEver encoders, and they emit a
// malformed response header when the request carries a Referer — Node's parser
// then rejects the entire response with "Parse Error: Invalid header token".
// Asking without a Referer returns a clean JPEG. Measured across all eight
// cctv-ss01…08 servers: 8/8 fail with a Referer, 8/8 succeed without one.
//
// This is what the old curl.exe shell-out was working around. That never ran in
// production at all — curl.exe is a Windows binary name, so on the Linux host
// every THB request failed, which is why the live map showed "FEED UNAVAILABLE"
// on Taiwan while it worked on a Windows dev machine.
//
// An Accept header is still required: without one these servers hang up.
const NO_REFERER_HOSTS = ['thb.gov.tw'];

/* S3 hosts anyone's bucket, so it is allowed for TfL's JamCams bucket only, path-style. */
const S3_HOST = 's3-eu-west-1.amazonaws.com';
const S3_PREFIX = '/jamcams.tfl.gov.uk/';

export function isAllowed(url: URL): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const hostname = url.hostname.toLowerCase();
  if (hostname === S3_HOST) return url.pathname.startsWith(S3_PREFIX);
  return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}

const MAX_REDIRECTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;

function sendsReferer(hostname: string): boolean {
  return !NO_REFERER_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}

/**
 * The type to serve a frame as, read off its first bytes — never the upstream's
 * label. Singapore's LTA cameras call every JPEG `application/octet-stream`;
 * worse, any upstream that labels HTML or SVG as an image would otherwise have
 * it served from this origin. Null means "not a raster image": refuse it.
 */
export function imageType(data: Buffer): string | null {
  const head = data.subarray(0, 12);
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 8 && head.toString('latin1', 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (head.length >= 12 && head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (head.length >= 4 && head.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';
  return null;
}

/**
 * A host that answers on one address and blackholes another is common among
 * camera operators: infobanjirjps.selangor.gov.my publishes 175.143.72.197,
 * which answers in two seconds, and 58.27.97.62, which accepts the connection
 * and then says nothing. Node sends the request to whichever address the
 * resolver hands it first and waits out the timeout, where a browser would
 * have moved on. So each address is tried in turn, and the attempt timeout is
 * short enough that two fit inside this route's budget.
 */
const ATTEMPT_TIMEOUT_MS = 6000;
const MAX_ADDRESSES = 2;

/** Public addresses only; the connection is pinned to them, so a DNS answer cannot change between check and use. */
async function addressesFor(hostname: string): Promise<string[]> {
  const found = await dns.lookup(hostname, { all: true });
  const usable = found.map(a => a.address).filter(isPublicIp);
  if (!usable.length) throw new Error('Host resolves to no public address');
  return usable.slice(0, MAX_ADDRESSES);
}

/** Fetches a camera frame, trying each address the host publishes. */
async function fetchFrame(url: string, referer: string | null, hops = 0): Promise<{ status: number; contentType: string; data: Buffer }> {
  const target = new URL(url);
  // Checked on every hop: a redirect must not leave the allowlist or reach a private address.
  if (!isAllowed(target)) throw new Error('Redirect left the allowed hosts');
  const addresses = await addressesFor(target.hostname);
  let lastError: unknown;
  for (const address of addresses) {
    try {
      return await proxyFetch(url, referer, address, hops);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('No address answered');
}

/** One attempt, against one address. `referer` is omitted for hosts that choke on it. */
function proxyFetch(url: string, referer: string | null, address: string, hops: number): Promise<{ status: number; contentType: string; data: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const headers: Record<string, string> = {
      'Accept': 'image/*,*/*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    };
    if (referer) headers['Referer'] = referer;

    const options: https.RequestOptions = {
      headers,
      timeout: ATTEMPT_TIMEOUT_MS,
    };

    /* Only the address is pinned; the Host header and TLS name still come
       from the URL, so the request is the same one Node would have sent. */
    const family = net.isIPv6(address) ? 6 : 4;
    options.lookup = (_host, opts, cb) =>
      // Node asks for every address when Happy Eyeballs is on; this is the one.
      cb(null, opts?.all ? [{ address, family }] : address, family);

    if (isHttps) {
      options.rejectUnauthorized = false;
    }

    const req = mod.get(url, options, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        res.resume();
        if (hops >= MAX_REDIRECTS) { reject(new Error('Too many redirects')); return; }
        // A redirect can point at another host, so it is checked and resolved afresh.
        fetchFrame(new URL(res.headers.location, url).toString(), referer, hops + 1).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { req.destroy(); reject(new Error('Frame too large')); return; }
        chunks.push(chunk);
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 502,
          contentType: res.headers['content-type'] || 'image/jpeg',
          data: Buffer.concat(chunks),
        });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!isAllowed(target)) {
    return NextResponse.json({ error: 'Forbidden domain: ' + target.hostname }, { status: 403 });
  }

  try {
    const host = target.hostname.toLowerCase();
    const result = await fetchFrame(
      target.toString(),
      sendsReferer(host) ? `https://${target.hostname}/` : null
    );

    if (result.status >= 400) {
      return NextResponse.json({ error: `Upstream ${result.status}` }, { status: result.status });
    }

    const type = imageType(result.data);
    if (!type) return NextResponse.json({ error: 'Upstream did not return an image' }, { status: 415 });

    return new NextResponse(new Uint8Array(result.data), {
      status: 200,
      headers: {
        'Content-Type': type,
        'X-Content-Type-Options': 'nosniff',
        // Belt and braces: even if a browser rendered this as a document, it gets no script and no origin.
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'public, max-age=5, stale-while-revalidate=10',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Camera proxy error:', message);
    return NextResponse.json({ error: 'Proxy failed: ' + (message || 'unknown') }, { status: 502 });
  }
}
