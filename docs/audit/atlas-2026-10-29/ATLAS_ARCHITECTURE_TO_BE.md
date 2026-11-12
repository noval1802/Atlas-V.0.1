# ATLAS — Arsitektur TO-BE (realistis, tanpa overengineering)

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).

**Prinsip:**
- Tetap **modular monolith Next.js + PostgreSQL**.
- Tambah **satu proses worker** di codebase yang sama, bukan microservices, dan tanpa Kubernetes.
- Komponen baru hanya ditambahkan bila ada alasan kapasitas atau operasional yang jelas.

## 1. Diagram TO-BE

```
                         ┌──────────────────────────────────────────────┐
 Sumber luar ───────────►│ atlas-worker (Node, codebase & image sama)   │
 (BMKG, OpenSky, adsb.fi,│  adapter per sumber: fetch → validasi →      │
  aisstream, FIRMS, …)   │  normalisasi → tulis state + status sumber   │
 Penerima ADS-B sendiri ►│  aturan alert (rules, dedup, cooldown)       │
 (readsb, opsional)      │  heartbeat kamera                            │
                         └──────────┬───────────────────────────────────┘
                                    │ INSERT/UPSERT + NOTIFY
                         ┌──────────▼───────────────────────────────────┐
                         │ PostgreSQL (+ PostGIS bila AOI disimpan)     │
                         │  state terbaru │ histori (retensi N hari)    │
                         │  source_status │ alert │ incident │ audit    │
                         └──────────┬───────────────────────────────────┘
                                    │ LISTEN
 ┌───────────────┐       ┌──────────▼───────────────────────────────────┐
 │ MediaMTX /    │◄─RTSP─│ Next.js (web)                                │
 │ go2rtc        │ kamera│  UI, auth + MFA, RBAC                        │
 │ (WHEP/WebRTC, │ milik │  API baca dari DB (tanpa fetch ke luar)      │
 │  HLS, rekaman)│ sendiri│ SSE /api/stream → alert, status, posisi     │
 └──────┬────────┘       └──────────┬───────────────────────────────────┘
        │ WebRTC langsung           │ HTTPS + SSE
        └───────────►  Browser  ◄───┘   (video tidak lewat Node)

 nginx: TLS, header keamanan, limit_req, cache tile ber-sesi
 Self-host (untuk jaringan tertutup): tile vektor PMTiles Indonesia, font lokal, Nominatim/OSRM
 Observability: log JSON terstruktur + endpoint /api/health/sources + alert kegagalan layanan
 Backup: pg_dump terenkripsi → salinan di luar host, latihan restore terjadwal
 CI: lint + typecheck + test + build pada setiap push
```

## 1a. Status pencapaian (12 Nov 2026)

Tanda: ✅ Selesai · 🟡 Sebagian · ⏳ Belum · ➖ Tidak berlaku.

| Komponen TO-BE | Status | Catatan |
|---|---|---|
| `atlas-worker` + adapter per sumber | ⏳ | Feed masih diambil di dalam request web. |
| PostgreSQL untuk state, histori, `LISTEN/NOTIFY` | ⏳ | Hanya data ops/auth dan (baru) sesi TPT yang disimpan; feed belum punya histori. |
| Tabel `source_status` / `/api/health/sources` | ⏳ | Belum ada. |
| Aturan alert, tabel alert dan insiden | ⏳ | Belum ada. |
| SSE `/api/stream` | ⏳ | Masih polling. |
| Auth + MFA | 🟡 | Kebijakan sandi dan rotasi SUPER_ADMIN selesai (`547f807`, `17cd4f2`); MFA belum. |
| MediaMTX/go2rtc, WebRTC, rekaman | ⏳ | Belum ada; video masih lewat proxy Node. |
| Penerima ADS-B sendiri | ➖ | Pelacakan pesawat dihapus (`dc942ec`); rencana pemilik memakai API Flightradar24 berbayar. |
| nginx limit_req, cache tile ber-sesi | ⏳ | Belum ada `limit_req`; konfigurasi nginx tidak berubah sejak audit. |
| Self-host tile, font, geocoder | ⏳ | Masih memakai layanan luar. Chat AI (`355a0e0`) menambah satu tujuan data keluar. |
| Observability (log JSON, alert kegagalan) | ⏳ | Belum. |
| Backup terenkripsi di luar host | ⏳ | Belum. |
| CI lint + typecheck + test + build | ⏳ | Hanya workflow publish manual. |

## 2. Alasan setiap perubahan

| Perubahan | Mengapa | Kenapa bukan yang lebih berat |
|---|---|---|
| Satu proses `atlas-worker` | Pengambilan feed keluar dari request web. Data tetap mengalir walau tidak ada pengguna yang membuka peta. Satu tempat untuk retry, status, dan aturan alert. | Image dan kode sama, cukup entrypoint berbeda. Tidak perlu repo baru. |
| PostgreSQL untuk state, histori, dan antrean ringan | Bertahan setelah restart, dipakai bersama semua pengguna, bisa diaudit. `LISTEN/NOTIFY` cukup sebagai event bus untuk skala satu lokasi. | Kafka/Redis Streams baru masuk akal bila beban event jauh melampaui kemampuan Postgres — belum ada bukti ke arah itu. |
| Tabel `source_status` | Operator melihat sumber mana yang mati atau basi. Ini kebutuhan inti pusat komando. | — |
| SSE untuk push ke browser | Satu arah sudah cukup (server → operator). Lebih sederhana dari WebSocket dan lolos nginx. | WebSocket baru diperlukan bila ada kolaborasi dua arah real-time. |
| MediaMTX/go2rtc untuk kamera sendiri | WebRTC (WHEP) untuk 17+ kamera, video tidak lewat Node, rekaman dan snapshot di satu tempat. | Satu binary. Media server terkelola atau klaster belum diperlukan. |
| Analitik video (bila disetujui) sebagai worker terpisah yang membaca RTSP/snapshot dari media server | Beban berat dipisah dari web dan browser. | Ditunda sampai ada kebutuhan dan kapasitas GPU yang jelas. |
| Self-host tile, font, dan geocoder | Berjalan di jaringan tertutup, dan area yang dicari operator tidak bocor ke pihak ketiga. | — |

## 3. Yang sengaja tidak direkomendasikan

- Microservices per feed.
- Kubernetes.
- Message broker terpisah.
- Pemecahan frontend/backend menjadi dua repo.

Semuanya baru relevan bila ada lebih dari satu lokasi atau beban yang terukur melebihi satu server. Saat ini tidak ada benchmark yang menunjukkan kebutuhan itu.
