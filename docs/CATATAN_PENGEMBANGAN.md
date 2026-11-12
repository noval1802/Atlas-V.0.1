# Catatan Pengembangan ATLAS

**Diperbarui:** 12 November 2026 · Indeks dokumen ada di [README.md](README.md).

Isi dokumen ini:
- timeline pengembangan per tahap;
- status semua temuan audit ulang;
- rencana tahap berikutnya.

Setiap ada perbaikan atau fitur baru, tambahkan barisnya di tahap yang sedang berjalan
dan perbarui tabel statusnya.

Tanda status: ✅ selesai · 🟡 sebagian · ⏳ terbuka · ➖ tidak berlaku (fiturnya dihapus)

---

## Tahap 0 — Basis OSIRIS (Mei–Sep 2026)

ATLAS berangkat dari **OSIRIS**, platform pemantauan global open source
(commit `b83294c` sampai `d972d9a`, sekitar 330 commit). Isinya: peta globe MapLibre,
CCTV dunia, pesawat, satelit, kapal (AIS), cuaca, gempa USGS, berita, perangkat OSINT/recon,
pasar, dan lain-lain. Sebagian besar fitur itu kemudian dipangkas di tahap 2 dan 5.

## Tahap 1 — ATLAS dan fondasi operasional (17–24 Okt 2026)

| Commit | Perubahan |
|---|---|
| `fa9848a`…`8f52c8e` | Ganti identitas menjadi ATLAS (label, share image, persona AI, layanan intel) |
| `938e1dc` | Login operator, dashboard operator, dan gerbang peta (`src/proxy.ts`) |
| `6b78ca0` | Kotamaops per matra dari database, peta berfokus NKRI |
| `446aa5a` | SPACE menjadi multiviewer CCTV |
| `d10c68e`…`8a6aba8` | Pengerasan keamanan: Next 16.4.3, auth, proxy CCTV, CSP, safeFetch, proxy tile |
| `a35eb66` | Dokumen perbaikan keamanan dan audit kesiapan monitoring nasional |

## Tahap 2 — Penyempitan cakupan dan deploy internal (27–28 Okt 2026)

| Commit | Perubahan |
|---|---|
| `cf23d73` | Palet gelap dan basemap untuk ruang operasi yang terang |
| `9c27781` | Hapus pasar, chain intel, Gemini AI dan modul di luar cakupan |
| `7e62735` | Hapus OSINT recon, layer siber, SDK, webhook, Style Studio dan halaman docs publik |
| `c8c2c83` | Deploy: HTTPS, migrasi, backup, readiness untuk stack compose |
| `a34ccdf` | Sistem internal tidak diindeks mesin pencari |
| `92cfc10` | Gempa dan peringatan cuaca dari BMKG |

## Tahap 3 — Audit teknis 29 Okt dan perbaikan P0 (29–30 Okt 2026)

| Commit | Perubahan |
|---|---|
| `b3c6477` | Audit teknis menyeluruh ([audit/atlas-2026-10-29/](audit/atlas-2026-10-29/)) |
| `547f807` | Kebijakan kata sandi, bootstrap admin hanya sekali (P0-02) |
| `2135def` | Rahasia dan isi repo tidak lagi ikut ke artefak build |
| `17cd4f2` | Rotasi SUPER_ADMIN yang aman dan pemulihan lokal |
| `48b7671`, `701f596`, `ec2fa04` | CCTV Indonesia pertama: BPJT, Kota Bandung, Gresik, Aceh, Semarang, Surakarta (HTTP-FLV); marker dan clustering |
| `9d7a88d` | Discovery UI untuk redesign ([ui-discovery/](ui-discovery/)) |
| `414ba45` | Manajemen pengguna V2 |
| `9eaab00`, `8ae95a0`, `be5387d` | Tampilan login baru dan logo ATLAS animasi |

## Tahap 4 — CCTV Indonesia (5–10 Nov 2026)

| Commit | Perubahan |
|---|---|
| `cf2ab8e` | Toggle CCTV Indonesia dipisah (KOTA, TOL, JAKARTA) + layer GLOBAL; region mati dibuang |
| `c0838be` | 15 sumber CCTV kota/provinsi baru (~1.000 kamera): Yogyakarta, Balangan, Bandung Barat, Jombang, Magelang, Kab. Tangerang, Bandar Lampung, Bukittinggi, Kota Cirebon, Medan, Palembang, Pekalongan, Serang, Tasikmalaya, dan lainnya; total 23 region Indonesia |
| `355a0e0` | AI chat, layer gunung api (MAGMA), vault sesi CCTV TPT Jakarta |

Aturan pengambilan data CCTV: hanya API/portal publik. Tidak menembus login, captcha,
Cloudflare/WAF, proof-of-work, sesi/tiket, atau API bertanda rahasia. Kunci publik
disimpan di `.env`, tidak di kode. Portal yang dilewati karena alasan ini antara lain
Banjar, Banyuwangi, Cilacap, Malang dan Tulungagung. Banjarbaru dan Depok sempat dibuat,
lalu dibatalkan karena stream-nya tidak bisa diputar lewat proxy.

## Tahap 5 — Audit ulang dan stabilisasi (11–12 Nov 2026)

| Commit | Perubahan |
|---|---|
| — | Audit ulang dengan debat 9 agent: 26 temuan dipertahankan (tabel di bawah) |
| `d1b3b69` | Gempa: waktu tampil di popup (WIB), gempa lama memudar dan tanpa label |
| `dc942ec` | **Fitur pesawat dan satelit dihapus seluruhnya.** Pesawat akan dibangun ulang memakai API resmi Flightradar24 (berbayar). Satelit tidak dipakai. Basemap citra satelit tetap ada. |
| *(belum di-commit)* | Login: admin tidak bisa dikunci orang lain (temuan 10) |
| *(belum di-commit)* | Pemutar kamera dihentikan saat ditutup; buffer video dibatasi (temuan 3 dan 11) |

### Status temuan audit ulang (11 Nov 2026)

Detail teknis temuan keamanan yang masih terbuka sengaja tidak ditulis di sini, karena repo ini publik.

**Harus diperbaiki**

| No | Temuan | Status |
|---|---|---|
| 1 | Proxy video HLS/TPT perlu membatasi jenis konten yang diteruskan | ⏳ |
| 2 | AI chat memakai model eksternal; perlu keputusan kebijakan dan flag aktif/nonaktif | ⏳ (menunggu keputusan) |
| 3 | Pemutar kamera tidak dihentikan saat viewer/tile ditutup | ✅ (belum di-commit) |
| 4 | Form situasi bisa menimpa edit operator lain tanpa peringatan | ⏳ |
| 5 | CCTV TPT Jakarta macet berkala dan mati saat portal error sebentar | ⏳ |
| 6 | Refresh data pesawat menahan permintaan | ➖ `dc942ec` |
| 7 | Satelit mengunduh ulang dari CelesTrak terus-menerus | ➖ `dc942ec` |
| 8 | Cache menyajikan data basi sebagai data segar | ⏳ |
| 9 | Gempa lama tampil seperti baru | ✅ `d1b3b69` |
| 10 | Akun admin bisa dikunci orang lain lewat batas login | ✅ (belum di-commit) |
| 11 | Buffer video multiview tumbuh tanpa batas | ✅ (belum di-commit) |
| 12 | `/api/gdelt-events` tanpa cache dan berat | ⏳ |
| 13 | AI chat rusak setelah satu jawaban panjang | ⏳ |
| 14 | Pemindahan operator antar-Kotamaops tidak tercatat di audit | ⏳ |

**Sebaiknya diperbaiki**

| No | Temuan | Status |
|---|---|---|
| 15 | Biaya AI chat tanpa batas harian dan tanpa timeout | ⏳ |
| 16 | Format kunci vault TPT belum didokumentasikan | ⏳ |
| 17 | Dokumen dan `.env.example` tertinggal dari kode | 🟡 env pesawat/satelit sudah dibuang; sisanya belum |
| 18 | Maritim: koneksi AIS putus tidak terdeteksi, posisi tidak valid ikut digambar | ⏳ |
| 19 | `/api/gdelt` menjawab kosong saat GDACS gagal | ⏳ |
| 20 | Tile kamera tidak pulih sendiri; mengubah daftar SPACE me-restart semua tile | ⏳ |
| 21 | Animasi Kotamaops membebani CPU/GPU layar dinding | ⏳ |
| 22 | Stream `http://` ditandai sehat padahal tidak bisa diputar di HTTPS | ⏳ |
| 23 | Tombol Share mengirim URL internal ke media sosial | ⏳ |
| 24 | Dokumen audit di repo publik memuat detail sensitif | 🟡 detail sensitif disamarkan 12 Nov; visibilitas repo dibiarkan (keputusan pemilik) |
| 25 | Tampilan audit hanya 80 baris tanpa filter | ⏳ |
| 26 | Kode, file dan dependensi mati | 🟡 sebagian ikut terhapus bersama pesawat/satelit |

## Tahap berikutnya

- Integrasi **Flightradar24** (API resmi berbayar). Kode pesawat lama bisa dijadikan acuan dari riwayat git (`d1b3b69` dan sebelumnya).
- Menyelesaikan temuan terbuka di atas, dimulai dari 1, 4 dan 8.
- Membuat pull request `feat/cctv-indonesia-and-global` ke `master`.
