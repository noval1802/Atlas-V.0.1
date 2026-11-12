# Audit ATLAS untuk Monitoring Situasi Nasional Pusdalops TNI

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).

> Isi audit di bawah adalah kondisi 24 Oktober 2026. Status terkini ditambahkan per butir dengan tanda ✅ Selesai · 🟡 Sebagian · ⏳ Belum · ➖ Tidak berlaku, beserta hash commit bila ada. Ringkasan perubahan sejak audit ada di bagian 7.

**Tanggal:** 24 Oktober 2026
**Objek:** repo `Atlas-V.0.1`, branch `feat/kotamaops-matra` (commit `74e5d8c`, ditambah perbaikan keamanan MEDIUM/LOW yang belum di-commit)
**Lingkup:** fitur, ketersediaan, keharusan sistem, dan keharusan UI. Audit keamanan ada di `docs/security/SECURITY_FINDINGS.md` dan tidak diulang di sini.
**Metode:** membaca kode dan konfigurasi, ditambah angka beban yang diukur sebelumnya. Aplikasi tidak diuji dengan akun per peran dan tidak dibuka di layar video wall. Butir yang belum diuji ditandai *belum diverifikasi*.

---

## 1. Ringkasan untuk pimpinan proyek

ATLAS saat ini adalah **dasbor OSINT global (warisan OSIRIS) yang ditempeli modul operasi TNI**. Modul TNI-nya sudah berdiri dengan baik: login dan peran, status situasi per Kotamaops beserta riwayat revisi, CCTV Jasa Marga dan Jakarta, multiviewer, serta data karhutla. Kira-kira 70% fitur lainnya adalah lapisan global yang tidak relevan untuk Pusdalops, misalnya pasar saham, kripto, CCTV luar negeri, konflik luar negeri, dan alat OSINT siber.

Ada empat celah besar sebelum sistem layak dipakai sebagai Monitoring Situasi Nasional:

| # | Celah | Akibat | Status (12 Nov) |
|---|---|---|---|
| 1 | **Belum ada satu pun sumber data nasional.** BMKG, BNPB, PVMBG/MAGMA, SiPongi, Basarnas, dan Bakamla semuanya belum terhubung. Gempa dan cuaca masih diambil dari USGS dan NWS (AS). | Peta "situasi nasional" belum menampilkan situasi nasional. | 🟡 BMKG (gempa, peringatan cuaca, `92cfc10`) dan MAGMA/PVMBG (gunung api, `cf2ab8e`, `355a0e0`) sudah terhubung. BNPB, SiPongi, Basarnas, Bakamla belum. |
| 2 | **Status situasi tidak tampil di peta**, dan belum ada tampilan ringkas untuk pimpinan. | Pimpinan tidak bisa melihat kondisi nasional dalam sekali pandang. | ⏳ Belum. |
| 3 | **Bergantung penuh pada layanan asing.** Peta dasar (CARTO), citra satelit (Esri), terrain (AWS), dan font (Google) semuanya dari luar. AI mengirim data ke Google Gemini. | Di jaringan tertutup peta dasar kosong. Area pandang operator dan kueri bocor ke pihak asing. | ⏳ Peta dasar, citra, terrain, dan font masih dari luar. Gemini sudah dicabut (`9c27781`), tetapi chat AI baru (`355a0e0`) mengirim teks ketikan operator ke LLM eksternal. |
| 4 | **Alur pelaporan baru sebatas angka.** Belum ada log kejadian, persetujuan berjenjang, ekspor laporan situasi (lapsit), maupun notifikasi eskalasi. | Belum mendukung kerja ruang operasi sehari-hari. | ⏳ Belum. |

Selain itu ada sejumlah keharusan operasional yang belum terpenuhi: TLS, backup database, healthcheck, migrasi saat deploy, dan CI/CD internal. *(12 Nov: TLS, backup, healthcheck, dan migrasi sudah dikerjakan di Tahap 1; CI/CD internal belum.)* `deploy.sh` dan workflow GitHub peninggalan OSIRIS masih mengarah ke server asing dan registry publik.

**Penilaian kesiapan** (subjektif, skala 1–5):

| Area | Nilai | Catatan |
|---|---|---|
| Fondasi akses dan data operasi | 4 | RBAC, revisi, dan audit login sudah ada. Keamanan sudah diaudit dan diperbaiki. |
| Kesesuaian fitur dengan misi | 2 | Inti TNI ada, tetapi sumber nasional belum ada dan banyak fitur tidak relevan. |
| Ketersediaan / operasi 24/7 | 2 | Belum ada backup, TLS, healthcheck aplikasi, maupun redundansi. |
| Kemandirian dari layanan asing | 1 | Peta dasar, font, dan AI semuanya asing. |
| UI ruang operasi | 2 | Tema gelap sudah ada. Masih campur Inggris, huruf terlalu kecil, dan status tidak tampil di peta. |

---

## 2. Audit fitur

### 2.1 Fitur yang dipertahankan (inti misi)

| Fitur | Lokasi | Catatan |
|---|---|---|
| Login, peran (6), persetujuan akun, reset sandi, audit login | `src/app/(id)/*`, `src/lib/ops/*` | SMTP diperlukan untuk reset sandi. `OPS_PUBLIC_URL` wajib diisi. |
| Status situasi per Kotamaops beserta revisi | `src/app/api/ops/situations`, `prisma/schema.prisma` | Isinya: status KONDUSIF/WASPADA/SIAGA, personel, dikerahkan, jumlah kejadian, dan catatan. |
| Dasbor operator | `src/app/(id)/operator`, `src/components/ops/operator-dashboard.tsx` | Menampilkan ringkasan, tabel, formulir, dan 20 revisi terakhir. |
| Manajemen pengguna | `src/app/(id)/pengguna` | Khusus admin. Hanya SUPER_ADMIN yang bisa mengubah SUPER_ADMIN. *12 Nov: UI V2 (`414ba45`), kebijakan sandi min. 12 (`547f807`), rotasi SUPER_ADMIN aman (`17cd4f2`).* |
| Layer Kotamaops (AD/AL/AU) | `src/lib/kotamaops-points.ts`, `public/kodam/` | Ada 22 satuan, yaitu 21 Kodam dan Kodaeral V. Satuan AU masih kosong. |
| CCTV Jasa Marga dan TPT Jakarta | `src/app/api/cctv/jasamarga.ts`, `tpt.ts` | Butuh `JASAMARGA_WFS_TOKEN` dan `TPT_CCTV_TOKEN`. Tanpa token, daftarnya kosong. *12 Nov: sesi TPT kini disimpan terenkripsi di DB (`355a0e0`). Ditambah ±21 sumber CCTV kota/provinsi Indonesia (`48b7671`, `ec2fa04`, `c0838be`), total ±23 sumber Indonesia.* |
| SPACE dan Multiviewer CCTV | `src/components/SpaceCam.tsx`, `/peta/multiview` | Tanpa batas jumlah kamera, dengan preset tata letak. |
| Gambar/AOI, pencarian lokasi, panel ArcGIS | `src/lib/aoi-export.ts`, `ArcGISPanel.tsx` | Panel ArcGIS bisa dipakai untuk memuat layer BNPB/InaRISK. |

### 2.2 Fitur yang perlu disesuaikan

| Fitur | Masalah | Arah penyesuaian | Status (12 Nov) |
|---|---|---|---|
| Karhutla | Angkanya **ditulis langsung di kode** (`src/lib/karhutla-lapsit.ts`) dari satu lapsit tanggal 5 Okt 2026. | Simpan di DB dan sediakan input operator. | ⏳ Masih snapshot 5 Okt di kode. |
| Gempa, kebakaran, cuaca | Diambil dari USGS, NASA FIRMS, NWS, dan GDACS. | Ganti dengan BMKG (gempa, cuaca, InaTEWS), SiPongi atau BRIN (hotspot), dan MAGMA (gunung api). | 🟡 Gempa dan peringatan cuaca dari BMKG (`92cfc10`); gempa menampilkan waktu WIB dan memudar sesuai usia (`d1b3b69`); gunung api MAGMA (`cf2ab8e`, `355a0e0`). Kebakaran masih FIRMS (semua hotspot Indonesia dipertahankan, `c0838be`); GDACS/EONET masih dipakai. Peringatan dini tsunami InaTEWS tersendiri belum (baru penanda potensi tsunami per gempa). |
| Pesawat (ADS-B), kapal (AIS) | Cakupan global, tanpa filter wilayah. AIS butuh `AIS_API_KEY`. | Batasi ke ruang udara dan perairan RI (ALKI, ZEE). Bila ada, pakai data milik TNI atau Bakamla. | Pesawat ➖ dihapus (`dc942ec`). AIS ⏳ belum dibatasi ke perairan RI. |
| Berita (IntelFeed, Live News) | Sumbernya media asing (BBC, Al Jazeera, TASS, dan lain-lain). | Ganti dengan Antara, TVRI, RRI, dan kanal instansi. | ⏳ Sumber asing masih ada. |
| AI briefing | Mengirim data ke Google Gemini. | Matikan, atau ganti dengan LLM on-prem. | 🟡 Gemini dicabut (`9c27781`), ringkasan kini heuristik lokal. Baru: chat AI operator ke LLM eksternal (`355a0e0`); belum on-prem. |
| Region dossier | Memakai Wikipedia berbahasa Inggris. | Ganti ke id.wikipedia atau data BPS. | ⏳ Masih en.wikipedia. |
| Dokumentasi `/docs` | Masih katalog API OSIRIS dalam bahasa Inggris. | Tulis ulang sebagai panduan pengguna ATLAS. | ✅ Halaman `/docs` publik dihapus (`7e62735`). Panduan pengguna ATLAS belum ditulis. |

### 2.3 Fitur yang dihapus atau disembunyikan

- **Tidak relevan** *(12 Nov: semua butir di bawah sudah dihapus, `9c27781`, kecuali CCTV luar negeri)*:
  - MarketsPanel (saham dan kripto).
  - CHAIN INTEL dan forensik dompet kripto.
  - TokenPanel `$OSIRIS`. Masih di-mount di `monitoring-dashboard.tsx:1253,1268` walaupun flag-nya dimatikan.
  - SupportMenu.
  - ScmPanel.
  - Konflik dan garis depan luar negeri (liveuamap, deepstatemap).
  - CCTV dari ±50 negara. *(12 Nov 🟡: dipindah ke layer GLOBAL yang dimuat sesuai permintaan, region yang mati dibuang, `cf2ab8e`.)*
  - Space weather.
  - Country risk.
  - Fasilitas nuklir.
- **Berisiko:**
  - ✅ **WorldRemote** (dihapus, `9c27781`). Fitur ini memindai port `127.0.0.1` dari browser dan memakai Web Bluetooth (`WorldRemote.tsx:85`). Perilaku seperti ini tidak pantas ada di sistem TNI. **Prioritas hapus.**
  - ✅ **Alat OSINT identitas dan port scanner** (dihapus, `7e62735`). Sejak perbaikan 24 Okt aksesnya sudah dibatasi ke Admin dan Operator (belum di-commit). Kueri tetap terkirim ke layanan asing, jadi perlu diputuskan apakah fitur ini memang wewenang Pusdalops.
  - **Kontainer `osiris-intel` dan adapter SDK "Polybolos/Anduril Lattice".** Keduanya tidak dipakai untuk misi. *(12 Nov 🟡: adapter SDK dihapus `7e62735`; kontainer `osiris-intel` masih ada di compose.)*

### 2.4 Data nasional yang belum ada

Hasil grep terhadap `bmkg|bnpb|inarisk|magma|pvmbg|basarnas|bakamla|sipongi` adalah **nol**. *(12 Nov: kini BMKG dan MAGMA/PVMBG sudah ada; sisanya masih nol.)*

| Sumber | Kegunaan | Prioritas | Status (12 Nov) |
|---|---|---|---|
| BMKG | Gempa terkini, peringatan dini cuaca, InaTEWS tsunami | WAJIB | 🟡 Gempa dan peringatan dini cuaca ✅ (`92cfc10`); InaTEWS tsunami tersendiri belum. |
| BNPB (InaRISK, DIBI, data kejadian bencana) | Kejadian bencana dan wilayah rawan | WAJIB | ⏳ |
| PVMBG / MAGMA Indonesia | Status gunung api (Normal/Waspada/Siaga/Awas) | WAJIB | ✅ `cf2ab8e`, `355a0e0` |
| SiPongi KLHK, hotspot BRIN | Karhutla otomatis, menggantikan data hardcode | WAJIB | ⏳ |
| Batas administrasi (BIG), provinsi, ZEE, ALKI | Layer dasar wilayah | WAJIB | ⏳ |
| Basarnas | Operasi SAR | SEBAIKNYA | ⏳ |
| Bakamla, AIS perairan RI | Keamanan laut | SEBAIKNYA | ⏳ |
| Data banjir (BBWS, Posko Banjir) | Bencana hidrometeorologi | SEBAIKNYA | ⏳ |
| Satuan AL/AU lengkap (Koarmada, Koopsud, Kogabwilhan), Korem/Kodim | Kelengkapan struktur satuan | SEBAIKNYA | ⏳ |

### 2.5 Alur pelaporan situasi: kondisi sekarang dan kekurangannya

**Kondisi sekarang:**
- **Data.** Setiap Kotamaops punya satu baris situasi terkini. Setiap simpanan menulis revisi dalam satu transaksi.
- **Hak tulis.** Admin dan Operator Pusdalops boleh menulis untuk semua satuan. Operator Kodam hanya untuk satuannya sendiri. Analis dan Pimpinan hanya bisa membaca.
- **Waktu.** Disimpan dalam UTC dan ditampilkan dalam WIB saja.

**Belum ada** *(12 Nov: ketujuh butir masih ⏳)*:
1. **Log kejadian.** Belum ada catatan per kejadian dengan waktu, koordinat, kategori, korban, sumber, lampiran foto/dokumen, dan status tindak lanjut. Saat ini hanya ada `incidentCount`.
2. **Rantai komando.** Belum ada alur draf → verifikasi Pusdalops → persetujuan pimpinan.
3. **Laporan situasi harian.** Belum ada ekspor PDF/DOCX berformat dinas atau rekap pukul 06.00/18.00.
4. **Notifikasi eskalasi.** Perubahan status ke WASPADA/SIAGA tidak memicu notifikasi apa pun, dan belum ada konfirmasi baca.
5. **Buku piket.** Belum ada catatan serah terima shift.
6. **Riwayat dan tren.** Riwayat lengkap per satuan, filter tanggal, dan grafik tren status belum ada.
7. **Zona waktu.** Waktu belum ditampilkan dalam WITA/WIT sesuai lokasi satuan.

---

## 3. Audit ketersediaan

### 3.1 Ketergantungan layanan luar

Kode menghubungi sekitar 150 host luar. Yang paling menentukan:

| Host | Fungsi | Jika tidak terjangkau |
|---|---|---|
| `*.basemaps.cartocdn.com` (CARTO, AS) | Tile vektor, glyph label, sprite ikon, style | **Peta dasar kosong** |
| `server.arcgisonline.com` (Esri, AS) | Mode citra satelit | Mode satelit kosong |
| `s3.amazonaws.com/elevation-tiles-prod` (AWS) | Terrain 3D | Terrain mati |
| `fonts.googleapis.com` / `gstatic` | Font | Halaman tertahan sampai timeout, lalu memakai font sistem |
| ~~Gemini (`ai-engine.ts`)~~ | AI briefing | ➖ Dicabut (`9c27781`). *Baru 12 Nov:* chat AI operator memanggil LLM eksternal (`355a0e0`); tanpa akses, chat tidak tersedia. |
| USGS, FIRMS, GDACS, NWS, OpenSky, adsb.*, aisstream | Feed situasi | Layer terkait kosong. *12 Nov: USGS/NWS diganti BMKG (`92cfc10`), OpenSky/adsb.* dihapus (`dc942ec`); ditambah BMKG, MAGMA, dan ±23 portal CCTV daerah.* |
| Nominatim, Photon, OSRM, Valhalla | Pencarian lokasi dan rute | Pencarian dan rute gagal |
| nginx `resolver 1.1.1.1 8.8.8.8` | DNS untuk tile cache | Di intranet cache tidak bisa terisi |

**Di jaringan tertutup** yang tetap jalan hanya login, data situasi, dasbor operator, manajemen pengguna, dan mesin peta MapLibre (sudah dibundel). Peta dasar dan hampir semua feed mati.

### 3.2 Resiliensi

| Aspek | Kondisi | Bukti |
|---|---|---|
| Health check | ✅ *12 Nov: `/api/health/ready` memeriksa DB (`c8c2c83`).* `/api/health` hanya menyatakan proses hidup (`checks_performed: 'none'`) dan tidak memeriksa DB. | `src/app/api/health/route.ts` |
| Healthcheck Docker | ✅ *12 Nov: app dan nginx punya healthcheck, `depends_on` menunggu sehat (`c8c2c83`).* Hanya ada untuk Postgres dan intel. **Kontainer app dan nginx tidak punya.** `depends_on` juga tidak menunggu DB sehat. | `docker-compose.yml` |
| Titik kegagalan tunggal | Satu kontainer app, satu nginx, satu Postgres tanpa replika, satu host. | `docker-compose.yml` |
| DB mati | Semua sesi gagal, sehingga **semua pengguna terlempar ke halaman login**. Aman, tetapi berarti sistem mati total. Penulisan audit gagal tanpa jejak. | `src/lib/ops/gate.ts`, `audit.ts` |
| State di memori | ⏳ *12 Nov: belum berubah.* Rate limit, sekitar 38 cache `Map`, stream SSE, dan WebSocket AIS tidak bisa dibagi ke lebih dari satu instance. | `src/lib/ops/rate-limit.ts` |
| Timeout upstream | Baik. Hampir semua fetch memakai `AbortSignal.timeout`. CCTV dibatasi 5 MB dan 3 redirect. | — |
| Cache | ⏳ *12 Nov: `TILE_PROXY_PATH` masih dikomentari di `.env.example`.* nginx hanya meng-cache tile, dan **`TILE_PROXY_PATH` belum diaktifkan**, sehingga tile masih lewat Node. | `.env.example` |
| Compose | ✅ *12 Nov: diperbaiki di Tahap 1 (`c8c2c83`).* Wajib ada network eksternal `umami_default`; tanpa itu `up` gagal. Port 3000 terbuka langsung tanpa melewati nginx. Password Postgres punya default `change-me`. | `docker-compose.yml` |

### 3.3 Kapasitas

Angka acuan dari pengukuran sebelumnya, satu proses Node: `/api/health` 316 req/s, `/masuk` 145 req/s, tile dari cache nginx sekitar 640 req/s, memori 137–423 MB, JS klien sekitar 1,1 MB gzip.

- **50–200 pengguna:** perkiraan beban 35–65 req/s. Satu instance masih cukup, tetapi tanpa cadangan.
- **CCTV:** tidak ada cache bersama. Contoh: 20 layar × 16 kamera dengan refresh 5 detik ≈ 64 req/s, masing-masing sampai 5 MB lewat Node. Perlu micro-cache di nginx atau relay stream (misalnya MediaMTX).
- **Sesi:** sesi standar berlaku 8 jam, sehingga layar video wall akan keluar sendiri di tengah shift.
- **Spesifikasi minimum yang disarankan:** app 4 vCPU / 8 GB; Postgres 2 vCPU / 4 GB dengan SSD dan volume backup terpisah; disk tile minimal 20 GB. Atau gunakan PMTiles Indonesia (perkiraan 1–3 GB, *belum diverifikasi*). Klien video wall perlu GPU dengan dukungan WebGL2.

---

## 4. Keharusan sistem

### WAJIB (sebelum dipakai di Pusdalops)

| # | Keharusan | Kondisi sekarang / bukti | Status (12 Nov) |
|---|---|---|---|
| S1 | **Peta dasar, glyph, sprite, terrain, dan font di-host sendiri** (PMTiles/OpenMapTiles wilayah Indonesia, font lewat `next/font/local`). | Semuanya dari CARTO, Esri, AWS, dan Google (`public/dark-matter-style.json`, `OsirisMap.tsx`, `terrain-tiles.ts`, `globals.css:1`). | ⏳ Belum. |
| S2 | **Tidak ada data operasi yang keluar ke layanan asing.** Matikan Gemini atau ganti dengan LLM on-prem. Tinjau feed OSINT dan geocoder. | `src/lib/ai-engine.ts`, `/api/osint/*`, `/api/geo` | 🟡 Gemini dicabut (`9c27781`), OSINT dihapus (`7e62735`). Sisa: geocoder/rute luar, dan chat AI baru ke LLM eksternal (`355a0e0`). |
| S3 | **HTTPS dengan sertifikat CA internal.** Tutup port 3000 dan port 8080 HTTP. | nginx hanya `listen 8080` tanpa TLS. Cookie produksi bertanda `Secure`, sehingga login lewat `http://IP` kemungkinan gagal (*belum diverifikasi*). | 🟡 HTTPS 8443 aktif (`c8c2c83`) dengan sertifikat self-signed sementara; sertifikat CA internal belum. |
| S4 | **Backup Postgres terjadwal yang diuji restore-nya**, disimpan di lokasi terpisah. | Belum ada sama sekali. | 🟡 `pg_dump` harian + restore teruji (`c8c2c83`); penyimpanan di lokasi terpisah belum. |
| S5 | **Compose diperbaiki:** `DATABASE_URL` diarahkan ke `osiris-postgres`, `depends_on: service_healthy`, network `umami_default` dihapus, password Postgres tanpa nilai default, healthcheck untuk app dan nginx. | `.env` lokal menunjuk ke `127.0.0.1`, alamat yang tidak berlaku dari dalam kontainer. | ✅ `c8c2c83` |
| S6 | **Health check kesiapan** yang memeriksa koneksi DB. | `/api/health` tidak memeriksa apa pun. | ✅ `c8c2c83` |
| S7 | **Migrasi DB otomatis saat deploy** (`prisma migrate deploy`). | Image runner tidak membawa Prisma CLI maupun folder migrasi (`Dockerfile`). | ✅ `c8c2c83` |
| S8 | **Data seed fiktif diganti data riil** atau ditandai jelas sebagai contoh. | Angka personel dan status di `prisma/seed.mjs:9-31` adalah karangan. | ✅ `1338385` |
| S9 | **Hapus jalur deploy warisan OSIRIS** dan ganti dengan CI/CD internal (test dan lint sebelum build, registry privat). | `deploy.sh` melakukan SSH ke server pihak lain lalu `docker-compose down` (ada downtime). `.github/workflows/docker-publish.yml` mem-push image ke ghcr.io publik. | 🟡 `deploy.sh` dihapus dan workflow ghcr hanya manual (`c8c2c83`); CI/CD internal belum. |
| S10 | **Rotasi log dan pemantauan disk.** | `logging:` tidak diatur di compose. | 🟡 Rotasi log ✅ (`c8c2c83`); pemantauan disk belum. |
| S11 | **Sumber data nasional** (BMKG, BNPB, MAGMA, SiPongi, batas wilayah BIG). | Lihat bagian 2.4. | 🟡 BMKG dan MAGMA ✅; BNPB, SiPongi, batas wilayah BIG belum. |

### SEBAIKNYA

| # | Keharusan | Status (12 Nov) |
|---|---|---|
| S12 | Pindahkan rate limit dan cache ke Redis/Postgres agar aplikasi bisa dijalankan lebih dari satu instance. | ⏳ |
| S13 | Siapkan replika atau standby Postgres. Saat DB mati, tampilkan "mode terbatas" alih-alih melempar semua pengguna ke login. | ⏳ |
| S14 | Logging terstruktur, metrik, dan alert (Prometheus/Grafana/Loki). Penulisan audit yang gagal harus memicu alarm. | ⏳ |
| S15 | Kebijakan retensi dan arsip untuk `AuthAudit` dan `SituationRevision`, yang sekarang tumbuh tanpa batas. | ⏳ |
| S16 | NTP internal di semua host. `TZ` didokumentasikan. | ⏳ |
| S17 | Micro-cache atau relay CCTV. Aktifkan `TILE_PROXY_PATH=/proxy/tiles`. | ⏳ |
| S18 | Rahasia disimpan di Docker secrets atau vault. Lengkapi `.env.example` (`OSIRIS_CCTV_SNAPSHOT`, `OSIRIS_NOMINATIM_*`, `INTEL_PORT`, `GEMINI_API_KEY_2..n`). | ⏳ |
| S19 | Kebijakan sesi untuk akun video wall dan shift 24 jam. | ⏳ |

### OPSIONAL

| # | Keharusan | Status (12 Nov) |
|---|---|---|
| S20 | Uji end-to-end (Playwright) untuk login, peta, dan pelaporan. Saat ini ada 114 file unit test tanpa e2e. | ⏳ (kini 135 berkas unit test, plus tes DB untuk seed/pemulihan admin/vault TPT; e2e belum) |
| S21 | Deploy blue-green tanpa downtime. | ⏳ |
| S22 | Hapus modul yang tidak relevan untuk memperkecil permukaan serangan dan ukuran JS. | 🟡 Banyak modul dihapus (`9c27781`, `7e62735`, `dc942ec`); CCTV luar negeri dan `osiris-intel` masih ada. |

---

## 5. Keharusan UI

### 5.1 Temuan utama

- **Bahasa campuran.** Bagian `(id)` (operator, pengguna, login) sudah berbahasa Indonesia. Bagian `/peta` sebagian besar masih Inggris dan dirender dengan `lang="en"` (`src/app/(en)/layout.tsx:10`). Perkiraan jumlah string Inggris: `OsirisMap.tsx` ±143, `WorldRemote.tsx` ±128, `monitoring-dashboard.tsx` ±79, `OsintPanel.tsx` ±72, `LiveAlerts`/`LayerPanel`/`FingerprintSearch` ±40 masing-masing. Contohnya "M… EARTHQUAKE", "AWAITING INTELLIGENCE...", dan nama layer AVIATION/MARITIME/HAZARD/THREAT.
- **Istilah.** Label peran masih "Viewer" dan "Monitoring" (`src/lib/ops/access.ts:56-61`). Kata "Kodam" dan "Provinsi" tidak muncul di UI peta.
- **Status tidak terlihat di peta.** `/peta` memuat Kotamaops tanpa status situasi (`src/app/(en)/peta/page.tsx`). Beranda PIMPINAN adalah `/peta`, jadi pimpinan tidak langsung melihat siaga atau waspada.
- **Huruf terlalu kecil untuk ruang operasi.** Ada 257 kelas `text-[6–9px]` di komponen dan 72 popup dengan `font-size` 7–9px. Hampir tidak ada skala responsif untuk layar besar: hanya 1 `clamp()` dan 2 breakpoint `2xl:`.
- **Jam.** `/peta` dan `/operator` sudah menampilkan WIB (`dashboard-chrome.tsx` `WibClock`). Jam tiga zona WIB/WITA/WIT baru ada di halaman login (`zone-clocks.tsx`). CameraViewer masih memakai UTC "Z" (`CameraViewer.tsx:25`).
- **Pembaruan data.** `/operator` hanya mem-poll `/api/health` tiap 60 detik. **Tabel situasi tidak diperbarui otomatis** dan tidak ada stempel "diperbarui pukul …".
- **Video wall.** Tema gelap sudah konsisten. Sudah ada fullscreen (`F`) di peta dan multiviewer. Belum ada mode kiosk (tanpa chrome, rotasi panel, Wake Lock) dan belum ada preset multiviewer yang disimpan per ruang.
- **Sisa OSIRIS.** Metadata SEO OSINT (`site-metadata.ts:20-40`), `manifest.json` memakai `osiris-icon.png`, `og-image` bergambar Mata Horus "OPEN SOURCE", log `[OSIRIS]`, dan tiga screenshot di `docs/screenshots` masih tampilan OSIRIS. Belum ada identitas Pusdalops TNI.
- **Konsistensi visual.** Ada 1.066 kode warna hex langsung di komponen, padahal token warna tersedia di `globals.css`. Popup peta masih string HTML dengan style inline.
- **Aksesibilitas.** Bagian ops sudah baik: target sentuh 44px, outline 2px, dan `role=status`. Di komponen peta baru ada 67 `aria-label` untuk 179 tombol. Status di dasbor sudah memakai teks, tidak hanya warna. Layer peta masih dibedakan hanya dengan warna.

### 5.2 Daftar keharusan UI

**WAJIB**

| # | Keharusan | Bukti | Status (12 Nov) |
|---|---|---|---|
| U1 | Warna dan label KONDUSIF/WASPADA/SIAGA tampil di setiap titik Kotamaops pada peta, lengkap dengan legenda dan filter matra. | `peta/page.tsx` tidak membaca `situation` | ⏳ |
| U2 | **Dasbor pimpinan satu layar:** peta status nasional, jumlah satuan Siaga/Waspada, kejadian terbaru, dan waktu pembaruan terakhir. | `homeForRole` mengarahkan PIMPINAN ke `/peta` tanpa status | ⏳ |
| U3 | Bahasa Indonesia penuh di `/peta`, semua popup dan panel, dan `lang="id"`. | `(en)/layout.tsx:10`, `OsirisMap.tsx`, `LayerPanel.tsx:82-152` | ⏳ |
| U4 | Ukuran huruf minimum sekitar 12px di meja operator dan sekitar 16px (atau skala fluida) di video wall. | 257 `text-[6–9px]`, 72 `font-size` 7–9px di popup | ⏳ |
| U5 | Data situasi diperbarui otomatis, dengan stempel "Diperbarui HH.MM WIB" dan tanda data basi saat feed gagal. | `operator-dashboard.tsx:87-100` | ⏳ `/operator` masih hanya mem-poll `/api/health`. |
| U6 | Jam WIB/WITA/WIT di `/peta` dan `/operator`. Hapus jam UTC di CameraViewer. Komponen `ZoneClocks` bisa dipakai ulang. | `zone-clocks.tsx`, `CameraViewer.tsx:25` | ⏳ CameraViewer masih jam UTC "Z"; `ZoneClocks` hanya di halaman masuk. |
| U7 | Hapus fitur dan branding yang tidak relevan: TokenPanel, SupportMenu, MarketsPanel, WorldRemote, docs OSINT, metadata SEO, ikon dan og-image OSIRIS. Ganti dengan identitas Pusdalops TNI. | Bagian 2.3, `site-metadata.ts`, `manifest.json` | 🟡 Modul tak relevan dihapus (`9c27781`, `7e62735`); logo ATLAS animasi (`be5387d`). Lambang resmi Pusdalops TNI belum. |

**SEBAIKNYA**

| # | Keharusan | Status (12 Nov) |
|---|---|---|
| U8 | Mode kiosk/video wall: rute tanpa chrome, rotasi panel otomatis, tata letak 1080p dan 4K, Wake Lock. | ⏳ |
| U9 | Preset multiviewer yang disimpan per ruang/dinding dan bisa dipakai bersama, tidak hanya per browser. | ⏳ |
| U10 | Token warna status (`--status-kondusif/waspada/siaga`) menggantikan hex langsung. Popup peta diubah jadi komponen. | ⏳ |
| U11 | State error, kosong, dan memuat diseragamkan dalam Bahasa Indonesia, termasuk `ErrorBoundary` dan LiveAlerts. | ⏳ |
| U12 | Label peran berbahasa Indonesia, misalnya "Pimpinan" dan "Peninjau". | ⏳ Label masih "Viewer"/"Monitoring". |
| U13 | Rel tombol kanan peta dijadikan satu komponen, dengan focus ring yang lebih tebal. | ⏳ |
| U14 | Formulir log kejadian dan tampilan riwayat per satuan (pasangan UI untuk bagian 2.5). | ⏳ |

**OPSIONAL**

| # | Keharusan | Status (12 Nov) |
|---|---|---|
| U15 | Mode kontras tinggi atau mode terang untuk ruangan yang terang. | ⏳ |
| U16 | Penanda bentuk/ikon di layer, tidak hanya warna. | ⏳ |
| U17 | Peta choropleth 38 provinsi. Data batas provinsi belum ada di repo. | ⏳ |
| U18 | Pratinjau cetak lapsit langsung dari dasbor pimpinan. | ⏳ |

---

## 6. Usulan urutan pengembangan

| Tahap | Isi | Butir | Status (12 Nov) |
|---|---|---|---|
| **0. Bersih-bersih** (±1 minggu) | Hapus WorldRemote, TokenPanel, Markets, kripto, CCTV luar negeri, jalur deploy OSIRIS, dan sisa branding. Hentikan Gemini. Commit perbaikan keamanan yang tertunda. | U7, S2, S9, S22 | 🟡 Sebagian besar ✅ (lihat 7); CCTV luar negeri dan logo resmi tertunda. |
| **1. Fondasi operasi** | TLS, perbaikan compose, healthcheck DB, migrasi otomatis, backup terjadwal, rotasi log, data seed riil. | S3–S8, S10 | 🟡 ✅ kecuali sertifikat CA internal dan uji `docker compose up` sungguhan. |
| **2. Peta mandiri** | Tile vektor, glyph, sprite, terrain, dan font Indonesia di-host sendiri. Tambah layer batas wilayah BIG. | S1, S11 | ⏳ |
| **3. Situasi nasional di layar** | Status Kotamaops di peta, dasbor pimpinan, auto-refresh, jam tiga zona, Bahasa Indonesia penuh, ukuran huruf. | U1–U6 | ⏳ |
| **4. Data nasional** | Integrasi BMKG (gempa, cuaca, InaTEWS), MAGMA, BNPB, SiPongi/BRIN. Karhutla diinput ke DB. | S11, 2.4 | 🟡 BMKG dan MAGMA ✅; BNPB, SiPongi/BRIN, karhutla di DB belum. |
| **5. Alur kerja Pusdalops** | Log kejadian, persetujuan berjenjang, ekspor lapsit PDF, notifikasi eskalasi, buku piket. | 2.5, U14 | ⏳ |
| **6. Ruang operasi** | Mode kiosk, preset multiviewer bersama, relay CCTV, observability, multi-instance. | U8, U9, S12–S19 | ⏳ |

## 7. Status pelaksanaan

### Tahap 0: bersih-bersih (24 Okt 2026)

**Selesai:**
- **Dihapus:** WorldRemote (pemindaian port lokal dan Bluetooth), TokenPanel `$OSIRIS`, SupportMenu, MarketsPanel/MarketChart beserta `/api/markets`, CHAIN INTEL/ChainBrief beserta `/api/chain/daily`, `/api/osint/crypto` dan `/api/crypto`, ScmPanel beserta `/api/scm-suppliers`, layer konflik luar negeri (`/api/conflicts`, `/api/frontlines`), layer fasilitas nuklir (`/api/infrastructure`), space weather (`/api/space-weather`), dan `/api/country-risk`. Ticker kripto di bar bawah (panggilan langsung ke CoinGecko dari browser) juga dihapus.
- **Gemini dimatikan.** `/api/ai/analyze` dan `/api/ai/briefing` dihapus, `/api/ai/overview` hanya memakai analis heuristik di server, dan dependensi `@google/generative-ai` dicabut.
- **Deploy.** `deploy.sh` dihapus. Workflow `docker-publish.yml` hanya bisa dipicu manual.
- **Branding dan metadata.**
  - Kata kunci SEO OSINT dan Open Graph dihapus.
  - Mesin pencari dilarang mengindeks (`robots` noindex, `robots.txt` Disallow semua).
  - `manifest.json`, `og-image.png`, `osiris-icon.png`, `casaos-icon.png`, screenshot OSIRIS, dan metadata CasaOS di compose dihapus.
  - README dan DOCKER.md ditulis ulang untuk ATLAS.

**Belum (ditunda sesuai keputusan):**
- **CCTV luar negeri** tetap dipertahankan untuk sementara.
- **Halaman `/docs`** masih katalog API berbahasa Inggris. Akan ditulis ulang saat Tahap 3 (Bahasa Indonesia).
- **Logo dan lambang Pusdalops TNI** belum dipasang karena file resminya belum tersedia. Favicon lama masih dipakai.

### Tahap 1: fondasi operasi (24 Okt 2026)

**Selesai:**
- **Compose (S5).**
  - Aplikasi memakai `osiris-postgres:5432`.
  - `depends_on` menunggu layanan sehat.
  - Network `umami_default` dihapus.
  - Password Postgres wajib diisi, tanpa default.
  - Port aplikasi hanya `127.0.0.1`.
  - Rotasi log 5 × 10 MB di semua layanan (S10).
- **Health check (S6).**
  - `/api/health/ready` memeriksa koneksi Postgres dengan timeout 3 detik dan menjawab 503 bila gagal.
  - Healthcheck sekarang ada untuk aplikasi dan nginx.
- **Migrasi (S7).** Stage `migrator` dan layanan `osiris-migrate` menjalankan `prisma migrate deploy` dan seed sebelum aplikasi start.
- **TLS (S3).**
  - nginx melayani HTTPS di 8443 (TLS 1.2/1.3, HTTP/2), dan 8080 dialihkan ke HTTPS.
  - Sertifikat sementara dibuat dengan `ops/tls/self-signed.sh`.
- **Backup (S4).**
  - Layanan `osiris-backup` membuat `pg_dump` harian dengan retensi 14 hari.
  - `ops/backup/restore.sh` menolak file rusak sebelum menyentuh database.
- **Seed (S8).** Angka personel dan status fiktif dihapus. Baris baru dibuat dengan catatan "Belum ada laporan", dan baris yang sudah ada tidak ditimpa.

**Diverifikasi:**
- Backup lalu restore ke database percobaan memberi jumlah baris yang identik.
- Retensi menghapus dump berumur lebih dari 14 hari.
- Konfigurasi nginx lulus `nginx -t`.
- nginx dijalankan lokal di depan dev server: redirect 301, HTTPS dengan HTTP/2, readiness 200, login same-origin lolos, dan origin asing 403.

**Belum diverifikasi:** `docker compose up` sungguhan, karena Docker tidak tersedia di mesin pengembangan.

**Catatan:** database lokal pengembangan masih berisi angka contoh dari seed lama, karena seed tidak menimpa baris yang ada.

### Pembaruan 24 Okt – 12 Nov 2026

**Selesai / berubah:**
- **Data nasional:** gempa dan peringatan dini cuaca dari BMKG, menggantikan USGS dan NWS (`92cfc10`). Gempa menampilkan waktu WIB, memudar sesuai usia, dan ringkasan alert mengutamakan gempa ≤72 jam (`d1b3b69`). Layer gunung api MAGMA/PVMBG dengan laporan per gunung (`cf2ab8e`, `355a0e0`).
- **Penghapusan modul:** OSINT recon, layer siber, adapter SDK, webhook, Style Studio, dan halaman `/docs` publik (`7e62735`). Pelacakan pesawat dan satelit dihapus (`dc942ec`); data pesawat direncanakan lewat API Flightradar24 berbayar. Mode citra satelit peta dasar tetap ada.
- **CCTV Indonesia:** BPJT dan Kota Bandung (`48b7671`); Gresik, Aceh, Semarang, Surakarta dengan HTTP-FLV (`ec2fa04`); 15 sumber kota/provinsi lain (`c0838be`). Total ±23 sumber Indonesia. Panel dipecah GLOBAL/TOL/KOTA/JAKARTA, region luar negeri yang mati dibuang, dan server memeriksa kesehatan stream (`cf2ab8e`). Sesi TPT Jakarta disimpan terenkripsi di DB (`355a0e0`).
- **Akun:** kebijakan sandi minimum 12 dan bootstrap admin sekali jalan (`547f807`); rotasi SUPER_ADMIN dengan konfirmasi dan pemulihan lokal, panduan di `docs/ops/ROTASI_SUPER_ADMIN.md` (`17cd4f2`); UI Pengguna V2 (`414ba45`).
- **Build:** pemeriksaan isi artefak build (`2135def`).
- **Identitas:** logo ATLAS animasi menggantikan ikon mata (`be5387d`).
- **Baru, perlu keputusan:** chat AI operator (`/api/ai/chat`, `355a0e0`) memanggil LLM eksternal. Hanya teks ketikan operator yang dikirim, tanpa data situasi, tetapi tetap bertentangan dengan arah S2 (tanpa data keluar ke layanan asing) sampai ada keputusan kebijakan atau LLM on-prem.

**Di working tree (belum di-commit):** teardown player video saat penampil ditutup, dan penyesuaian rate limit login.

**Masih terbuka (utama):** U1–U6 (status di peta, dasbor pimpinan, Bahasa Indonesia, ukuran huruf, auto-refresh, jam tiga zona), alur pelaporan 2.5, peta mandiri S1, sumber BNPB/SiPongi/BIG, CI/CD internal, sertifikat CA internal, backup di luar host, dan uji `docker compose up` sungguhan.

## 8. Batasan audit

- Aplikasi tidak diuji dengan akun per peran dan tidak dicoba di layar 1080p atau 4K maupun video wall.
- Jumlah string Inggris dan kelas huruf kecil adalah hitungan grep kasar.
- Perilaku di jaringan tertutup disimpulkan dari daftar host dalam kode, belum diuji di lingkungan air-gapped.
- Perkiraan kapasitas dan ukuran PMTiles adalah estimasi, belum diuji beban.
- Audit dikerjakan oleh tiga auditor paralel (fitur, sistem, UI) lalu digabung. Klaim kritis diverifikasi ulang: `deploy.sh`, workflow ghcr, `/api/health`, TLS, Dockerfile, seed, `DATABASE_URL`, dan jam WIB.
