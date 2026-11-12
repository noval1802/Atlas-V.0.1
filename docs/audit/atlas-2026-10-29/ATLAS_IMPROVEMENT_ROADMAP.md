# ATLAS — Roadmap Perbaikan Berprioritas

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).

**Tanda status:**
- **[K]** terkonfirmasi di kode.
- **[V]** terkonfirmasi dan sudah diverifikasi ulang langsung oleh auditor utama.
- **[H]** hipotesis, perlu diuji.

**Status pelaksanaan (12 Nov 2026):** ✅ Selesai · 🟡 Sebagian · ⏳ Belum · ➖ Tidak berlaku.

Roadmap disusun 29 Oktober 2026 (commit `b3c6477`). Sejak itu yang tuntas baru P0-02 (sisi kode) dan P2-05; beberapa butir lain sebagian. Pelacakan pesawat dan satelit dihapus (`dc942ec`), sehingga butir yang hanya menyangkut pesawat menjadi tidak berlaku. Bukti dan nomor baris di bawah tetap seperti saat audit; sebagian sudah bergeser.

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
- **Status (12 Nov):** ⏳ Belum. "ONLINE" masih hijau statis, `timestamp` masih waktu respons (`earthquakes`, `fires`, `weather`), `/api/health/sources` belum ada. Kemajuan kecil: feed cuaca/gempa/gunung api kini menjawab 502 saat gagal dingin alih-alih daftar kosong (`c0838be`). Penanda `+stale` pesawat ➖ (feed pesawat dihapus, `dc942ec`).

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
- **Status (12 Nov):** 🟡 Sebagian. Sisi kode ✅: minimum 12 karakter dan penolakan nama aplikasi/peran/username/pola umum (`547f807`); bootstrap admin sekali jalan (`547f807`); ganti sandi wajib konfirmasi dua kali dan pemulihan SUPER_ADMIN lokal plus panduan `docs/ops/ROTASI_SUPER_ADMIN.md` (`17cd4f2`). Sisa: rotasi nilai yang sebenarnya di server (SUPER_ADMIN dan DB) tidak bisa dibuktikan dari repo, perlu konfirmasi pemilik server.

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
- **Status (12 Nov):** ⏳ Belum. PATCH situasi masih tanpa cek versi/409; `/operator` masih hanya mem-poll `/api/health` tiap 60 detik, tabel situasi tidak menyegarkan sendiri.

---

## P1 — HIGH

| ID | Masalah | Evidence | Solusi | Acceptance / verifikasi | Status (12 Nov) |
|---|---|---|---|---|---|
| P1-01 | Tidak ada MFA [K] | `schema.prisma`, `login/route.ts` | TOTP wajib untuk ADMIN, SUPER_ADMIN, dan operator, plus recovery code | Login hanya dengan kata sandi → `mfa_required` tanpa cookie (tes API) | ⏳ Belum. Tidak ada TOTP/MFA di skema maupun login. |
| P1-02 | Tidak ada alert engine: aturan, ack, eskalasi, persistensi [K] | `live-alerts.ts:208`, `watch.ts:119` | Tabel `Alert` (sumber, severity, `ackBy`, `ackAt`), aturan dengan dedup dan cooldown di server, eskalasi waktu | Alert yang di-ack satu operator terlihat ter-ack di operator lain; bertahan setelah reload | ⏳ Belum. Tidak ada tabel `Alert`. |
| P1-03 | Tidak ada manajemen insiden [K] | `schema.prisma:90-120` (`incidentCount` diketik manual) | Model `Incident` + `IncidentEvent` (status, penanggung jawab, timeline, penutupan); transisi status ditegakkan di server; verifikasi manusia untuk SIAGA | Alur buat → tugaskan → selesaikan tercatat di timeline dan audit | ⏳ Belum. Tidak ada model insiden; `incidentCount` masih manual. |
| P1-04 | Latensi data inti [V] | Gempa 15 menit dan tidak diambil saat tab tersembunyi (`monitoring-dashboard.tsx:537`); layer lain 5 menit (`layer-feeds.ts:122`) | Gempa dan peringatan ≤60 detik; pesawat yang dipantau 15–30 detik; kelak SSE dari worker | Gempa baru di BMKG tampil ≤2 menit | 🟡 Sebagian. Server kini membaca BMKG dengan cache 1 menit (`92cfc10`, sebelum audit), tetapi browser masih mem-poll gempa tiap 15 menit dan dilewati saat tab tersembunyi. Bagian pesawat ➖ (`dc942ec`). |
| P1-05 | `stealthFetch` memalsukan IP dan merotasi UA [V] | `stealthFetch.ts:8,59,78-79`, 27 berkas | Hapus header palsu; UA jujur; API key dan cache | `grep X-Forwarded-For src/lib/stealthFetch.ts` kosong; feed tetap berjalan | ⏳ Belum. Header IP palsu masih ada di `stealthFetch.ts`; dipakai 23 berkas. |
| P1-06 | Player video bocor saat ditutup [V] | `camera-feed-view.tsx:69-130`: tidak ada `destroy()` saat unmount; cleanup FLV tidak menghancurkan player | Cleanup effect memanggil `hls.destroy()` dan `flv.destroy()` | Membuka dan menutup 20 kamera tidak menyisakan request segmen di tab Network | 🟡 Sebagian. Teardown HLS/FLV/video native saat unmount dan batas buffer sudah ada di `356bd31` (`camera-feed-view.tsx`), belum diuji dengan 20 kamera. |
| P1-07 | Tidak ada CI gate [V] | `.github/workflows/docker-publish.yml` (publish manual saja) | Workflow lint, typecheck, test, dan build pada setiap push dan PR | PR yang merusak tes otomatis merah | ⏳ Belum. Hanya `docker-publish.yml` (manual). |
| P1-08 | Tidak ada observability [K] | ~97 `console.*`; tidak ada metrik atau alert | Log JSON terstruktur, `/api/health/sources`, alert ke admin saat layanan atau backup gagal | Mematikan Postgres memicu notifikasi ≤5 menit | ⏳ Belum. Masih ±86 `console.*`, tanpa log terstruktur atau alert. |
| P1-09 | Deploy Docker belum pernah diverifikasi penuh [K] | `AUDIT_MONITORING_SITUASI_NASIONAL.md:309` | Uji `docker compose up` bersih di server target dan catat hasilnya | Runbook berisi log uji yang berhasil | ⏳ Belum. Tidak ada catatan uji `docker compose up` di server target. |
| P1-10 | WebRTC dan kamera milik sendiri belum ada (prasyarat 17+ kamera) [V] | grep `RTCPeerConnection` kosong | MediaMTX/go2rtc (RTSP→WHEP) dan komponen pemutar WHEP; batas grid 16; jeda saat tersembunyi | 17 stream uji berjalan 24 jam tanpa kenaikan memori >X% (ukur) | ⏳ Belum. Tidak ada `RTCPeerConnection`/WHEP. |
| P1-11 | Proses tunggal dengan state di memori [K] | `rate-limit.ts:3`, `maritime/route.ts:108`, `sourceCache.ts:24` | Dokumentasikan wajib satu instance; pindahkan rate limit ke DB | Dokumen deploy menyatakan batas ini | ⏳ Belum. Rate limit masih di memori; batas satu instance belum didokumentasikan. |

---

## P2 — MEDIUM

| ID | Masalah | Evidence | Solusi | Status (12 Nov) |
|---|---|---|---|---|
| P2-01 | CSP longgar (`unsafe-inline`, `https:`) [K] | `next.config.ts:75-76` | Nonce CSP, `connect-src` allowlist | ⏳ Belum. CSP masih memakai `unsafe-inline`. |
| P2-02 | Lockout akun lewat rate limit [K] | `login/route.ts:27-31` | Penundaan progresif atau CAPTCHA | 🟡 Sebagian. Mitigasi lockout (slot dikembalikan saat login berhasil, alamat yang pernah dipakai pemilik akun tetap bisa masuk) ada di `356bd31`. Penundaan progresif/CAPTCHA belum. |
| P2-03 | Ketergantungan internet: Google Fonts, tile CARTO, Nominatim, OSRM, resolver DNS publik nginx [K] | `globals.css:1`, `proxy-tiles/route.ts`, `nginx.conf:38` | Self-host font, PMTiles Indonesia, geocoder | ⏳ Belum. Google Fonts, tile CARTO, geocoder luar, dan resolver DNS publik nginx masih dipakai. |
| P2-04 | Backup tidak terenkripsi, di host sama, kegagalan tidak memberi tahu siapa pun [K] | `ops/backup/backup.sh:19,24,37` | Enkripsi, salinan luar host, notifikasi gagal, latihan restore bulanan | ⏳ Belum. Backup belum terenkripsi, belum ada salinan luar host maupun notifikasi gagal. |
| P2-05 | Proxy HLS/TPT mengikuti redirect tanpa cek ulang [K] | `cctv/hls/route.ts`, `tpt/media/route.ts:39-40` | `safeFetch` / `redirect:'manual'` | ✅ Selesai. Proxy HLS (`c0838be`) dan media TPT (`355a0e0`) kini lewat `safeFetch` yang memeriksa ulang setiap redirect. |
| P2-06 | Video dialirkan lewat proses Node [K] | `cctv/hls/route.ts:45-47` | Media server atau `proxy_cache` nginx untuk segmen | ⏳ Belum. Segmen video masih dialirkan lewat Node. |
| P2-07 | Tidak ada reconnect otomatis untuk stream [K] | `camera-feed-view.tsx:101-103` | Backoff + `recoverMediaError` | ⏳ Belum. Hanya tombol coba lagi manual; belum ada backoff otomatis atau `recoverMediaError`. |
| P2-08 | Pesawat komersial hanya 1 dari 10 yang digambar, tanpa keterangan [V] | `OsirisMap.tsx:1503` | Filter bbox Indonesia di server; tampilkan "X dari Y" | ➖ Tidak berlaku. Layer pesawat dihapus (`dc942ec`). |
| P2-09 | Cakupan Indonesia lemah: fallback ADS-B tanpa wilayah Indonesia; AIS tanpa kotak Indonesia [K] | `flights/route.ts:83-120`, `maritime/route.ts:140-160` | Tambah titik dan kotak cakupan Indonesia dan ALKI | 🟡 ADS-B ➖ (dihapus, `dc942ec`). AIS ⏳: kotak cakupan Indonesia/ALKI belum ditambahkan. |
| P2-10 | Error boundary hanya membungkus peta; tidak ada `error.tsx` [K] | `monitoring-dashboard.tsx:815` | Error boundary per panel dan `app/error.tsx` | ⏳ Belum. Belum ada `error.tsx`. |
| P2-11 | Teks terlalu kecil untuk video wall (155 deklarasi 9px) [K] | `GlobalStatusBar.tsx:73` dkk | Mode "wall" dengan teks minimum 12–14px dan kontras ≥4,5:1 | ⏳ Belum. Masih ±96 `text-[9px]`; belum ada mode wall. |
| P2-12 | Bahasa campur: `/peta` berbahasa Inggris, ops berbahasa Indonesia [K] | `(en)/layout.tsx:10` | Satukan ke Bahasa Indonesia | ⏳ Belum. `(en)/layout.tsx` masih `lang="en"`. |
| P2-13 | Lapsit karhutla statis tertanam di kode (berlabel tanggal, 8px) [V] | `karhutla-lapsit.ts:1-3`, `OsirisMap.tsx:1284` | Simpan di DB dengan usia data yang jelas, atau hapus | ⏳ Belum. `karhutla-lapsit.ts` masih snapshot 5 Okt. |
| P2-14 | Data operator bocor ke pihak ketiga (pencarian, koordinat, rute, entitas) [K] | lihat Security Review S-07 | Self-host atau daftar putih data keluar | ⏳ Belum. Catatan: chat AI baru (`355a0e0`) menambah satu jalur data keluar (teks yang diketik operator dikirim ke layanan LLM luar); konteks situasi tidak dilampirkan. |
| P2-15 | Kode mati: `engine/` (hanya .pyc), route `/api/balloons` dan `/api/radiation` yang tidak ada [K] | `engine/`, `layer-feeds.ts:144-145` | Hapus | ⏳ Belum. `engine/` (.pyc) masih ter-commit; `balloons`/`radiation` masih ada di `layer-feeds.ts`. Route pesawat/satelit sudah dihapus (`dc942ec`). |
| P2-16 | Tes kritis belum ada: PATCH situasi, flights, proxy tile; RBAC memakai DB mock [K] | `rbac.integration.test.ts:26` | Tes integrasi dengan Postgres nyata | 🟡 Sebagian. Sudah ada tes DB nyata untuk seed, pemulihan admin, dan vault sesi TPT (`547f807`, `17cd4f2`, `355a0e0`). PATCH situasi, proxy tile, dan RBAC masih tanpa Postgres nyata. Tes flights ➖. |

## P3 — LOW

- ⏳ S-10 (cek CSRF mempercayai `X-Forwarded-Host`), S-11 (TLS proxy CCTV), S-13 (proxy tile nginx tanpa sesi), S-14 (ADMIN mengubah ADMIN lain), S-15 (balapan token reset), S-16 (biaya scrypt), S-17 (audit penolakan akses), S-18 (header versi), S-19 (escape severity). Status per butir dilacak di dokumen keamanan internal, tidak diulang di sini.
- ⏳ Shortcut keyboard yang tidak cocok dengan bantuan (masih: S di bantuan "Share", di kode membuka pencarian; G tidak ada di bantuan): S, R, G (`KeyboardShortcuts.tsx:8-12` vs `monitoring-dashboard.tsx:345-356`).
- ⏳ `aria-live` dan bunyi untuk alert baru.
- ⏳ Retensi tabel `AuthAudit` dan `SituationRevision`.
- ⏳ Komentar penggunaan `restore.sh` yang salah (`ops/backup/restore.sh:9`).
- ⏳ Versi Postgres dev 18 vs produksi 16 (masih sama).
- ➖ ~~Cache `flight-route` dibatasi waktu, bukan ukuran.~~ Route dihapus (`dc942ec`).

---

## Urutan implementasi yang disarankan

*Status per 12 Nov: dari Minggu 1 baru P0-02 (sisi kode) yang selesai; P1-06 selesai di `356bd31`. Butir lain masih terbuka.*

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
   - Penerima ADS-B sendiri. *(Ditinjau ulang: pelacakan pesawat dihapus `dc942ec`; rencana pemilik adalah API Flightradar24 berbayar.)*
   - Analitik video.

Estimasi minggu di atas adalah perkiraan kasar untuk satu pengembang, bukan komitmen.
