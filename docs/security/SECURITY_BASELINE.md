# ATLAS Security Baseline

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).
**Produk:** ATLAS — Advanced Tactical Location & Analytics System
**Repositori:** `/home/localhost/osiris`
**Tanggal:** 2026-10-17
**Status:** catatan tinjauan manual. Bukan sertifikasi keamanan.

Dokumen ini adalah kebijakan kerja untuk kode baru dan perubahan kode. Menyelesaikan checklist tidak membuat aplikasi tersertifikasi aman. Build yang hijau dan unit test yang lulus juga tidak membuktikan seluruh kontrol aman.

Kebijakan pengungkapan kerentanan tetap di `SECURITY.md` pada root repositori. Ringkasan akses endpoint yang sedang berjalan ada di `docs/akses-endpoint.md`. Checklist, temuan, dan template fitur ada di folder ini.

## Ruang lingkup

Baseline ini mencakup autentikasi, RBAC, API, dasbor monitoring, CCTV, OSINT [➖ dihapus 7e62735], integrasi AI, pemrosesan dokumen, database, dan deployment pada aplikasi peta ini. Pusat komando di `/home/localhost/Project/atlas` adalah sistem terpisah dan tidak dicakup dokumen ini.

Nama teknis yang sudah dipakai tetap sampai ada audit migrasi tersendiri: cookie `osiris_ops`, database `osiris_ops`, dan nama environment variable yang ada. Jangan mengganti nama itu hanya agar dokumen terlihat seragam.

## Prinsip

1. Keputusan autentikasi dan otorisasi ada di server. Menu yang disembunyikan di antarmuka bukan proteksi.
2. Setiap endpoint baru punya keputusan eksplisit: publik, sesi saja, atau peran tertentu. Default untuk data monitoring adalah sesi wajib.
3. Peran, unit Kotamaops, status akun, dan identitas tidak diambil dari body atau query klien.
4. Kegagalan kontrol keamanan menolak akses.
5. Rahasia tidak masuk source, dokumentasi, fixture, atau file contoh. Contoh konfigurasi memakai placeholder kosong.
6. Password, cookie sesi, token reset, token CCTV, dan API key tidak ditulis ke log.
7. Isi dokumen unggahan dan keluaran model AI adalah data tidak tepercaya. Agen tidak mengubah schema atau menjalankan migrasi produksi tanpa review dan persetujuan.
8. Perubahan dipisah menurut risiko. Jangan menonaktifkan kontrol agar fitur jalan.
9. Checklist diperbarui hanya untuk item yang bukti barunya benar-benar diperiksa.

## Kontrol yang wajib dipertimbangkan

### A. Autentikasi dan sesi

**Status:** 🟡 Sebagian — sisa AUTH-02, AUTH-06, AUTH-09.

Login, hash password, batas percobaan, dan pesan gagal diverifikasi di server. Sesi punya masa berlaku dan dapat dibatalkan. Logout, ganti password, reset, dan pencabutan akses memutus sesi lama. Password dan token autentikasi tidak disimpan plaintext.

### B. Otorisasi dan RBAC

**Status:** 🟡 Sebagian — sisa RBAC-01, RBAC-02.

Otorisasi memeriksa peran, unit, kepemilikan objek, dan status akun. Uji akses horizontal, vertikal, IDOR, dan eskalasi sebelum fitur dianggap selesai. Least privilege. Endpoint baru tidak mewarisi akses hanya karena berada di bawah path yang sudah ada.

### C. API dan input

**Status:** 🟡 Sebagian — sisa API-05.

Validasi body, query, parameter, header, enum, panjang, ukuran, dan tipe. Batasi laju, ukuran, pagination, dan metode HTTP sesuai kebutuhan. Cegah injection, mass assignment, SSRF, path traversal, dan kebocoran detail internal. Pesan error aman dan konsisten.

### D. Database dan logika bisnis

**Status:** ✅ Selesai — DATA-01 sampai DATA-04.

Query terparameterisasi. Operasi baca dan tulis sensitif memeriksa otorisasi lagi di handler, tidak hanya di proxy. Nilai race, replay, dan transaksi. Migrasi ditinjau sebelum dijalankan dan tidak dijalankan tanpa persetujuan.

### E. Frontend dan browser

**Status:** ✅ Selesai — WEB-01 sampai WEB-04.

Tinjau XSS, CSRF, CORS, CSP, dan header. Jangan simpan rahasia di localStorage atau bundle. HTML, SVG, dan konten pengguna ditinjau sebelum di-render. Respons sensitif tidak di-cache sembarangan.

### F. Berkas, AI, dan dokumen

**Status:** 🟡 Sebagian — sisa AI-01; unggah dokumen ➖ Tidak berlaku.

Validasi ukuran, ekstensi, dan MIME bila fitur unggah ada. Nama file internal tidak memakai path pengguna. Isi dokumen tidak menjadi instruksi sistem atau sumber hak akses. Data internal tidak dikirim ke model eksternal tanpa konfigurasi dan keputusan data yang eksplisit. Hasil AI divalidasi sebelum disimpan atau dieksekusi.

### G. CCTV, OSINT [➖ dihapus 7e62735], dan layanan luar

**Status:** 🟡 Sebagian — sisa INT-02.

Token dan URL internal dilindungi. URL dari pengguna tidak diambil tanpa cek SSRF. Respons luar punya timeout dan batas ukuran. Log tidak memuat token CCTV. Sumber, waktu ambil, dan kegagalan dibedakan. Integrasi baru tidak membuka monitoring ke peran yang tidak berhak.

### H. Rahasia, Git, dependensi, dan deployment

**Status:** 🟡 Sebagian — sisa SEC-02, SEC-03.

Tidak ada kredensial nyata di tree yang akan di-commit. Dependensi, lockfile, Dockerfile, dan CI ditinjau. Privilege container, port, TLS, dan environment produksi ditinjau terpisah. Secret yang pernah masuk Git membutuhkan evaluasi riwayat dan rotasi, bukan hanya penghapusan di commit terbaru.

### I. Log, audit, dan pemantauan

**Status:** 🟡 Sebagian — sisa LOG-02, LOG-03.

Peristiwa autentikasi, penolakan otorisasi, dan administrasi akun dicatat. Log tidak memuat password, cookie, token reset, atau API key. Akses baca log dibatasi. Kegagalan keamanan dapat dilihat tanpa membuka data rahasia.

## Gerbang fitur

Setiap fitur, perbaikan, refactor, perubahan API, database, atau deployment mengikuti `FEATURE_SECURITY_REVIEW.md`.

Sebelum mengubah kode: catat file, endpoint, trust boundary, peran, input tidak tepercaya, data sensitif, risiko, dan tes yang dibutuhkan. Jika risiko kritis atau desain otorisasi belum jelas, minta klarifikasi dulu.

Saat mengubah kode: pertahankan kontrol yang sudah ada. Tambah tes positif dan negatif yang relevan. Jangan memperluas scope tanpa persetujuan.

Sesudah mengubah kode: jalankan tes yang tersedia, tinjau diff, perbarui hanya item checklist yang terdampak, dan laporkan tes yang tidak dijalankan. Berhenti sebelum commit, push, migrasi, atau deploy bila belum disetujui.

## Yang belum menjadi bagian baseline ini

**Status:** ⏳ Terbuka — daftar asli 112 item belum ada di repositori.

Daftar 112 item dalam 28 kategori yang disebut sebagai checklist asli tidak ada di pesan tugas dan tidak ada di repositori pada 2026-10-17. `SECURITY_CHECKLIST.md` mencatat kontrol yang bukti lokalnya sudah diperiksa, plus celah itu. Jangan mengisi item yang belum ada sumbernya sebagai `PASS`.
