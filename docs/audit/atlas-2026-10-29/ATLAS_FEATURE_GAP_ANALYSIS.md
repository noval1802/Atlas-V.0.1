# ATLAS — Matriks Fitur & Gap Analysis

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).

**Status:** IMPLEMENTED (berjalan ujung ke ujung di kode) · PARTIAL · MOCK (hanya UI, dummy, atau statis) · NOT IMPLEMENTED · UNVERIFIED.

Penilaian berdasarkan kode. Tidak ada fitur yang diuji langsung di browser yang sudah login.

Kolom **Pembaruan 12 Nov** memakai tanda ✅ Selesai · 🟡 Sebagian · ⏳ Belum · ➖ Tidak berlaku, dan mencatat perubahan sejak audit 29 Okt (`b3c6477`). Kolom status asli dibiarkan sebagai catatan saat audit.

## 1. Modul pusat komando

| Modul | Status | Ringkasan | Bukti utama | Pembaruan 12 Nov |
|---|---|---|---|---|
| Gunung api (baru) | IMPLEMENTED | Layer tingkat aktivitas MAGMA/PVMBG (Normal/Waspada/Siaga/Awas) dan laporan per gunung. | `api/volcanoes`, `lib/magma.ts` | ✅ `cf2ab8e`, `355a0e0` |
| Command Dashboard | PARTIAL | Peta `/peta` menampilkan feed langsung. Papan `/operator` membaca DB yang sesungguhnya. Indikator "ONLINE" berwarna hijau statis. Papan operator tidak menyegarkan sendiri. | `GlobalStatusBar.tsx:73`; `(id)/operator/page.tsx:13` | ⏳ Indikator "ONLINE" masih statis; papan operator masih belum menyegarkan sendiri. |
| CCTV Management | PARTIAL | ~19–23 ribu kamera publik pihak ketiga (HLS, FLV, MJPEG, snapshot, iframe). Tidak ada kamera milik sendiri. Tidak ada reconnect otomatis. Status kamera tidak mencerminkan kesegaran gambar. | `cctv-snapshot.ts:9-17`; `camera-feed-view.tsx:101-103` | 🟡 Ditambah 15 sumber kota/provinsi Indonesia (`c0838be`), total ±23 sumber CCTV Indonesia; panel dipecah jadi GLOBAL (dimuat sesuai permintaan), TOL, KOTA, JAKARTA, dan sumber luar negeri yang mati dibuang (`cf2ab8e`); sesi TPT Jakarta disimpan terenkripsi di DB (`355a0e0`). Server kini memeriksa stream secara berkala dan menandai kamera yang mati di peta (`cctv-health.ts`, `cf2ab8e`). Kamera sendiri dan reconnect otomatis masih belum; teardown player di working tree. |
| WebRTC 17+ kamera | NOT IMPLEMENTED | Tidak ada RTCPeerConnection, WHEP, maupun STUN/TURN sama sekali. | grep `src` | ⏳ Belum. |
| Video wall | PARTIAL | Multiview sampai 4×4 (16 tile). Mode AUTO tanpa batas. Tidak ada jeda saat tab tersembunyi. | `multiview.tsx:10-16,48` | ⏳ Belum berubah. |
| Rekaman / snapshot arsip | NOT IMPLEMENTED | Hanya katalog kamera yang disimpan ke disk. | `cctv-snapshot.ts:30` | ⏳ Belum. |
| Video Analytics | NOT IMPLEMENTED | Tidak ada ekstraksi frame atau model deteksi. | grep | ⏳ Belum. |
| GIS & Mapping | PARTIAL | Layer MapLibre, gambar, dan AOI berfungsi. AOI hanya di browser (localStorage). Tidak ada query spasial di server. Tile dan geocoder bergantung internet. | `aoi.ts:96,134`; `proxy-tiles/route.ts:16-29` | ⏳ Belum berubah (AOI masih di browser; layer pesawat dan satelit dihapus dari AOI, `dc942ec`). |
| ADS-B | PARTIAL | Hanya agregator pihak ketiga (OpenSky, adsb.fi, adsb.lol, …). Browser memperbarui tiap 5 menit, sehingga data bisa terlambat ~6,5 menit. Tidak ada receiver sendiri. Hanya 10% pesawat komersial yang digambar. | `layer-feeds.ts:122`; `OsirisMap.tsx:1503` | ➖ Dihapus seluruhnya bersama satelit (`dc942ec`). Rencana: API Flightradar24 berbayar kelak. |
| AIS | PARTIAL | aisstream.io lewat WebSocket. Tidak ada kotak cakupan khusus Indonesia. Tipe kapal tak dikenal dianggap "cargo". Jejak kapal hilang saat restart. | `maritime/route.ts:75-79,140-160` | ⏳ Belum berubah. |
| Sensor & IoT | NOT IMPLEMENTED | Tidak ada MQTT, Modbus, maupun registri perangkat. | grep, `schema.prisma` | ⏳ Belum. |
| Event Management | PARTIAL | AOI tripwire (masuk/keluar) dihitung di browser, hilang saat reload, tidak dibagi antar operator. Tidak ada deduplikasi. | `watch.ts:54,119`; `monitoring-dashboard.tsx:436-451` | ⏳ Belum berubah. |
| Alert Engine | MOCK/PARTIAL | Hanya urutan tampilan berdasarkan tingkat keparahan dari sumber asal. Tidak ada aturan, acknowledgment, eskalasi, maupun cooldown. | `live-alerts.ts:183,208` | 🟡 Masih tanpa aturan/ack. Ringkasan alert kini mengutamakan gempa ≤72 jam dan selalu menyebut usianya (`d1b3b69`). |
| Status AMAN/WASPADA/SIAGA | PARTIAL | Yang ada KONDUSIF/WASPADA/SIAGA, diisi manual per Kotamaops. Tidak terhubung ke alert. | `schema.prisma:26-30` | ⏳ Belum berubah. |
| Incident Management | NOT IMPLEMENTED | Tidak ada model insiden, penugasan, timeline, maupun penutupan. `incidentCount` adalah angka yang diketik manual. | `schema.prisma:90-120` | ⏳ Belum. |
| Communication | NOT IMPLEMENTED | SMTP hanya untuk reset kata sandi. Tidak ada chat, push, WhatsApp, maupun SMS. | `lib/ops/mail.ts:21-39` | ⏳ Belum. (Chat AI `355a0e0` adalah asisten tanya-jawab, bukan saluran komunikasi antar operator.) |
| Reporting | PARTIAL | Ekspor AOI (GeoJSON/CSV) di browser. Riwayat situasi 20 revisi terakhir. Lapsit karhutla adalah snapshot statis 5 Okt 2026 yang tertanam di kode. | `aoi-export.ts`; `karhutla-lapsit.ts:1-3` | ⏳ Belum berubah; lapsit karhutla masih statis. |
| User Management | IMPLEMENTED (tanpa MFA) | 6 peran. Akses Kodam dibatasi di level objek untuk baca dan tulis. Sesi ditandatangani dan dicek ulang ke DB. Persetujuan pendaftaran. **MFA tidak ada.** | `lib/ops/access.ts`, `session.ts`, `register/route.ts` | 🟡 UI Pengguna V2 (`414ba45`), kebijakan sandi min. 12 + bootstrap admin sekali jalan (`547f807`), konfirmasi ganti sandi dan pemulihan SUPER_ADMIN lokal (`17cd4f2`). MFA masih ⏳. |
| System Monitoring | PARTIAL | `/api/health/ready` mengecek DB. Tidak ada metrik, log terstruktur, alert kegagalan, maupun status per sumber. | `health/ready/route.ts:17-27` | ⏳ Belum berubah. |
| Ringkasan AI | IMPLEMENTED (heuristik lokal) | Tidak memanggil model eksternal. | `ai/overview/route.ts:7-9` | 🟡 Ringkasan tetap heuristik lokal. Baru: chat AI operator (`/api/ai/chat`, `355a0e0`) yang memanggil LLM eksternal; hanya teks ketikan operator yang dikirim, tanpa data situasi. Perlu keputusan kebijakan data keluar. |

## 2. Alur operasional

Event → Validasi → Alert → Ack → Verifikasi → Penugasan → Respons → Penyelesaian → Audit

| Langkah | Ada? | Bukti |
|---|---|---|
| Event terdeteksi | Ada, hanya di browser, tidak disimpan | `monitoring-dashboard.tsx:436-451` |
| Validasi (sumber kedua) | Tidak | — |
| Alert dibuat | Sebagian (daftar berperingkat) | `LiveAlerts.tsx` |
| Acknowledgment operator | Tidak | — |
| Verifikasi insiden | Tidak | — |
| Penugasan | Tidak | — |
| Respons | Manual: ubah status Kotamaops | `situations/[id]/route.ts` |
| Penyelesaian | Tidak | — |
| Audit | Sebagian: login dan edit situasi | `AuthAudit`, `SituationRevision` |

*Pembaruan 12 Nov: alur ini belum berubah; semua langkah yang "Tidak" masih ⏳.*

**Aksi berisiko tinggi otomatis: tidak ditemukan.** Status situasi hanya bisa diubah lewat PATCH yang terautentikasi dan dicek perannya. Tidak ada feed yang mengubah status sendiri.

## 3. Jawaban C — mana yang berfungsi, simulasi, atau belum ada

- **Berfungsi (berdasarkan kode dan unit test):**
  - Login, sesi, RBAC, dan pembatasan akses Kodam; pendaftaran dengan persetujuan; reset kata sandi.
  - Papan situasi Kotamaops dengan riwayat revisi.
  - Peta dengan layer gempa BMKG, cuaca/peringatan, kebakaran FIRMS, berita, ~~pesawat~~, kapal, ~~dan satelit~~ (pesawat dan satelit dihapus, `dc942ec`). Baru: layer gunung api MAGMA; gempa kini menampilkan waktu WIB dan memudar sesuai usia (`d1b3b69`).
  - Katalog dan pemutar CCTV publik (kini ±23 sumber Indonesia); gambar dan analisis AOI di browser; ekspor AOI.
  - Ringkasan heuristik.
  - Baru: chat AI operator (bila kunci API dikonfigurasi di server).
- **Statis atau simulasi:**
  - Lapsit karhutla (snapshot 5 Okt).
  - Indikator "ONLINE".
  - Splash "CALIBRATING SENSORS".
  - `demoMode` (putaran globe).
  - Angka insiden (diketik manual).
- **Belum ada:**
  - Alert engine dengan ack dan eskalasi; manajemen insiden; komunikasi dan notifikasi.
  - IoT; WebRTC; kamera milik sendiri; rekaman; video analytics.
  - MFA; monitoring/observability; histori feed; push real-time.
  - *(Per 12 Nov semua butir "Belum ada" di atas masih ⏳.)*
