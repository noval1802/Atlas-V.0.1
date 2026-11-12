import os from "os";
import type { NextConfig } from "next";

function lanDevOrigins(): string[] {
  const origins: string[] = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (name === "lo" || name.startsWith("docker") || name.startsWith("br-") || name.startsWith("veth")) continue;
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) origins.push(entry.address);
    }
  }
  return ["127.0.0.1", ...origins];
}

// Dev-only allowance so impeccable live mode can load.
const __impeccableLiveDev =
  process.env.NODE_ENV === "development" ? " http://localhost:8400" : "";

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
  turbopack: {
    rules: {
      'maplibre-gl.mjs': {
        loaders: [`${__dirname}/tools/maplibre-url-loader.cjs`],
        as: '*.js',
      },
    },
  },
  /* Standalone output exists for the Docker image — the Dockerfile copies
     .next/standalone. Vercel builds its own artifacts and does not want it:
     since the 16.2.6 -> 16.3.4 bump its adapter fails packaging with
     `ENOENT .next/next-server.js.nft.json` in onBuildComplete when a
     Turbopack build also emits standalone. The build itself compiles fine,
     which is why this only ever shows up on a deploy. Keep standalone
     everywhere except Vercel, so Docker and the platform both get what they
     expect. */
  output: process.env.VERCEL ? undefined : 'standalone',
  serverExternalPackages: ['ws', '@prisma/client', 'prisma'],
  transpilePackages: ['react-map-gl', 'mapbox-gl', 'maplibre-gl'],
  // Type errors block the build again. They were suppressed while 17 stood
  // unfixed; those are cleared, so the gate can do its job — the AstraPanel
  // crash (createPortal used without an import) shipped precisely because
  // nothing stopped it.
  typescript: {
    ignoreBuildErrors: false,
  },
  /* next/image is not used anywhere. The optimizer at /_next/image sits outside
     the login proxy, so an any-host allowlist made it an open, unauthenticated
     image proxy (and the reachable surface for GHSA-2464-fhr4-w9xw). No remote
     hosts, and no optimisation. */
  images: {
    unoptimized: true,
    remotePatterns: [],
  },
  async headers() {
    return [
      /* The worker path carries the MapLibre version, so a given URL never
         changes contents — a version bump moves it. Next serves public/ with
         max-age=0, which made every page load refetch half a megabyte before
         the map could start. Immutable is safe here precisely because the
         version is in the path. */
      {
        source: '/vendor/maplibre/:version/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          /* Feeds, tiles and camera players come from many hosts, so default-src stays
             wide. Scripts do not: only this origin runs code (production chunks use no
             eval; the dev overlay does). No plugins, no <base> swap, no framing by others. */
          { key: 'Content-Security-Policy', value: [
            `default-src 'self' 'unsafe-inline' https: wss: data: blob:${__impeccableLiveDev}`,
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}${__impeccableLiveDev}`,
            "worker-src 'self' blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
          ].join('; ') },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
      /* Proxies relay bytes from third-party servers. Listed last so this CSP replaces
         the page one above (the last matching rule wins; src/lib/next-config.test.ts pins it):
         if a browser ever rendered a relayed response as a document, it gets no
         script and no origin. */
      ...['/api/cctv/hls', '/api/cctv/tpt/media', '/api/cctv/proxy', '/api/proxy-tiles'].map(source => ({
        source,
        headers: [{ key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" }],
      })),
    ];
  },
};

export default nextConfig;
