# ATLAS — Arsitektur AS-IS

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).

> **Snapshot 29 Oktober 2026** (commit `b3c6477`). Isi di bawah sengaja tidak diubah. **Perubahan sesudahnya:**
> - **Pesawat dan satelit dihapus** (`dc942ec`): `/api/flights`, `/api/aircraft`, `/api/flight-route`, `/api/satellites`, panel dan layer terkait. OpenSky/adsb.fi di alur data dan diagram, serta poin "pesawat dikirim utuh ~10 ribu", tidak berlaku lagi. Mode citra satelit peta dasar tetap ada.
> - **CCTV Indonesia:** 15 sumber kota/provinsi baru (`c0838be`), sehingga ada ±23 sumber Indonesia (BPJT, Bandung, Gresik, Aceh, Semarang, Surakarta sudah masuk sebelum snapshot lewat `48b7671`, `ec2fa04`). Panel dipecah menjadi GLOBAL/TOL/KOTA/JAKARTA, region luar negeri yang mati dibuang, dan server memeriksa kesehatan stream (`cf2ab8e`). Proxy HLS dan media TPT kini lewat `safeFetch` (`c0838be`, `355a0e0`).
> - **Gempa dan cuaca BMKG** (`92cfc10`) sudah berlaku saat snapshot. Sesudahnya gempa menampilkan waktu WIB dan memudar sesuai usia (`d1b3b69`).
> - **Baru (`355a0e0`):** layer gunung api MAGMA/PVMBG (`/api/volcanoes`); chat AI operator (`/api/ai/chat`) yang memanggil LLM eksternal, sehingga ada satu tujuan data keluar baru; vault sesi TPT Jakarta terenkripsi di DB (model `TptSession`, migrasi keempat).
> - **Auth dan pengguna:** kebijakan sandi minimum 12 dan bootstrap admin sekali jalan (`547f807`), rotasi SUPER_ADMIN dengan konfirmasi dan pemulihan lokal (`17cd4f2`), UI Pengguna V2 (`414ba45`), pemeriksaan isi artefak build (`2135def`).
> - **Angka yang bergeser:** `OsirisMap.tsx` kini ±2.290 baris, `monitoring-dashboard.tsx` ±1.340 baris, 43 route handler, 4 migrasi Prisma.
> - **`356bd31` (12 Nov):** teardown player video saat ditutup, dan penyesuaian rate limit login.
> - **Tidak berubah:** satu proses tanpa worker, polling tanpa push, `timestamp` = waktu respons, indikator "ONLINE" statis, CI hanya publish manual, backup belum terenkripsi.

**Tanggal:** 29 Oktober 2026 · **Metode:** baca kode (read-only), unit test, typecheck. Tidak ada deploy, load test, atau pengujian layanan luar.

## 1. Stack

| Komponen | Versi / isi | Bukti |
|---|---|---|
| Aplikasi web | Next.js ^16.4.3 (Turbopack), React 19.2.4 | `package.json` |
| Runtime | Node 22 (dev: `~/.local/node22`; Docker: `node:22-alpine`) | `start-local.sh:7`, `Dockerfile:1` |
| Database | PostgreSQL (dev 18, Docker 16) lewat Prisma ^6.19.2 | `start-local.sh:2-5`, `docker-compose.yml:103` |
| Peta | MapLibre GL 6.7, react-map-gl | `package.json` |
| Video | hls.js, mpegts.js (tanpa WebRTC) | `src/components/camera-feed-view.tsx` |
| Layanan tambahan | `intel/` — Express 5, indeks sanksi OFAC + lookup Wikidata/ip-api/RIPE | `intel/server.js` |
| Reverse proxy | nginx (TLS 1.2/1.3, cache tile CARTO) | `nginx/nginx.conf` |
| Sisa tak terpakai | `engine/` — hanya `__pycache__/*.pyc`, tanpa sumber, tidak dirujuk | `engine/` |

## 2. Pola arsitektur

**Hybrid modular monolith.** Satu proses Next.js menangani UI, API, pengambilan data feed, dan autentikasi. `osiris-intel` adalah satu-satunya layanan terpisah.

Untuk satu lokasi dengan puluhan sampai ratusan pengguna, ukuran ini **tepat**. Microservices atau Kubernetes tidak diperlukan. Kelemahannya bukan pada pola monolith, melainkan:
- Pengambilan data feed berjalan di dalam siklus request web. Tidak ada worker latar belakang.
- Semua state feed (cache, kapal AIS, rate limit) tersimpan di memori satu proses.
- Berkas sangat besar: `OsirisMap.tsx` 2.675 baris, `monitoring-dashboard.tsx` 1.466 baris.

## 3. Struktur folder

- `src/app/(id)/` — halaman operasional berbahasa Indonesia: `masuk`, `daftar`, `operator`, `pengguna`, `lupa-sandi`, `atur-sandi`.
- `src/app/(en)/peta/` — peta pemantauan (antarmuka berbahasa Inggris, `lang="en"`).
- `src/app/api/` — 49 route handler: feed langsung, proxy CCTV, `ops/*` (auth, situasi, pengguna, audit), health.
- `src/lib/`, `src/lib/ops/` — logika dan helper; tes diletakkan di samping kodenya.
- `src/proxy.ts` — gerbang sesi (pengganti middleware di Next 16).
- `prisma/` — skema, 3 migrasi, seed.
- `ops/backup`, `ops/tls` — skrip backup/restore dan sertifikat self-signed.

## 4. Data yang disimpan permanen

Model Prisma: `User`, `Kotamaops`, `Situation` (satu baris per Kotamaops), `SituationRevision`, `PasswordReset`, `AuthAudit`.

**Hanya data operasional dan autentikasi yang disimpan.** Data feed langsung (pesawat, kapal, gempa, kebakaran, berita, CCTV) tidak pernah masuk database. Akibatnya tidak ada histori, replay, maupun bahan evaluasi pasca-kejadian.

## 5. Alur data feed (aktual)

```
Sumber luar (BMKG, FIRMS, EONET, GDACS, OpenSky, adsb.fi, aisstream WS, Telegram, RSS, portal CCTV)
   │  fetch / stealthFetch / httpJson  (timeout 8–30 dtk per panggilan, retry hampir tidak ada)
   ▼
Parse + normalisasi per route (bmkg.ts, news-transform.ts, parseCSV, …)
   │
   ▼
Cache di memori: sourceCache (TTL, dedup request, stale-on-error)
                 | Map globalThis (AIS) | tanpa cache (fires)
   │
   ▼
/api/<layer> → JSON   (timestamp = waktu respons, BUKAN waktu data diambil)
   │
   ▼
Browser: setInterval polling → React state → MapLibre (GeoJSON, GPU)
   gempa 15 mnt · layer lain 5 mnt · kapal 10 dtk · tidak ada push (WebSocket/SSE)
```

| Pertanyaan audit | Jawaban | Bukti |
|---|---|---|
| Adapter/interface per sumber yang jelas? | Sebagian. Per route ada modul parse, tapi tidak ada kontrak adapter bersama. | `src/app/api/*/route.ts`, `src/lib/cctv/*` |
| Frontend dan backend terpisah? | Ya secara logis (route API vs komponen), satu proses. | `src/app/api` |
| Video analytics terpisah dari request web? | Tidak relevan — video analytics tidak ada. | — |
| Event bus / async? | **Tidak ada.** Tidak ada queue, cron, worker, maupun event bus. | grep repo |
| Pengiriman real-time efisien? | Tidak. Hanya polling. Pesawat dikirim utuh (sampai ~10 ribu), lalu browser hanya menggambar 1 dari 10 pesawat komersial. | `OsirisMap.tsx:1503` |
| Backpressure / retry / timeout / circuit breaker | Timeout: ya. Retry: minim. Breaker: hanya cooldown 429 OpenSky dan stale 60 dtk. | `sourceCache.ts:87-93`, `flights/route.ts` |
| Deduplikasi event | Tidak ada. | grep |
| Timestamp / source ID / freshness | Sebagian. Gempa BMKG, berita, dan kapal membawa waktu sendiri. Respons API memakai waktu respons, sehingga data basi tampak terkini. | `earthquakes/route.ts:30` |
| Sumber offline terdeteksi? | **Tidak.** `/api/health` sengaja tidak memeriksa feed. Indikator "ONLINE" di layar hijau statis. | `health/route.ts:20-24`, `GlobalStatusBar.tsx:73` |
| Kegagalan satu integrasi mengganggu yang lain? | Terisolasi lewat try/catch dan `allSettled`, tapi berbagi satu event loop Node. | `weather/route.ts:147` |
| Histori vs state terbaru dipisah? | Hanya untuk situasi (`Situation` + `SituationRevision`). Feed tidak punya histori. | `schema.prisma` |
| Recovery setelah restart | Data operasional di DB aman. Semua cache, jejak AIS, dan rate limit hilang. Snapshot katalog CCTV di disk bertahan. | `cctv-snapshot.ts:31` |

## 6. Diagram AS-IS

```
 Browser (MapLibre, polling 10 dtk – 15 mnt)
        │ HTTPS :8443
 ┌──────▼───────────────┐   tile → CARTO (cache disk 365 hari, tanpa sesi)
 │ nginx                │────────────────────────────────────► Internet
 └──────┬───────────────┘
        │ http :3000 (loopback)
 ┌──────▼──────────────────────────────────────────────────┐
 │ Next.js 16 — satu proses                                │
 │  UI │ proxy.ts (gerbang sesi)                           │
 │  /api/ops/*  auth, RBAC, situasi, pengguna, audit       │
 │  /api/<feed> → sourceCache (memori) / tanpa cache       │──► BMKG, FIRMS, EONET, GDACS,
 │  klien WS AIS (Map globalThis, mulai saat request pertama)──► OpenSky, adsb.fi, Telegram,
 │  proxy video CCTV (segmen HLS dialirkan lewat Node)     │──► portal CCTV, aisstream
 │  .cache/*.json (katalog CCTV, Nominatim)                │    (via stealthFetch: IP dipalsukan)
 └──────┬──────────────────────┬───────────────────────────┘
        │ Prisma               │ http :4000 /resolve
 ┌──────▼─────────┐     ┌──────▼──────────────┐
 │ PostgreSQL     │     │ osiris-intel        │──► OpenSanctions, Wikidata, ip-api, RIPE
 │ (ops + auth)   │     │ memori, tanpa auth  │
 └──────┬─────────┘     └─────────────────────┘
 ┌──────▼─────────┐
 │ osiris-backup  │ pg_dump harian → ./backups (host yang sama, tidak terenkripsi)
 └────────────────┘
 osiris-migrate: `prisma migrate deploy` + seed sekali sebelum aplikasi jalan
 CI: hanya publish image Docker manual — tanpa test/lint
```
