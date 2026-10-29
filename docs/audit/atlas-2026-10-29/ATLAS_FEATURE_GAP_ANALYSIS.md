# ATLAS — Matriks Fitur & Gap Analysis

**Status:** IMPLEMENTED (berjalan ujung ke ujung di kode) · PARTIAL · MOCK (hanya UI, dummy, atau statis) · NOT IMPLEMENTED · UNVERIFIED.

Penilaian berdasarkan kode. Tidak ada fitur yang diuji langsung di browser yang sudah login.

## 1. Modul pusat komando

| Modul | Status | Ringkasan | Bukti utama |
|---|---|---|---|
| Command Dashboard | PARTIAL | Peta `/peta` menampilkan feed langsung. Papan `/operator` membaca DB yang sesungguhnya. Indikator "ONLINE" berwarna hijau statis. Papan operator tidak menyegarkan sendiri. | `GlobalStatusBar.tsx:73`; `(id)/operator/page.tsx:13` |
| CCTV Management | PARTIAL | ~19–23 ribu kamera publik pihak ketiga (HLS, FLV, MJPEG, snapshot, iframe). Tidak ada kamera milik sendiri. Tidak ada reconnect otomatis. Status kamera tidak mencerminkan kesegaran gambar. | `cctv-snapshot.ts:9-17`; `camera-feed-view.tsx:101-103` |
| WebRTC 17+ kamera | NOT IMPLEMENTED | Tidak ada RTCPeerConnection, WHEP, maupun STUN/TURN sama sekali. | grep `src` |
| Video wall | PARTIAL | Multiview sampai 4×4 (16 tile). Mode AUTO tanpa batas. Tidak ada jeda saat tab tersembunyi. | `multiview.tsx:10-16,48` |
| Rekaman / snapshot arsip | NOT IMPLEMENTED | Hanya katalog kamera yang disimpan ke disk. | `cctv-snapshot.ts:30` |
| Video Analytics | NOT IMPLEMENTED | Tidak ada ekstraksi frame atau model deteksi. | grep |
| GIS & Mapping | PARTIAL | Layer MapLibre, gambar, dan AOI berfungsi. AOI hanya di browser (localStorage). Tidak ada query spasial di server. Tile dan geocoder bergantung internet. | `aoi.ts:96,134`; `proxy-tiles/route.ts:16-29` |
| ADS-B | PARTIAL | Hanya agregator pihak ketiga (OpenSky, adsb.fi, adsb.lol, …). Browser memperbarui tiap 5 menit, sehingga data bisa terlambat ~6,5 menit. Tidak ada receiver sendiri. Hanya 10% pesawat komersial yang digambar. | `layer-feeds.ts:122`; `OsirisMap.tsx:1503` |
| AIS | PARTIAL | aisstream.io lewat WebSocket. Tidak ada kotak cakupan khusus Indonesia. Tipe kapal tak dikenal dianggap "cargo". Jejak kapal hilang saat restart. | `maritime/route.ts:75-79,140-160` |
| Sensor & IoT | NOT IMPLEMENTED | Tidak ada MQTT, Modbus, maupun registri perangkat. | grep, `schema.prisma` |
| Event Management | PARTIAL | AOI tripwire (masuk/keluar) dihitung di browser, hilang saat reload, tidak dibagi antar operator. Tidak ada deduplikasi. | `watch.ts:54,119`; `monitoring-dashboard.tsx:436-451` |
| Alert Engine | MOCK/PARTIAL | Hanya urutan tampilan berdasarkan tingkat keparahan dari sumber asal. Tidak ada aturan, acknowledgment, eskalasi, maupun cooldown. | `live-alerts.ts:183,208` |
| Status AMAN/WASPADA/SIAGA | PARTIAL | Yang ada KONDUSIF/WASPADA/SIAGA, diisi manual per Kotamaops. Tidak terhubung ke alert. | `schema.prisma:26-30` |
| Incident Management | NOT IMPLEMENTED | Tidak ada model insiden, penugasan, timeline, maupun penutupan. `incidentCount` adalah angka yang diketik manual. | `schema.prisma:90-120` |
| Communication | NOT IMPLEMENTED | SMTP hanya untuk reset kata sandi. Tidak ada chat, push, WhatsApp, maupun SMS. | `lib/ops/mail.ts:21-39` |
| Reporting | PARTIAL | Ekspor AOI (GeoJSON/CSV) di browser. Riwayat situasi 20 revisi terakhir. Lapsit karhutla adalah snapshot statis 5 Okt 2026 yang tertanam di kode. | `aoi-export.ts`; `karhutla-lapsit.ts:1-3` |
| User Management | IMPLEMENTED (tanpa MFA) | 6 peran. Akses Kodam dibatasi di level objek untuk baca dan tulis. Sesi ditandatangani dan dicek ulang ke DB. Persetujuan pendaftaran. **MFA tidak ada.** | `lib/ops/access.ts`, `session.ts`, `register/route.ts` |
| System Monitoring | PARTIAL | `/api/health/ready` mengecek DB. Tidak ada metrik, log terstruktur, alert kegagalan, maupun status per sumber. | `health/ready/route.ts:17-27` |
| Ringkasan AI | IMPLEMENTED (heuristik lokal) | Tidak memanggil model eksternal. | `ai/overview/route.ts:7-9` |

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

**Aksi berisiko tinggi otomatis: tidak ditemukan.** Status situasi hanya bisa diubah lewat PATCH yang terautentikasi dan dicek perannya. Tidak ada feed yang mengubah status sendiri.

## 3. Jawaban C — mana yang berfungsi, simulasi, atau belum ada

- **Berfungsi (berdasarkan kode dan unit test):**
  - Login, sesi, RBAC, dan pembatasan akses Kodam; pendaftaran dengan persetujuan; reset kata sandi.
  - Papan situasi Kotamaops dengan riwayat revisi.
  - Peta dengan layer gempa BMKG, cuaca/peringatan, kebakaran FIRMS, berita, pesawat, kapal, dan satelit.
  - Katalog dan pemutar CCTV publik; gambar dan analisis AOI di browser; ekspor AOI.
  - Ringkasan heuristik.
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
