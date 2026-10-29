# ATLAS — Arsitektur AS-IS

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
