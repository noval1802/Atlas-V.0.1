# ATLAS — Roadmap Perbaikan Berprioritas

**Tanda status:**
- **[K]** terkonfirmasi di kode.
- **[V]** terkonfirmasi dan sudah diverifikasi ulang langsung oleh auditor utama.
- **[H]** hipotesis, perlu diuji.

Belum ada perbaikan yang dikerjakan. Roadmap ini menunggu persetujuan pemilik proyek.

---

## P0 — CRITICAL

### P0-01 Kesehatan sistem dan kesegaran data tidak jujur [V]
- **Evidence:**
  - Indikator "ONLINE" berwarna hijau statis (`src/components/GlobalStatusBar.tsx:73`).
  - `/api/health` sengaja tidak mengecek feed (`src/app/api/health/route.ts:20-24`).
  - Respons feed memakai `timestamp: new Date()`, waktu respons, bukan waktu data (`earthquakes/route.ts:30`, `fires:88`, `weather:133`).
  - Saat sumber gagal, `sourceCache` menyajikan data lama tanpa tanda basi (`sourceCache.ts:87-93`).
  - Penanda `+stale` pada feed pesawat tidak ditampilkan di layar (`flights/route.ts:562`).
- **Dampak:** Operator melihat "ONLINE" dan data yang tampak terkini padahal sumbernya mati. Bagi pusat komando ini masalah integritas informasi, bukan kosmetik.
- **Root cause:** Tidak ada konsep status sumber dan usia data dari ujung ke ujung.
- **Solusi:**
  1. Setiap feed mengembalikan `fetchedAt`, `source`, dan `stale`.
  2. Tambah endpoint `/api/health/sources` berisi status per sumber.
  3. Indikator status diikat ke status nyata.
  4. Tampilkan badge usia per layer di LayerPanel dan banner saat data basi.
- **Modul:** dashboard, semua route feed, GlobalStatusBar, LayerPanel.
- **Dependensi:** tidak ada.
- **Acceptance:** Ketika sebuah sumber dimatikan (mock di tes), indikator berubah dari hijau, layer menampilkan "basi sejak HH:MM", dan `/api/health/sources` melaporkan `down`.
- **Verifikasi:** Unit test `sourceCache` (stale ditandai) dan tes komponen indikator. Uji manual dengan memblokir satu host sumber.

### P0-02 Kredensial SUPER_ADMIN dan DB lemah [K]
- **Evidence:**
  - Pola nilai `OPS_ADMIN_PASSWORD` dan `OSIRIS_POSTGRES_PASSWORD` di `.env` (nilai tidak dicetak).
  - Minimum panjang kata sandi 10 (`lib/ops/access.ts:154`).
- **Dampak:** Akun dengan hak tertinggi bisa ditebak.
- **Solusi:**
  1. Ganti kedua nilai dengan nilai acak (`openssl rand -base64 24`).
  2. Naikkan minimum panjang kata sandi ke 12.
  3. Tolak kata sandi umum dan yang mengandung nama aplikasi atau username.
- **Modul:** auth, deployment.
- **Dependensi:** tidak ada.
- **Acceptance:** Login dengan nilai lama gagal. Validator menolak kata sandi yang mengandung nama aplikasi, nama peran, atau username.
- **Verifikasi:** Unit test validator kata sandi; login manual.

### P0-03 Edit situasi saling menimpa diam-diam, papan tidak menyegarkan sendiri [K]
- **Evidence:**
  - PATCH tanpa cek versi (`src/app/api/ops/situations/[id]/route.ts:19-28`).
  - Kunci hanya ada di sisi klien (`situation-save.ts:31,48`).
  - `/operator` adalah render server sekali jalan, dan `/api/ops/situations` tidak pernah dipanggil ulang (`(id)/operator/page.tsx:13`).
- **Dampak:** Dua operator mengubah status Kotamaops yang sama, dan yang terakhir menang tanpa peringatan. Operator lain tetap melihat status lama sampai memuat ulang halaman.
- **Solusi:**
  1. Kirim `updatedAt` (atau versi) dan kembalikan 409 bila tidak cocok.
  2. Di UI, tampilkan "data berubah oleh X, muat ulang".
  3. Papan polling `/api/ops/situations` tiap 30–60 detik (atau SSE kelak).
- **Modul:** operator, API situasi.
- **Acceptance:** Dua PATCH dengan `updatedAt` yang sama menghasilkan sukses untuk yang pertama dan 409 untuk yang kedua. Papan di tab lain berubah dalam ≤60 detik.
- **Verifikasi:** Tes integrasi dengan Postgres nyata (bukan mock).

---

## P1 — HIGH

| ID | Masalah | Evidence | Solusi | Acceptance / verifikasi |
|---|---|---|---|---|
| P1-01 | Tidak ada MFA [K] | `schema.prisma`, `login/route.ts` | TOTP wajib untuk ADMIN, SUPER_ADMIN, dan operator, plus recovery code | Login hanya dengan kata sandi → `mfa_required` tanpa cookie (tes API) |
| P1-02 | Tidak ada alert engine: aturan, ack, eskalasi, persistensi [K] | `live-alerts.ts:208`, `watch.ts:119` | Tabel `Alert` (sumber, severity, `ackBy`, `ackAt`), aturan dengan dedup dan cooldown di server, eskalasi waktu | Alert yang di-ack satu operator terlihat ter-ack di operator lain; bertahan setelah reload |
| P1-03 | Tidak ada manajemen insiden [K] | `schema.prisma:90-120` (`incidentCount` diketik manual) | Model `Incident` + `IncidentEvent` (status, penanggung jawab, timeline, penutupan); transisi status ditegakkan di server; verifikasi manusia untuk SIAGA | Alur buat → tugaskan → selesaikan tercatat di timeline dan audit |
| P1-04 | Latensi data inti [V] | Gempa 15 menit dan tidak diambil saat tab tersembunyi (`monitoring-dashboard.tsx:537`); layer lain 5 menit (`layer-feeds.ts:122`) | Gempa dan peringatan ≤60 detik; pesawat yang dipantau 15–30 detik; kelak SSE dari worker | Gempa baru di BMKG tampil ≤2 menit |
| P1-05 | `stealthFetch` memalsukan IP dan merotasi UA [V] | `stealthFetch.ts:8,59,78-79`, 27 berkas | Hapus header palsu; UA jujur; API key dan cache | `grep X-Forwarded-For src/lib/stealthFetch.ts` kosong; feed tetap berjalan |
| P1-06 | Player video bocor saat ditutup [V] | `camera-feed-view.tsx:69-130`: tidak ada `destroy()` saat unmount; cleanup FLV tidak menghancurkan player | Cleanup effect memanggil `hls.destroy()` dan `flv.destroy()` | Membuka dan menutup 20 kamera tidak menyisakan request segmen di tab Network |
| P1-07 | Tidak ada CI gate [V] | `.github/workflows/docker-publish.yml` (publish manual saja) | Workflow lint, typecheck, test, dan build pada setiap push dan PR | PR yang merusak tes otomatis merah |
| P1-08 | Tidak ada observability [K] | ~97 `console.*`; tidak ada metrik atau alert | Log JSON terstruktur, `/api/health/sources`, alert ke admin saat layanan atau backup gagal | Mematikan Postgres memicu notifikasi ≤5 menit |
| P1-09 | Deploy Docker belum pernah diverifikasi penuh [K] | `AUDIT_MONITORING_SITUASI_NASIONAL.md:309` | Uji `docker compose up` bersih di server target dan catat hasilnya | Runbook berisi log uji yang berhasil |
| P1-10 | WebRTC dan kamera milik sendiri belum ada (prasyarat 17+ kamera) [V] | grep `RTCPeerConnection` kosong | MediaMTX/go2rtc (RTSP→WHEP) dan komponen pemutar WHEP; batas grid 16; jeda saat tersembunyi | 17 stream uji berjalan 24 jam tanpa kenaikan memori >X% (ukur) |
| P1-11 | Proses tunggal dengan state di memori [K] | `rate-limit.ts:3`, `maritime/route.ts:108`, `sourceCache.ts:24` | Dokumentasikan wajib satu instance; pindahkan rate limit ke DB | Dokumen deploy menyatakan batas ini |

---

## P2 — MEDIUM

| ID | Masalah | Evidence | Solusi |
|---|---|---|---|
| P2-01 | CSP longgar (`unsafe-inline`, `https:`) [K] | `next.config.ts:75-76` | Nonce CSP, `connect-src` allowlist |
| P2-02 | Lockout akun lewat rate limit [K] | `login/route.ts:27-31` | Penundaan progresif atau CAPTCHA |
| P2-03 | Ketergantungan internet: Google Fonts, tile CARTO, Nominatim, OSRM, resolver DNS publik nginx [K] | `globals.css:1`, `proxy-tiles/route.ts`, `nginx.conf:38` | Self-host font, PMTiles Indonesia, geocoder |
| P2-04 | Backup tidak terenkripsi, di host sama, kegagalan tidak memberi tahu siapa pun [K] | `ops/backup/backup.sh:19,24,37` | Enkripsi, salinan luar host, notifikasi gagal, latihan restore bulanan |
| P2-05 | Proxy HLS/TPT mengikuti redirect tanpa cek ulang [K] | `cctv/hls/route.ts`, `tpt/media/route.ts:39-40` | `safeFetch` / `redirect:'manual'` |
| P2-06 | Video dialirkan lewat proses Node [K] | `cctv/hls/route.ts:45-47` | Media server atau `proxy_cache` nginx untuk segmen |
| P2-07 | Tidak ada reconnect otomatis untuk stream [K] | `camera-feed-view.tsx:101-103` | Backoff + `recoverMediaError` |
| P2-08 | Pesawat komersial hanya 1 dari 10 yang digambar, tanpa keterangan [V] | `OsirisMap.tsx:1503` | Filter bbox Indonesia di server; tampilkan "X dari Y" |
| P2-09 | Cakupan Indonesia lemah: fallback ADS-B tanpa wilayah Indonesia; AIS tanpa kotak Indonesia [K] | `flights/route.ts:83-120`, `maritime/route.ts:140-160` | Tambah titik dan kotak cakupan Indonesia dan ALKI |
| P2-10 | Error boundary hanya membungkus peta; tidak ada `error.tsx` [K] | `monitoring-dashboard.tsx:815` | Error boundary per panel dan `app/error.tsx` |
| P2-11 | Teks terlalu kecil untuk video wall (155 deklarasi 9px) [K] | `GlobalStatusBar.tsx:73` dkk | Mode "wall" dengan teks minimum 12–14px dan kontras ≥4,5:1 |
| P2-12 | Bahasa campur: `/peta` berbahasa Inggris, ops berbahasa Indonesia [K] | `(en)/layout.tsx:10` | Satukan ke Bahasa Indonesia |
| P2-13 | Lapsit karhutla statis tertanam di kode (berlabel tanggal, 8px) [V] | `karhutla-lapsit.ts:1-3`, `OsirisMap.tsx:1284` | Simpan di DB dengan usia data yang jelas, atau hapus |
| P2-14 | Data operator bocor ke pihak ketiga (pencarian, koordinat, rute, entitas) [K] | lihat Security Review S-07 | Self-host atau daftar putih data keluar |
| P2-15 | Kode mati: `engine/` (hanya .pyc), route `/api/balloons` dan `/api/radiation` yang tidak ada [K] | `engine/`, `layer-feeds.ts:144-145` | Hapus |
| P2-16 | Tes kritis belum ada: PATCH situasi, flights, proxy tile; RBAC memakai DB mock [K] | `rbac.integration.test.ts:26` | Tes integrasi dengan Postgres nyata |

## P3 — LOW

- S-10 (cek CSRF mempercayai `X-Forwarded-Host`), S-11 (TLS proxy CCTV), S-13 (proxy tile nginx tanpa sesi), S-14 (ADMIN mengubah ADMIN lain), S-15 (balapan token reset), S-16 (biaya scrypt), S-17 (audit penolakan akses), S-18 (header versi), S-19 (escape severity).
- Shortcut keyboard yang tidak cocok dengan bantuan: S, R, G (`KeyboardShortcuts.tsx:8-12` vs `monitoring-dashboard.tsx:345-356`).
- `aria-live` dan bunyi untuk alert baru.
- Retensi tabel `AuthAudit` dan `SituationRevision`.
- Komentar penggunaan `restore.sh` yang salah (`ops/backup/restore.sh:9`).
- Versi Postgres dev 18 vs produksi 16.
- Cache `flight-route` dibatasi waktu, bukan ukuran.

---

## Urutan implementasi yang disarankan

1. **Minggu 1 — kebersihan cepat (tanpa perubahan arsitektur):**
   - P0-02 rotasi kredensial.
   - P1-07 CI.
   - P1-06 kebocoran player.
   - P1-05 hapus pemalsuan IP.
   - P1-04 interval gempa.
   - P2-15 hapus kode mati.
2. **Minggu 2–3 — kejujuran data:**
   - P0-01 status sumber, usia data, dan indikator nyata.
   - P0-03 versi pada situasi dan refresh papan.
   - P2-10 error boundary.
3. **Minggu 3–5 — keamanan akun:**
   - P1-01 MFA.
   - P2-01 CSP.
   - P2-02 lockout.
   - P2-04 backup terenkripsi di luar host.
   - P1-08 observability dasar.
4. **Minggu 5–8 — inti pusat komando:**
   - Worker tunggal (TO-BE).
   - P1-02 alert dengan ack.
   - P1-03 insiden.
   - SSE.
5. **Setelah itu, sesuai keputusan:**
   - P1-10 media server WebRTC untuk kamera sendiri.
   - P2-03 mode jaringan tertutup.
   - Penerima ADS-B sendiri.
   - Analitik video.

Estimasi minggu di atas adalah perkiraan kasar untuk satu pengembang, bukan komitmen.
