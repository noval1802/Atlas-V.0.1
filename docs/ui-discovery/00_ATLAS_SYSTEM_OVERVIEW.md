# 00 — ATLAS: Ikhtisar Sistem (AS-IS)

> Catatan 12 November 2026: pelacakan pesawat dan satelit sudah dihapus: `/api/flights`, `/api/aircraft`, `/api/flight-route`, `/api/satellites`, `/api/satellites/orbit`, `FlightWatchPanel`, `SatelliteCard`, `src/lib/orbit.ts`, paket `satellite.js`, serta sumber OpenSky/adsb.*/CelesTrak/SatNOGS dan variabel `OPENSKY_CLIENT_ID/SECRET`. Basemap citra satelit tetap ada.

> Dokumen discovery read-only, disusun 2026-10-30 dari kode di `/home/wizard/Atlas-V.0.1`.
> Penanda: **[CONFIRMED]** = terlihat langsung di kode (file:baris dicantumkan).
> **[UNVERIFIED]** = butuh login/runtime/DB untuk dibuktikan; tidak diuji (tanpa build, tanpa query DB, tanpa jaringan).
> Nama paket di `package.json` masih `osiris` (package.json:2); merek UI adalah "ATLAS" (src/app/site-metadata.ts:53).

---

## 1. Stack & versi

Versi terpasang dibaca dari `node_modules/*/package.json` (rentang deklarasi di `package.json:26-63`). [CONFIRMED]

| Paket | Terpasang | Deklarasi | Catatan |
|---|---|---|---|
| next | 16.4.3 | ^16.4.3 | App Router, `src/proxy.ts` menggantikan middleware |
| react / react-dom | 19.2.4 | 19.2.4 (pinned) | |
| typescript | 5.9.3 | ^5 | `ignoreBuildErrors: false` (next.config.ts:44-46) |
| prisma / @prisma/client | 6.19.3 / 6.19.2 | ^6.19.2 | PostgreSQL (prisma/schema.prisma:5-8) |
| maplibre-gl | 6.7.0 | 6.7.0 (pinned) | worker di-vendor ke `/vendor/maplibre/<ver>/` (tools/prepare-map-worker.mjs; next.config.ts:57-67) |
| react-map-gl | 8.1.1 | ^8.1.1 | di `transpilePackages` (next.config.ts:39) |
| framer-motion | 12.38.0 | ^12.38.0 | |
| lucide-react | 1.14.0 | ^1.14.0 | ikon |
| tailwindcss / @tailwindcss/postcss | 4.3.0 | ^4 | `@import "tailwindcss";` (src/app/globals.css:2), `@theme inline` (globals.css:153-158) |
| hls.js | 1.6.16 | ^1.6.16 | pemutar CCTV HLS |
| mpegts.js | 1.8.0 | ^1.8.0 | pemutar CCTV MPEG-TS/FLV |
| vitest | 5.0.3 | ^5.0.3 | `npm test` = `vitest run` (package.json:15); 117 file `*.test.ts` di `src/` |
| lainnya | — | — | lightweight-charts, react-force-graph-2d, satellite.js, rss-parser, ws, undici, sharp, google-libphonenumber, @vercel/analytics (package.json:26-46) |

Runtime lokal: Node `v22.23.4` (`node -v`); `start-local.sh:3-5` menjalankan PostgreSQL **18** user-owned di port 5433 (`/usr/lib/postgresql/18/bin/pg_ctl`) lalu `npm run dev` (start-local.sh:8). [CONFIRMED]
Catatan: `docker-compose.yml:103` memakai `postgres:16-alpine` — versi PG berbeda antara jalur lokal (18) dan Docker (16). [CONFIRMED]

Skrip penting (package.json:5-21): `predev`/`prebuild` → `tools/prepare-map-worker.mjs`; `postbuild` → `tools/check-artifact.mjs`; `db:migrate`, `db:seed`, `ops:recover-admin`.

---

## 2. Struktur repositori

| Folder | Peran | Status |
|---|---|---|
| `src/app/(id)/` | Route group bahasa Indonesia: `/`, `/masuk`, `/daftar`, `/lupa-sandi`, `/atur-sandi`, `/operator`, `/pengguna` + komponen klien per-rute (`login-form.tsx`, `user-board.tsx`, `operator-board.tsx`, dll.) | aktif |
| `src/app/(en)/` | Route group `lang="en"`: `/peta` (peta monitoring) dan `/peta/multiview` | aktif |
| `src/app/api/*` | 46 Route Handler (`route.ts`) — lihat §7; `src/app/api/cctv/*.ts` juga berisi ~60 modul adaptor sumber CCTV per negara/kota (aceh.ts, bandung.ts, jasamarga.ts, texas.ts, tpt.ts, …) | aktif |
| `src/app/globals.css` | 2746 baris; Tailwind v4 + design token CSS (`:root`, `body.theme-*`) | aktif |
| `src/app/site-metadata.ts` | `metadata`, `viewport`, `jsonLd` bersama kedua root layout | aktif |
| `src/components/` | 27 komponen klien peta/dasbor (OsirisMap, LayerPanel, LiveAlerts, DirectionsBar, …) | aktif |
| `src/components/ops/` | Shell & komponen portal operasional (auth-frame, document-shell, ops-shell, portal-menu, operator-dashboard, password-field, zone-clocks) | aktif |
| `src/lib/` | Utilitas murni + klien feed (layer-feeds, sourceCache, httpJson, stealthFetch, fetch-pool, map-*, style-tokens, …) | aktif |
| `src/lib/ops/` | Auth/RBAC/DB: access.ts, session.ts, gate.ts, current-user.ts, db.ts, audit.ts, rate-limit.ts, password.ts, mail.ts, reset-token.ts, situation-save.ts, operator-view.ts | aktif |
| `src/proxy.ts` | Gerbang request (pengganti middleware) | aktif |
| `prisma/` | `schema.prisma`, 3 migrasi (`20261002081920_ops_init`, `20261011120000_auth_accounts`, `20261022090000_kotamaops_matra`), seed & skrip pemulihan admin (`seed.mjs`, `recover-admin.mjs`, `admin-bootstrap.mjs`, `password-policy.mjs`) | aktif |
| `tools/` | `prepare-map-worker.mjs`, `maplibre-url-loader.cjs` (loader Turbopack, next.config.ts:21-28), `check-artifact.mjs`, `preview-smoke.mjs` | aktif |
| `intel/` | Layanan Express terpisah `osiris-intel` (OpenSanctions + Wikidata SPARQL) port 4000 (intel/server.js:1-20) | aktif via Docker; dipanggil `/api/entity/expand` |
| `nginx/` | `nginx.conf`: cache tile CARTO di `/proxy/tiles/`, reverse proxy ke `osiris:3000` (nginx/nginx.conf:28,74-77,107-109) | Docker |
| `ops/` | `backup/backup.sh`, `backup/restore.sh`, `tls/self-signed.sh` | Docker/ops |
| `docs/` | audit (`docs/audit/atlas-2026-10-29/*`), ops, security, superpowers, ui-discovery | dokumentasi |
| `public/` | aset statis, `dark-matter-style.json`, lambang Kodam (`/kodam/*.png`, schema.prisma:78) | aktif |
| `engine/` | **hanya** `__pycache__/*.cpython-314.pyc` (tanpa sumber .py) | **mati/legacy** |
| `scripts/` | `gen-nkri-outline.py` (generator outline NKRI) | utilitas sekali-jalan |
| `runs/`, `scratch/`, `.omc/`, `.impeccable/` | artefak alat/sesi | bukan bagian runtime |

Sisa artefak alat di dalam `src/app`: `src/app/(id)/operator/.omc/...` dan `src/app/(id)/pengguna/.omc/...` (file JSON state sesi alat) — tidak dipakai aplikasi. [CONFIRMED]

---

## 3. Pola arsitektur

- **Modular monolith**: satu aplikasi Next.js menampung UI, API BFF/proxy feed, auth, dan akses DB (Prisma). Layanan terpisah hanya `intel/` (opsional) dan Postgres. [CONFIRMED]
- **Dua root layout** (tidak ada `src/app/layout.tsx`): `(id)/layout.tsx:9-11` → `<DocumentShell lang="id">`; `(en)/layout.tsx:9-11` → `<DocumentShell lang="en">`. `DocumentShell` merender `<html lang>`, preconnect Google Fonts, JSON-LD, dan membungkus children dengan `MotionPreference` + `ErrorBoundary name="ATLAS Core"` (src/components/ops/document-shell.tsx:13-36). Konsekuensi: navigasi `(id)`↔`(en)` adalah full page load (perilaku Next untuk root layout berbeda). [CONFIRMED kode; perilaku navigasi UNVERIFIED]
- Komentar `(en)/layout.tsx:8` menyebut "documentation, and privacy notice", tetapi **tidak ada** halaman docs/privacy di `(en)` — hanya `/peta`. [CONFIRMED]
- **Rendering**: semua `page.tsx`/`layout.tsx` adalah Server Component; interaktivitas di file `'use client'` terpisah. Halaman terlindungi memakai `export const dynamic = "force-dynamic"` dan membaca DB langsung via `opsDb()` (lihat §4). `OsirisMap` dimuat `dynamic(..., { ssr: false })` (monitoring-dashboard.tsx:30).
- **Gerbang `src/proxy.ts`** (matcher proxy.ts:58-63): `/api/*` → tolak write lintas-situs (403), lewati API publik, wajib sesi (401), API admin wajib `canManageUsers` (403) (proxy.ts:14-25). Halaman → `trackPageView` (Umami, proxy.ts:27), lalu halaman terlindungi tanpa sesi → redirect `/masuk?next=…` (proxy.ts:29-39), peran ditolak → `deniedPage` (proxy.ts:40-46). Aset statis dikecualikan dari matcher (proxy.ts:61).
- **Pertahanan berlapis**: setiap halaman terlindungi dan setiap route `ops/*` memanggil ulang `currentUser()` + cek peran (lihat §6) walau proxy sudah memeriksa. [CONFIRMED]
- Header keamanan global (CSP, HSTS di production, nosniff, X-Frame-Options) di next.config.ts:55-92; `output: 'standalone'` kecuali Vercel (next.config.ts:37).

---

## 4. Routing & layout

| File | Route | Mode | Data / redirect |
|---|---|---|---|
| `src/app/(id)/layout.tsx` | root layout grup id | Server | `lang="id"` |
| `src/app/(en)/layout.tsx` | root layout grup en | Server | `lang="en"` |
| `src/app/(id)/page.tsx` | `/` | Server, force-dynamic | sesi hidup → `redirect(homeForRole)`; selainnya → `/masuk` (page.tsx:10-15) |
| `src/app/(id)/masuk/page.tsx` | `/masuk` | Server → `LoginForm` (client, `login-form.tsx`, 100 baris) dalam `Suspense` + `AuthFrame` | POST `/api/ops/login` |
| `src/app/(id)/daftar/page.tsx` | `/daftar` | Server → `RegisterForm` (client, 124 baris) | POST `/api/ops/register` |
| `src/app/(id)/lupa-sandi/page.tsx` | `/lupa-sandi` | Server → `ForgotForm` (client, 70 baris) | POST `/api/ops/password/forgot` |
| `src/app/(id)/atur-sandi/page.tsx` | `/atur-sandi` | Server → `ResetForm` (client, 85 baris) dalam `Suspense` | POST `/api/ops/password/reset` |
| `src/app/(id)/operator/page.tsx` | `/operator` | Server, force-dynamic → `OperatorDashboard` (client, src/components/ops/operator-dashboard.tsx, 499 baris) yang memakai `OperatorBoard` (`(id)/operator/operator-board.tsx`, 249 baris) | tanpa user → `/masuk?next=/operator` (page.tsx:11); Prisma `situation.findMany` + `situationRevision.findMany take 20` dengan `situationWhere` (page.tsx:12-28) |
| `src/app/(id)/pengguna/page.tsx` | `/pengguna` | Server, force-dynamic → `OpsShell` + `UserBoard` (client, 332 baris) + tabel audit server-render | tanpa user → `/masuk?next=/pengguna`; bukan admin → `homeForRole` (page.tsx:33-34); Prisma user/kotamaops/authAudit `take 80` (page.tsx:35-43) |
| `src/app/(en)/peta/page.tsx` | `/peta` | Server, force-dynamic → `Dashboard` (client, `monitoring-dashboard.tsx`, 1466 baris) | tanpa user → `/masuk?next=/peta`; Prisma `kotamaops.findMany` (page.tsx:10-23); prop `role`, `userName`, `tileProxy` |
| `src/app/(en)/peta/multiview/page.tsx` | `/peta/multiview` | Server, force-dynamic → `MultiView` (client, 145 baris) | tanpa user → `/masuk?next=/peta` (page.tsx:11) |

Total: **9 page.tsx**, **2 layout.tsx**. Tidak ada `loading.tsx`, `error.tsx`, `not-found.tsx`. Tidak ada `redirects()` di next.config.ts. [CONFIRMED via `find`]

---

## 5. Model data (prisma/schema.prisma)

Enum: `OpsRole` (10-17), `Matra` AD/AL/AU (20-24), `OpsStatus` KONDUSIF/WASPADA/SIAGA (26-30), `AccountStatus` PENDING/ACTIVE/REJECTED/DISABLED (33-38).

| Model | Field penting untuk UI | Relasi | Index (baris) |
|---|---|---|---|
| `User` (41-66) | name, username @unique, email? @unique, organization, position, role, active, accountStatus (default ACTIVE), **sessionVersion** Int, kotamaopsId?, lastLoginAt | Kotamaops?, revisions, passwordResets, auditActions/auditTargets | `[role, active]`, `[kotamaopsId]`, `[accountStatus]` (63-65) |
| `Kotamaops` (69-87) | code @unique, name, region, location, latitude, longitude, matra (default AD), logo (path `/public`) | situation? (1-1), users, revisions | `[matra]` (86) |
| `Situation` (90-102) | kotamaopsId @unique, status, personnel, deployed, incidentCount, note, updatedByName | Kotamaops (onDelete Cascade) | via @unique |
| `SituationRevision` (105-119) | snapshot status/angka/note per simpan, editorId? | Kotamaops (Cascade), User (SetNull) | `[kotamaopsId, createdAt]` (118) |
| `PasswordReset` (122-132) | tokenHash @unique (SHA-256), expiresAt, usedAt | User (Cascade) | `[userId]` (131) |
| `AuthAudit` (135-149) | action, result, actorId?, targetId?, ip, detail | User "AuditActor"/"AuditTarget" (SetNull) | `[createdAt]`, `[action]` (147-148) |

Klien Prisma singleton di `globalThis` (src/lib/ops/db.ts:3-8). Isi data (jumlah Kotamaops, user) **[UNVERIFIED]** — tidak ada query DB.

---

## 6. Auth, sesi & RBAC

### Sesi (src/lib/ops/session.ts)
- Cookie `osiris_ops` (session.ts:1); token = `base64url(JSON{sub,exp,ver}).HMAC-SHA256` (session.ts:42-55) via WebCrypto (Edge-kompatibel).
- Masa berlaku: 8 jam default (`SESSION_MS`, :2) atau 14 hari bila "ingat saya" (`REMEMBER_MS`, :3).
- Rahasia `OPS_SESSION_SECRET`; < 32 karakter dianggap kosong → semua sesi gagal tertutup (session.ts:6-9).
- Verifikasi: tanda tangan constant-time, exp, `ver` integer ≥0 (session.ts:65-79).
- Flag cookie: `HttpOnly; SameSite=Lax; Path=/; Max-Age`, `Secure` hanya saat `NODE_ENV=production` (session.ts:81-90).
- **sessionVersion**: `sessionMatchesUser` mensyaratkan `active && accountStatus==="ACTIVE" && ver===user.sessionVersion` (access.ts:147-153). Version di-increment saat logout (api/ops/logout/route.ts:14-16), reset sandi (api/ops/password/reset/route.ts:44), dan perubahan akun tertentu (api/ops/users/[id]/route.ts:64) → semua sesi lama gugur.
- Validasi sesi di dua tempat: `sessionAccount()` (gate.ts:55-68, dipakai proxy & `/`) dan `currentUser()` (current-user.ts:9-17, dipakai halaman & route) — keduanya membaca baris User live dari DB per request.

### Alur login (api/ops/login/route.ts)
1. Rahasia belum dikonfigurasi → 500 (:15-16).
2. Rate-limit in-memory 3 bucket / 15 menit: per-IP 30, per-IP+user 8, per-user 20 (:27-34) — `src/lib/ops/rate-limit.ts` adalah `Map` dalam proses (rate-limit.ts:3-7), tidak dibagi antar instance.
3. Verifikasi hash dengan `DUMMY_PASSWORD_HASH` untuk user tak dikenal (anti user-enumeration timing) (:35-46).
4. Akun tidak aktif / bukan ACTIVE → 403 (:47-50).
5. Update `lastLoginAt`, terbitkan token dengan `version: user.sessionVersion`, tulis audit, balas `{ ok, role, home, allowed }` + `Set-Cookie` (:51-58). Klien (`login-form.tsx:31`) memilih tujuan; `acceptedNext` (access.ts:126-140) membatasi `next` ke path yang diizinkan (+ query `layers` ≤500 char).

### Peran & kapabilitas (src/lib/ops/access.ts)

| Peran | canManageUsers (:23) | canWriteSituation (:44) | seesAllKotamaops (:53) | homeForRole (:66) | portalLabel (:58) | portalLinks (:75) |
|---|---|---|---|---|---|---|
| SUPER_ADMIN | ya | ya | ya | `/pengguna` | Admin | peta, operator, pengguna |
| ADMIN | ya | ya | ya | `/pengguna` | Admin | peta, operator, pengguna |
| OPERATOR_PUSDALOPS | — | ya | ya | `/operator` | Operator | peta, "Dasbor operator" |
| OPERATOR_KODAM | — | ya (hanya unitnya) | **tidak** | `/operator` | Operator | peta, "Dasbor operator" |
| ANALYST | — | — | ya | `/peta` | Viewer | peta, "Dasbor situasi" |
| PIMPINAN | — | — | ya | `/peta` | Monitoring | peta, "Dasbor situasi" |

- `deniedPage` (access.ts:85-90): hanya `/pengguna/*` dibatasi; non-admin dipantulkan ke `homeForRole`. `/operator` **terbuka untuk semua peran yang login** (read-only bagi ANALYST/PIMPINAN via `canWrite`).
- `situationWhere` (access.ts:93-96): OPERATOR_KODAM hanya `kotamaopsId` miliknya (`"__none__"` bila null); lainnya semua.
- `mayWriteSituationRow`/`situationWriteLookup` (access.ts:99-117): baris unit lain dilaporkan "absent" (404) agar keberadaannya tidak bocor.
- `superAdminRoleChangeError` (access.ts:32-42): hanya SUPER_ADMIN boleh memberi/mencabut SUPER_ADMIN; super admin aktif terakhir tidak dapat diturunkan (api/ops/users/[id]/route.ts:52).
- Registrasi publik selalu `ANALYST` (`registrationRole`, access.ts:143-145) dan `accountStatus: "PENDING"` (api/ops/register/route.ts:34-36) sampai disetujui admin.
- `allowedNext` (access.ts:119-123): admin → `/pengguna,/operator,/peta,/`; lainnya → `/operator,/peta,/`.

### Rute publik
- API publik (gate.ts:6-14): `/api/health`, `/api/health/ready`, `/api/ops/login`, `/api/ops/logout`, `/api/ops/register`, `/api/ops/password/forgot`, `/api/ops/password/reset`.
- API admin (gate.ts:22-31): `/api/ops/users*`, `/api/ops/audit*`, `/api/cctv/tokens*`.
- Halaman terlindungi (gate.ts:71-80): `/peta*`, `/operator*`, `/pengguna*`. Halaman lain (`/`, `/masuk`, `/daftar`, `/lupa-sandi`, `/atur-sandi`) publik.
- Semua API lain (feed peta, CCTV, geo, ai) **wajib sesi** di proxy (proxy.ts:19-20).
- CSRF: `crossSiteWrite` menolak non-GET dengan `sec-fetch-site` selain same-origin/none, atau Origin ≠ Host (gate.ts:38-50).

---

## 7. Katalog API (46 route.ts)

Auth: **S** = sesi wajib (proxy.ts:19-20), **P** = publik, **A** = sesi + admin (proxy + cek di route). Cache = header `Cache-Control` respons; "SC" = `cachedSource` in-memory (src/lib/sourceCache.ts).

### ops/* (DB, semua `force-dynamic`)
| Path | Metode | Auth | Fungsi |
|---|---|---|---|
| `/api/ops/login` | POST | P | login, set cookie (lihat §6) |
| `/api/ops/logout` | POST | P | bump sessionVersion + hapus cookie (logout/route.ts:9-22) |
| `/api/ops/register` | POST | P | pendaftaran, rate-limit 5/jam/IP (register/route.ts:12) |
| `/api/ops/password/forgot` | POST | P | kirim tautan reset via SMTP (`src/lib/ops/mail.ts`), 5/jam per IP & email (forgot/route.ts:21) |
| `/api/ops/password/reset` | POST | P | selesaikan reset, 10/jam/IP (reset/route.ts:13) |
| `/api/ops/situations` | GET | S | daftar situasi ber-scope `situationWhere` (situations/route.ts:8-12) |
| `/api/ops/situations/[id]` | PATCH | S + canWriteSituation | simpan situasi + revisi (situations/[id]/route.ts:8-18) |
| `/api/ops/users` | GET, POST | A | daftar / buat akun (users/route.ts:10,21) |
| `/api/ops/users/[id]` | PATCH | A | ubah peran/status/sandi/unit (users/[id]/route.ts:19) |
| `/api/ops/audit` | GET | A | jejak autentikasi (audit/route.ts:8) |

### Feed peta (S)
| Path | Metode | Upstream | Cache |
|---|---|---|---|
| `/api/flights` | GET | adsb.fi (`opendata.adsb.fi`, stealthFetch), OpenSky (+OAuth `auth.opensky-network.org`) (flights/route.ts:207,411,418) | s-maxage=30 / no-store bila <100 (:553) |
| `/api/aircraft` | GET | adsb.lol trace, adsbdb (aircraft/route.ts) | SC + s-maxage=120 (:219,262) |
| `/api/flight-route` | GET | adsbdb, hexdb.io, airplanes.live (stealthFetch) (flight-route/route.ts:175-224) | s-maxage=60–120 |
| `/api/satellites` | GET | CelesTrak, SatNOGS (stealthFetch :246) | dinamis (:343) |
| `/api/satellites/orbit` | GET | lokal (file + `src/lib/orbit.ts`) | s-maxage=600 (:117) |
| `/api/earthquakes` | GET | BMKG `data.bmkg.go.id`, `api-apps.bmkg.go.id` (src/lib/bmkg.ts:12-16) | SC + s-maxage=60 (:11,33) |
| `/api/fires` | GET | NASA FIRMS, NASA EONET | s-maxage=600 (:91) |
| `/api/weather` | GET | EONET + GDACS RSS (stealthFetch :146,150) | SC 3 menit + s-maxage=120 (:125,135) |
| `/api/gdelt` | GET | **GDACS** (bukan GDELT, lihat gdelt-events/route.ts:11) | s-maxage=300 |
| `/api/gdelt-events` | GET | gdeltproject.org | s-maxage=300 |
| `/api/maritime` | GET | AISStream WebSocket `wss://stream.aisstream.io` (maritime/route.ts:129), kunci `AIS_API_KEY` | max-age dinamis (:366) |
| `/api/news` | GET | Telegram `t.me` + RSS (BBC, Al Jazeera, Guardian, CNA, SCMP, TASS, AA, Africanews) | SC per kanal + s-maxage=60 (:173,214,467) |
| `/api/live-news` | GET | daftar statis YouTube/Rumble | s-maxage=86400 |
| `/api/stats` | GET | self-fetch `${origin}/api/{flights,satellites,cctv,weather,gdelt}` (stats/route.ts:42-46) | snapshot memori + s-maxage=30 |
| `/api/air-quality` | GET | OpenAQ | — |
| `/api/sentinel` | GET | Copernicus Dataspace, Element84 earth-search | s-maxage=300 |
| `/api/arcgis` | GET | arcgis.com (discovery) | SC + s-maxage=60–120 |
| `/api/region-dossier` | GET | Photon, Wikidata, Wikipedia, Commons | SC |
| `/api/proxy-tiles` | GET | CARTO basemaps (allowlist `isCartoTileUrl`) | immutable 1 tahun (:44) |
| `/api/ai/overview` | POST | **tidak ada** — heuristik lokal, jalur Gemini dihapus (ai/overview/route.ts:1-11) | force-dynamic |
| `/api/entity/expand` | GET | layanan `intel` (`INTEL_URL` / `http://osiris-intel:4000` / localhost:4000) (entity/expand/route.ts:16-19) | s-maxage=3600 |

### cctv/* (S; tokens = A)
| Path | Metode | Fungsi / upstream |
|---|---|---|
| `/api/cctv` | GET | indeks kamera agregat ~60 adaptor (`src/app/api/cctv/*.ts`), stealthFetch, SC per region, `createPool` (route.ts:693,732,1123); s-maxage/max-age=60 |
| `/api/cctv/proxy` | GET | proxy gambar/stream dengan `isPublicIp` SSRF guard (proxy/route.ts:6,170) |
| `/api/cctv/hls` | GET | proxy playlist HLS, allowlist `pelindung.bandung.go.id` (hls/route.ts:15) |
| `/api/cctv/resolve` | GET | resolve halaman YouTube/Skyline → embed (`safeFetch`) |
| `/api/cctv/stream-status` | GET | cek status stream (`safeFetch`) |
| `/api/cctv/texas/snapshot` | GET | TxDOT `its.txdot.gov` (runtime nodejs) |
| `/api/cctv/tpt/media` | GET | e-smarteye (TPT) dengan `TPT_CCTV_TOKEN` |
| `/api/cctv/tokens` | GET, POST | A — status/perbarui token CCTV (tokens/route.ts:10-20) |

### geo/*
| Path | Metode | Upstream |
|---|---|---|
| `/api/geo` | GET | geolokasi IP: ipapi.co, freeipapi.com, ip-api.com; `private, no-store` |
| `/api/geo/reverse` | GET | Nominatim (src/lib/nominatim.ts:34), s-maxage 30 hari |
| `/api/geosearch` | GET | Photon komoot, SC + s-maxage=600 |
| `/api/directions` | GET | OSRM `router.project-osrm.org`, Valhalla `valhalla1.openstreetmap.de` |

### health (P)
| Path | Metode | Fungsi |
|---|---|---|
| `/api/health` | GET | status proses + statistik Nominatim |
| `/api/health/ready` | GET | cek DB via `opsDb()`, 200/503 no-store |

**Endpoint yang dirujuk klien tetapi TIDAK ADA**: `/api/balloons` dan `/api/radiation` (src/lib/layer-feeds.ts:144-145,180-181) — tidak ada `route.ts`; toggle layer itu akan mendapat 404. [CONFIRMED kode; efek UI UNVERIFIED]

**Endpoint tanpa pemanggil UI** (grep `src/` non-test): `/api/sentinel`, `/api/air-quality`, `/api/entity/expand`, `/api/ops/situations` (GET), `/api/ops/audit` (halaman membaca DB langsung), `/api/cctv/stream-status`, `/api/health/ready` (probe infra). `/api/cctv/texas/snapshot` & `/api/cctv/tpt/media` dirujuk lewat URL yang dibangun adaptor (tpt.ts:94,121). [CONFIRMED]

---

## 8. Peta halaman → API

| Halaman / komponen | Endpoint |
|---|---|
| `/masuk` login-form.tsx:31 | POST `/api/ops/login` |
| `/daftar` register-form.tsx:46 | POST `/api/ops/register` |
| `/lupa-sandi` forgot-form.tsx:25 | POST `/api/ops/password/forgot` |
| `/atur-sandi` reset-form.tsx:30 | POST `/api/ops/password/reset` |
| `/operator` operator-dashboard.tsx:87,100 | GET `/api/health` tiap 60 s |
| `/operator` situation-save.ts:51 | PATCH `/api/ops/situations/[id]` |
| `/operator` operator-board.tsx:100; portal-menu.tsx:39 | POST `/api/ops/logout` |
| `/pengguna` user-board.tsx:78,111 | POST `/api/ops/users`, PATCH `/api/ops/users/[id]` |
| `/peta` monitoring-dashboard.tsx | `/api/earthquakes` (:521,537), `/api/news` (:529,539,1063), `/api/weather` (:533,541), `/api/stats` (:330), `/api/geo/reverse` (:383), `/api/region-dossier` (:400), `/api/directions` (:878), plus feed layer dari layer-feeds.ts:139-150 |
| OsirisMap.tsx | `/api/aircraft` (:905), `/api/flight-route` (:933), `/api/satellites/orbit` (:1076), tile via `/api/proxy-tiles` atau nginx `/proxy/tiles` (:354, src/lib/tile-proxy.ts:37) |
| FlightWatchPanel.tsx:166-169 | `/api/aircraft`, `/api/flight-route` |
| DirectionsBar.tsx:199,349,459 | `/api/geosearch`, `/api/directions`, `/api/geo` |
| SearchBar.tsx:164 | `/api/geosearch` |
| GlobalStatusBar.tsx:16,29 | `/api/earthquakes` tiap 60 s |
| AiOverview.tsx:161 | POST `/api/ai/overview` |
| ArcGISPanel.tsx:120,148 | `/api/arcgis` |
| camera-feed-view.tsx:56 | `/api/cctv/resolve` |
| CctvTokenButton.tsx:35,58 | GET/POST `/api/cctv/tokens` |
| src/lib/camera-catalog.ts:46 | `/api/cctv` |

---

## 9. Data fetching, polling, caching & state

- **Klien `/peta`**: `fetchEndpoint` (monitoring-dashboard.tsx:489-516) — `fetch(url, {cache:'no-store'})`, 401 → `window.location.assign('/masuk?next=/peta')`, merge hasil ke state `MapData` via `updateData`, set `backendStatus`; opsi `skipWhenHidden` untuk polling latar.
- Polling inti (monitoring-dashboard.tsx:518-546): earthquakes 15 menit, news 5 menit, weather 5 menit (semua `skipWhenHidden`).
- **layer-feeds.ts**: `ONCE_RULES` (139-150) dimuat sekali saat layer aktif; `POLL_RULES` (178-183) untuk flights/balloons/radiation/maritime dengan `LAYER_POLL_MS = 300_000` (121) dan `MARITIME_LIVE_MS = 10_000` (124); timer dimiliki halaman (monitoring-dashboard.tsx:573-607).
- Timer lain: OsirisMap terminator surya 5 menit (OsirisMap.tsx:1474), tick 200 ms (:1800); LiveAlerts jam 30 s (LiveAlerts.tsx:501); operator-dashboard jam 1 s & health 60 s.
- **sourceCache** (src/lib/sourceCache.ts:1-28,51-158): cache in-memory per proses, TTL default 30 menit, dedup inflight, stale-on-error, `forgetSource`/`seedSource`/`peekSource`. Tidak persisten, tidak dibagi antar instance.
- **fetch-pool** (src/lib/fetch-pool.ts:16 `createPool(limit)`): pembatas konkurensi; dipakai `api/cctv/route.ts:732`, `api/cctv/sweden.ts:114,210`.
- **httpJson** (src/lib/httpJson.ts:19-139): `httpJson`/`httpText`/`httpConditional`/`optional`, timeout, UA `OSIRIS-OSINT/1.0`.
- **stealthFetch** (src/lib/stealthFetch.ts:1-5,73-92): header acak + IP "residential" palsu (X-Forwarded-For) untuk menyebar rate-limit upstream; dipakai flights, flight-route, satellites, gdelt, weather, cctv.
- **Rate-limit** auth in-memory (src/lib/ops/rate-limit.ts).
- **localStorage**: `osiris.aoi.shapes.v1` (bentuk AOI, aoi-export.ts:79; monitoring-dashboard.tsx:421-428), `atlas.spaceCams` (space-cams.ts:5,89,120), `osiris:style-studio` (style-tokens.ts:26,429-440).
- **State React**: tidak ada global store (tidak ada zustand/redux/jotai/react-query/SWR, tidak ada `createContext` — grep `src/` kosong). State lokal `useState`/`useRef` di `monitoring-dashboard.tsx` lalu diteruskan sebagai props; satu `useSyncExternalStore` di space-cams.ts:129. [CONFIRMED]
- **Server Component baca DB langsung**: `/peta` (kotamaops), `/operator` (situation + revisi), `/pengguna` (user, kotamaops, authAudit), `/` (sessionAccount). Mutasi lewat route `ops/*` (bukan Server Actions).

---

## 10. Integrasi eksternal

| Sumber | File |
|---|---|
| BMKG gempa | src/lib/bmkg.ts:12-16,86; api/earthquakes |
| NASA FIRMS, NASA EONET | api/fires/route.ts; api/weather/route.ts:146 |
| GDACS | api/gdelt/route.ts; api/weather/route.ts:150 |
| GDELT | api/gdelt-events/route.ts |
| OpenSky (OAuth `OPENSKY_CLIENT_ID/SECRET`) | api/flights/route.ts:418 |
| adsb.fi / adsb.lol / adsbdb / hexdb / airplanes.live | api/flights, api/aircraft, api/flight-route |
| CelesTrak, SatNOGS | api/satellites/route.ts:246 |
| AISStream (`AIS_API_KEY`) | api/maritime/route.ts:122-129 |
| Telegram + RSS berita | api/news/route.ts:173,214; src/lib/telegram.ts:305 |
| YouTube / Rumble | api/live-news, api/cctv/resolve, src/lib/youtube.ts |
| CARTO basemap | public/dark-matter-style.json:9-20; OsirisMap.tsx:332; api/proxy-tiles; nginx/nginx.conf:74-77 |
| Terrain tiles (S3 AWS) | src/lib/terrain-tiles.ts |
| Nominatim / Photon | src/lib/nominatim.ts:34; api/geosearch; api/region-dossier |
| OSRM / Valhalla | api/directions/route.ts |
| Wikipedia / Wikidata / Commons | api/region-dossier/route.ts |
| IP geolocation (ipapi.co, freeipapi, ip-api) | api/geo/route.ts |
| OpenAQ, Copernicus/Element84, ArcGIS | api/air-quality, api/sentinel, api/arcgis |
| Portal CCTV (TfL, WSDOT, Caltrans, 511, TxDOT, e-smarteye/TPT, Jasamarga `JASAMARGA_WFS_TOKEN`, Bandung, dll.) | src/app/api/cctv/*.ts |
| Layanan intel (OpenSanctions, Wikidata SPARQL) | intel/server.js; api/entity/expand |
| Umami analytics (`UMAMI_WEBSITE_ID`) | src/lib/umami-analytics.ts; proxy.ts:27 |
| SMTP (`SMTP_*`, `OPS_PUBLIC_URL`) | src/lib/ops/mail.ts |
| Google Fonts | globals.css:1; document-shell.tsx:15-16 |

Nama variabel lingkungan yang dibaca kode (nama saja): `DATABASE_URL`, `OPS_SESSION_SECRET`, `OPS_ADMIN_USERNAME`, `OPS_ADMIN_PASSWORD`, `OPS_PUBLIC_URL`, `SMTP_HOST/PORT/USER/PASSWORD/FROM`, `TILE_PROXY_PATH`, `AIS_API_KEY`, `OPENSKY_CLIENT_ID/SECRET`, `TPT_CCTV_TOKEN`, `JASAMARGA_WFS_TOKEN`, `INTEL_URL`, `UMAMI_WEBSITE_ID`, `OSIRIS_NOMINATIM_CACHE`, `OSIRIS_NOMINATIM_GAP_MS`, `OSIRIS_CCTV_SNAPSHOT`, `VERCEL`, `NODE_ENV`. Ketersediaan nilainya **[UNVERIFIED]** (.env tidak dibuka).

---

## 11. Komponen & utilitas bersama (ringkas)

- **Shell**: `DocumentShell` (html/body, ErrorBoundary), `AuthFrame` (kerangka halaman auth, server), `OpsShell` (kerangka `/pengguna`, server), `PortalMenu` (menu peran + logout, client), `PasswordField`, `ZoneClocks`, `MotionPreference`, `AuthPointer` (src/components/ops/*).
- **Peta**: `OsirisMap` (MapLibre, layer, terrain, draw), `LayerPanel`, `MapControls`, `ScaleBar`, `ViewPresets`, `DrawingToolbar`/`DrawHud`, `SearchBar`, `DirectionsBar`/`NavigationView`, `SharePanel`, `KeyboardShortcuts`, `dashboard-chrome` (WibClock, ViewSegment, useIsMobile).
- **Panel data**: `LiveAlerts`, `IntelFeed`, `AiOverview`, `GlobalStatusBar`, `FlightWatchPanel`, `SatelliteCard`, `ArcGISPanel`.
- **Video/CCTV**: `CameraViewer`, `camera-feed-view`, `CctvPreviews`, `LiveNewsPreviews`, `SpaceCam`, `CctvTokenButton`.
- **lib**: palet & token (`map-palette.ts`, `style-tokens.ts`, `basemap-tone.ts`), transform data (`news-transform.ts`, `map-data.ts`, `alert-digest.ts`), geo (`geo.ts`, `aoi.ts`, `draw.ts`, `nkri-view.ts`), keamanan (`ssrf-guard.ts`, `client-ip.ts`).
Detail komponen dibahas dokumen terpisah.

---

## 12. Diagram

### Arsitektur AS-IS

```mermaid
flowchart LR
  B[Browser<br/>React 19 client] -->|HTTPS 8443 / HTTP 8080 (Docker)<br/>atau :3000 dev| NG[nginx<br/>/proxy/tiles cache]
  B -->|dev lokal WSL| NX
  NG -->|proxy_pass osiris:3000| NX[Next.js 16 server]
  NG -->|cache tile| CARTO[(CARTO basemaps)]
  subgraph NX[Next.js 16]
    PX[src/proxy.ts<br/>CSRF · sesi · admin · Umami] --> PG[Server pages<br/>/ /masuk /operator /pengguna /peta]
    PX --> API[Route handlers /api/*]
    PG --> LIBOPS[lib/ops<br/>currentUser · access]
    API --> LIBOPS
    API --> SC[sourceCache<br/>in-memory TTL]
    API --> RL[rate-limit<br/>in-memory]
  end
  LIBOPS --> DB[(PostgreSQL<br/>18 lokal :5433 / 16 Docker)]
  PX --> DB
  SC --> EXT[(Upstream publik<br/>BMKG · FIRMS · GDACS · OpenSky · adsb.* · AIS · RSS/Telegram · CCTV · Nominatim/Photon · OSRM/Valhalla · Wikidata)]
  API -->|stealthFetch / httpJson| EXT
  API -->|/api/entity/expand| INTEL[osiris-intel :4000]
  API -->|SMTP| MAIL[(Mail server)]
  PX -->|trackPageView| UMAMI[(Umami)]
```

### Login & RBAC

```mermaid
sequenceDiagram
  participant U as Browser (/masuk)
  participant P as proxy.ts
  participant L as /api/ops/login
  participant DB as PostgreSQL
  participant PG as Server page (/peta, /operator, /pengguna)
  U->>P: POST /api/ops/login
  P->>P: crossSiteWrite? (403) · isPublicApi → lanjut
  P->>L: teruskan
  L->>L: rateLimit ip / ip+user / user (429)
  L->>DB: user.findUnique(username)
  L->>L: verifyPassword (dummy hash bila tak dikenal) → 401
  L->>L: active && ACTIVE? → 403
  L->>DB: update lastLoginAt; writeAudit(login_success)
  L-->>U: {ok, role, home, allowed} + Set-Cookie osiris_ops (HMAC, ver=sessionVersion, 8j / 14h)
  U->>P: GET next (acceptedNext) atau home
  P->>DB: sessionAccount: readSession + user live + sessionMatchesUser
  alt tanpa sesi
    P-->>U: 302 /masuk?next=…
  else deniedPage(/pengguna, non-admin)
    P-->>U: 302 homeForRole
  else diizinkan
    P->>PG: render
    PG->>DB: currentUser() + query ber-scope situationWhere
    PG-->>U: HTML + props (role, canWrite, canManage)
  end
```

---

## 13. Batasan yang relevan untuk pekerjaan UI

1. **File raksasa**: `src/components/OsirisMap.tsx` 2675 baris; `src/app/(en)/peta/monitoring-dashboard.tsx` 1466 baris; `LiveAlerts.tsx` 1028; `DirectionsBar.tsx` 940; `api/cctv/route.ts` 1199; `globals.css` 2746. State peta terpusat di satu komponen klien dan dioper lewat props. [CONFIRMED `wc -l`]
2. **Bahasa campuran**: `/peta` berada di grup `(en)` dengan `lang="en"` namun bagian sistem lain berbahasa Indonesia (pesan error API, label portal, "WIB"); komentar/identifier campur Inggris–Indonesia; merek campur OSIRIS (paket, cookie `osiris_ops`, localStorage `osiris.*`, UA) dan ATLAS (judul). [CONFIRMED]
3. **Design token ada tetapi bercabang**: token CSS di `:root` globals.css (mis. `--bg-void`, `--gold-rgb`, 96 baris deklarasi `--*`), tema `body.theme-*` (globals.css:107), dipetakan ke Tailwind via `@theme inline` (globals.css:153-158) dan di-mirror di `DEFAULTS` `src/lib/style-tokens.ts` (komentar globals.css:15-16). Namun halaman ops memakai nilai hardcode Tailwind (mis. `bg-[#0d0d12]`, `text-white/50` di pengguna/page.tsx:70-71). [CONFIRMED]
4. **Root layout ganda** → pindah `(id)`↔`(en)` (mis. `/operator` → `/peta`) = full reload. [perilaku UNVERIFIED]
5. **Tidak ada `loading.tsx` / `error.tsx` / `not-found.tsx`**; error ditangkap `ErrorBoundary` klien di DocumentShell. [CONFIRMED]
6. **Endpoint hilang** `/api/balloons`, `/api/radiation` (layer-feeds.ts:144-145). [CONFIRMED]
7. **`/api/stats` self-fetch tanpa cookie**: `computeStats` memanggil `${origin}/api/flights|satellites|cctv|weather|gdelt` tanpa meneruskan cookie sesi (stats/route.ts:42-46), sementara proxy mewajibkan sesi untuk semua `/api/*` non-publik (proxy.ts:19-20). Kemungkinan semua sub-request mendapat 401 sehingga statistik kosong/parsial. **[UNVERIFIED — perlu runtime]**
8. **Cache & rate-limit in-memory** (sourceCache, rate-limit, snapshot stats/maritime) hilang saat restart dan tidak dibagi bila multi-instance. [CONFIRMED]
9. **CSP longgar** `default-src … https: wss: data: blob:` + `'unsafe-inline'` (next.config.ts:75-76) — membatasi opsi bila UI menambah sumber baru, tapi ketat pada `script-src`. `next/image` tidak dioptimasi (next.config.ts:51-54).
10. **Folder mati**: `engine/` (hanya .pyc), `.omc/` di dalam `src/app/(id)/operator` & `pengguna`.

### UNVERIFIED (ringkas)
- Isi DB (jumlah Kotamaops/user/situasi), nilai env, ketersediaan kunci upstream (AIS, OpenSky, TPT, Jasamarga, SMTP).
- Tampilan & perilaku runtime halaman setelah login (tiap peran), keberhasilan feed eksternal, efek `/api/stats` (poin 7) dan 404 layer balloons/radiation di UI.
