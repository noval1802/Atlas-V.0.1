# ATLAS — Laporan Audit Teknis Komprehensif

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).

**Tanggal:** 29 Oktober 2026
**Cakupan:** seluruh repository `Atlas-V.0.1` (branch `master`)
**Mode:** READ-ONLY. Kode, database, dan konfigurasi tidak diubah. Satu-satunya berkas yang dibuat adalah dokumen di folder ini.

**Dokumen pendamping:**
- [AS-IS](ATLAS_ARCHITECTURE_AS_IS.md)
- [TO-BE](ATLAS_ARCHITECTURE_TO_BE.md)
- [Gap Analysis](ATLAS_FEATURE_GAP_ANALYSIS.md)
- [Security Review](ATLAS_SECURITY_REVIEW.md)
- [Roadmap](ATLAS_IMPROVEMENT_ROADMAP.md)

> Penilaian ini adalah penilaian teknis awal, bukan sertifikasi kepatuhan atau otorisasi operasional.

## Metode dan keterbatasan

**Yang dilakukan:**
- Membaca kode: 339 berkas TS/TSX, 49 route API, skema Prisma, Docker, nginx, dan skrip ops.
- Lima pemeriksaan paralel per area: arsitektur, CCTV, modul C2, keamanan, serta performa dan UI.
- Temuan berdampak besar diverifikasi ulang langsung oleh auditor utama (ditandai [V] di roadmap).

**Hasil pengujian:**
- `vitest run`: 112 berkas tes, **978 lulus, 20 dilewati, 0 gagal**.
- `tsc --noEmit`: lulus.
- `npm audit --omit=dev`: 0 kerentanan.

**Tidak dilakukan:**
- Load test.
- `docker compose up`.
- Uji di browser dengan sesi login.
- Uji ke layanan luar.
- Pemutaran stream kamera.

Karena itu semua klaim kapasitas berstatus **UNVERIFIED**.

---

## 1. Executive Summary

ATLAS saat ini adalah **peta kesadaran situasi (situational awareness) yang kaya data**, ditambah **papan status Kotamaops yang nyata** dengan fondasi autentikasi dan otorisasi yang baik.

ATLAS **belum** merupakan Integrated Command Center. Mata rantai inti pusat komando belum ada:
- alert dengan acknowledgment;
- insiden dengan penugasan dan timeline;
- komunikasi dan notifikasi;
- pengiriman data real-time;
- histori data.

Selain itu, sistem **tidak jujur tentang kesehatannya sendiri**. Indikator "ONLINE" berwarna hijau statis, dan data dari sumber yang gagal tetap tampil seolah terkini.

Sisi kuatnya:
- Kode rapi dan banyak diuji (978 tes).
- RBAC dan pembatasan Kodam sudah benar sampai level objek.
- Proxy dilindungi dari SSRF.
- Docker, backup, dan TLS sudah dirancang.

Arsitektur modular monolith **sudah tepat** dan tidak perlu ditulis ulang.

**Verdict: PROTOTYPE.** Untuk cakupan sempit (peta situasi + papan status Kotamaops, internal, bukan untuk keputusan kritis), ATLAS dekat dengan *limited pilot* setelah tiga temuan P0 diperbaiki.

## 2. Gambaran sistem saat ini

| Aspek | Kondisi |
|---|---|
| Stack | Next.js 16 + React 19, Prisma + PostgreSQL, MapLibre; layanan `intel/` (Express); nginx |
| Pola | Hybrid modular monolith (satu proses web dan satu layanan intel) |
| Data permanen | Hanya pengguna, Kotamaops, situasi + revisi, reset kata sandi, audit auth |
| Feed langsung | BMKG, FIRMS, EONET/GDACS, OpenSky/adsb.fi (➖ dihapus, dc942ec), aisstream, Telegram/RSS, ~20 ribu CCTV publik — semuanya di memori, lewat polling |
| Real-time | Tidak ada push. Polling 10 detik (kapal), 5 menit (layer), 15 menit (gempa) |
| Worker / event bus | Tidak ada |

## 3. Diagram arsitektur AS-IS

Lihat [ATLAS_ARCHITECTURE_AS_IS.md](ATLAS_ARCHITECTURE_AS_IS.md) §6.

## 4. Matriks fitur

Lihat [ATLAS_FEATURE_GAP_ANALYSIS.md](ATLAS_FEATURE_GAP_ANALYSIS.md). Ringkasnya:

| Status | Modul |
|---|---|
| IMPLEMENTED | User management (tanpa MFA), ringkasan heuristik lokal |
| PARTIAL | Dashboard, CCTV publik, GIS, ADS-B (➖ dihapus, dc942ec), AIS, event (di browser), reporting, monitoring |
| MOCK/statis | Indikator ONLINE, lapsit karhutla, angka insiden manual, alert (hanya urutan tampilan) |
| NOT IMPLEMENTED | Incident management, communication, IoT, WebRTC, kamera milik sendiri, rekaman, video analytics, MFA |

## 5. Penilaian integrasi

- **Yang baik:**
  - Setiap sumber dibungkus timeout dan isolasi kegagalan (`allSettled`).
  - `sourceCache` menggabungkan request yang bersamaan dan menyajikan data lama saat sumber gagal.
  - Proxy CCTV memakai allowlist.
- **Gap:**
  - Tidak ada status per sumber. — ⏳ Terbuka
  - Timestamp respons menyesatkan. — ⏳ Terbuka
  - Tidak ada histori. — ⏳ Terbuka
  - Pengambilan data berjalan di dalam request web. — ⏳ Terbuka
  - Cakupan Indonesia lemah pada fallback ADS-B dan AIS. — ADS-B ➖ Tidak berlaku (dc942ec); AIS ⏳ Terbuka
  - `stealthFetch` memalsukan IP di 27 berkas. — ⏳ Terbuka
  - Banyak fungsi bergantung pada internet publik (tile, font, geocoder), sehingga tidak siap untuk jaringan tertutup. — ⏳ Terbuka

## 6. Penilaian keamanan

Fondasinya baik: sesi, RBAC, pembatasan Kodam, SSRF, dan tidak ada SQLi maupun open redirect.

Prioritas perbaikan:
- Kredensial SUPER_ADMIN dan DB yang lemah (**P0**). — 🟡 Sebagian (547f807, 17cd4f2): kebijakan sandi diperkuat, rotasi belum terverifikasi
- Tidak ada MFA. — ⏳ Terbuka
- `stealthFetch`. — ⏳ Terbuka
- CSP longgar. — ⏳ Terbuka
- Lockout akun lewat rate limit. — ✅ Selesai (`356bd31`)
- Backup tidak terenkripsi. — ⏳ Terbuka
- Kebocoran data pencarian dan koordinat ke pihak ketiga. — ⏳ Terbuka

Detail di [ATLAS_SECURITY_REVIEW.md](ATLAS_SECURITY_REVIEW.md).

## 7. Performa dan keandalan

**Kapasitas: UNVERIFIED.** Tidak ada load test maupun benchmark.

- **Baik:**
  - Marker digambar sebagai GeoJSON di GPU.
  - Timer dibersihkan.
  - Cache dibatasi.
  - Fan-out request dibatasi.
- **Risiko:**
  - Payload pesawat dikirim penuh, lalu 90% dibuang di browser. — ➖ Tidak berlaku (pelacakan pesawat dihapus, dc942ec)
  - Video mengalir lewat proses Node. — ⏳ Terbuka
  - Player video bocor saat ditutup. — ✅ Selesai (`356bd31`)
  - Semua state di memori satu proses (tidak bisa lebih dari satu instance, hilang saat restart). — ⏳ Terbuka
  - Fetch di browser tanpa timeout. — ⏳ Terbuka

## 8. Penilaian UI/UX

- **Sudah bagus:**
  - Identitas visual konsisten (navy, cyan, gold).
  - Peta responsif.
  - Halaman operator memakai live region dan waktu WIB.
- **Gap:**
  - Indikator kesehatan palsu. — ⏳ Terbuka
  - Tidak ada tanda usia data. — ⏳ Terbuka
  - Alert mudah terlewat (tanpa suara dan tanpa `aria-live`). — ⏳ Terbuka
  - 155 teks berukuran 9px, terlalu kecil untuk video wall. — ⏳ Terbuka
  - Bahasa campur Inggris dan Indonesia. — ⏳ Terbuka
  - Tidak ada panel detail insiden. — ⏳ Terbuka
  - Shortcut keyboard tidak cocok dengan bantuannya. — ⏳ Terbuka

## 9. Kesiapan produksi

- **Ada:**
  - Docker multi-stage dengan user non-root.
  - Job migrasi terpisah.
  - Healthcheck DB.
  - Rotasi log.
  - TLS di nginx.
  - Backup harian dengan retensi 14 hari dan skrip restore.
- **Belum:**
  - CI untuk test dan lint. — ⏳ Terbuka (workflow hanya publish image Docker)
  - Monitoring dan alert kegagalan. — ⏳ Terbuka
  - Verifikasi `docker compose up` penuh. — ⏳ Terbuka
  - Backup di luar host dan terenkripsi. — ⏳ Terbuka
  - Latihan restore rutin. — ⏳ Terbuka
  - Rollback. — ⏳ Terbuka
  - Runbook dan SOP operator. — ⏳ Terbuka
  - Retensi data. — ⏳ Terbuka
  - Failover. — ⏳ Terbuka

**Risiko paling kritis yang menghalangi produksi:**
1. Kredensial lemah tanpa MFA. — 🟡 Sebagian (kebijakan sandi sudah ada; MFA dan rotasi belum)
2. Tidak ada deteksi kegagalan, baik bagi operator maupun admin. — ⏳ Terbuka
3. Deploy belum pernah terbukti berjalan. — ⏳ Terbuka

## 10. Scorecard

| Domain | Skor | Alasan singkat |
|---|---|---|
| Software Architecture | **3** | Pola tepat untuk skala ini, tetapi pengambilan data ada di request web, tanpa worker, berkas raksasa (2,6 ribu baris) |
| System Integration | **2** | Banyak sumber dengan timeout dan stale-on-error, tetapi tanpa status sumber, timestamp menyesatkan, IP palsu, bergantung internet |
| CCTV & Video Management | **2** | Katalog publik besar dan multi-protokol; tanpa WebRTC, kamera sendiri, rekaman, reconnect; player bocor |
| Real-Time Data Infrastructure | **1** | Hanya polling (5–15 menit untuk data inti), tanpa push, event bus, maupun histori |
| GIS & Mapping | **3** | Peta GPU yang solid, AOI, ekspor; tetapi analisis hanya di browser dan tile bergantung internet |
| Event & Alert Management | **1** | Hanya daftar berperingkat dan tripwire di browser; tanpa ack, aturan, dedup, maupun persistensi |
| Incident Management | **1** | Papan status manual; tidak ada entitas insiden |
| Cybersecurity | **3** | Auth, RBAC, dan SSRF kuat dan teruji; tanpa MFA, kredensial lemah, CSP longgar |
| Performance & Reliability | **2 (UNVERIFIED)** | Desain hemat, tetapi tanpa benchmark, state di memori, video lewat Node |
| Observability | **1** | Hanya console log dan readiness DB |
| UI/UX & Operator Experience | **2** | Visual kuat; indikator palsu, tanpa usia data, teks kecil, bahasa campur |
| Production Readiness | **2** | Docker/backup/TLS dirancang; tanpa CI, monitoring, verifikasi deploy, runbook |

## 11. Temuan kritis

1. **P0-01** — Indikator "ONLINE" palsu, dan data basi tampil seolah terkini. — ⏳ Terbuka
2. **P0-02** — Kredensial SUPER_ADMIN dan DB lemah (diperparah oleh tidak adanya MFA, P1-01). — 🟡 Sebagian (547f807, 17cd4f2): rotasi kredensial dan MFA belum
3. **P0-03** — Edit situasi saling menimpa diam-diam, dan papan operator tidak menyegarkan sendiri. — ⏳ Terbuka
4. **P1-02/P1-03** — Tidak ada alur alert → ack → insiden → penugasan → penutupan. — ⏳ Terbuka
5. **P1-07/P1-08** — Tidak ada CI gate maupun monitoring; kegagalan baru diketahui dari pengguna. — ⏳ Terbuka

Lainnya yang penting: `stealthFetch` memalsukan IP (P1-05, ⏳ Terbuka), player video bocor (P1-06, ✅ Selesai — `356bd31`), dan gempa diperbarui tiap 15 menit (P1-04, ⏳ Terbuka).

## 12. Arsitektur TO-BE

Modular monolith yang sama, ditambah:
- satu proses `atlas-worker`;
- PostgreSQL sebagai state, histori, dan event bus ringan (`LISTEN/NOTIFY`);
- SSE untuk push ke operator;
- MediaMTX/go2rtc untuk WebRTC kamera milik sendiri;
- self-host tile, font, dan geocoder untuk jaringan tertutup.

Tanpa microservices dan tanpa Kubernetes. Lihat [ATLAS_ARCHITECTURE_TO_BE.md](ATLAS_ARCHITECTURE_TO_BE.md).

## 13–14. Roadmap dan urutan implementasi

Lihat [ATLAS_IMPROVEMENT_ROADMAP.md](ATLAS_IMPROVEMENT_ROADMAP.md): 3 P0, 11 P1, 16 P2, plus P3, dalam 5 tahap.

## 15. Verdict akhir

**A. Apakah ATLAS sudah layak disebut Integrated Command Center?**
**Belum.** ATLAS adalah peta kesadaran situasi ditambah papan status. Pusat komando membutuhkan alur alert, acknowledgment, insiden, penugasan, dan audit, serta kepastian bahwa data yang tampil masih segar. Keduanya belum ada.

**B. Apakah ATLAS sudah layak dipakai di lingkungan produksi yang sensitif?**
**Belum.** Alasannya:
- Kredensial lemah tanpa MFA.
- Tidak ada deteksi kegagalan.
- Deploy belum terverifikasi.
- Data pencarian dan koordinat operator terkirim ke pihak ketiga.
- Bergantung pada internet publik.
- Ada pemalsuan IP terhadap penyedia data.

**C. Apa yang berfungsi, simulasi, atau belum ada?**
Lihat [Gap Analysis §3](ATLAS_FEATURE_GAP_ANALYSIS.md).
- **Berfungsi:** auth, RBAC, papan situasi, peta dengan feed publik, CCTV publik, AOI di browser.
- **Statis atau simulasi:** indikator ONLINE, lapsit karhutla, angka insiden, alert sebagai sekadar urutan tampilan.
- **Belum ada:** insiden, ack, komunikasi, IoT, WebRTC, rekaman, analitik video, MFA.

**D. Lima masalah paling kritis:** lihat §11.

**E. Langkah paling efisien tanpa rewrite total:**
1. Rotasi kredensial dan tambah CI (hari, bukan minggu).
2. Buat data jujur: `fetchedAt`, `stale`, status per sumber, indikator nyata.
3. Optimistic locking pada situasi.
4. MFA.
5. Pindahkan pengambilan feed ke satu worker yang menulis ke PostgreSQL, lalu bangun tabel Alert dan Incident di atasnya dengan push SSE.

Semua langkah memakai stack yang sudah ada.

### Kategori akhir: **PROTOTYPE**
Bisa naik ke **MVP / LIMITED PILOT** (cakupan: peta situasi dan papan status internal) setelah P0-01 sampai P0-03, P1-01, dan P1-07 selesai.
