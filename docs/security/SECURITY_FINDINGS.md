# ATLAS Security Findings

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).
**Tanggal audit:** 2026-10-17
**Lingkup:** working tree lokal `/home/localhost/osiris` dibanding `HEAD` `8f52c8e` (`origin/master`)
**Bukan sertifikasi.** Temuan yang ditutup harus diverifikasi ulang. Jangan menghapus entri lama.

Probe hidup pada tanggal yang sama hanya `GET` tanpa cookie ke `http://127.0.0.1:3005`. Tidak ada percobaan login, tidak ada POST registrasi, dan tidak ada uji sesi kedaluwarsa dengan akun sungguhan. Nilai rahasia tidak dicatat di sini.

## Terbuka

### F-001 — Gerbang sesi belum ada di commit GitHub

- **Keparahan:** CRITICAL
- **Status:** ✅ Selesai (938e1dc)
- **Lokasi:** `src/proxy.ts` (belum terlacak). `src/middleware.ts` terhapus di working tree. Blob `HEAD:src/middleware.ts` hanya memanggil analytics lalu `NextResponse.next()`, dan matcher-nya tidak mencakup `/api`.
- **Skenario:** deploy atau checkout bersih dari `origin/master` melayani API monitoring tanpa sesi.
- **Bukti:** isi middleware `HEAD` dibaca. Pada server lokal yang memuat `src/proxy.ts`, `GET /api/cctv`, `/api/flights` [➖ dihapus dc942ec], `/api/osint/ip` [➖ dihapus 7e62735], `/api/ops/users`, `/api/ops/situations`, `/api/ops/audit`, dan `/api/entity/expand` menjawab 401. `/peta`, `/operator`, dan `/pengguna` menjawab 307 ke `/masuk`.
- **Rekomendasi:** jangan deploy dari `origin/master` sebagai aplikasi tertutup. Commit gerbang hanya setelah batch auth disetujui, bersama file yang gerbang itu impor. Jangan mencampur dengan commit branding.
- **Verifikasi ulang:** `git ls-tree HEAD src/proxy.ts` harus ada, dan probe tanpa cookie pada build commit itu tetap 401/307.

### F-002 — Batas percobaan login dapat digeser

- **Keparahan:** HIGH
- **Status:** ✅ Selesai (4a078a6; penguncian akun oleh orang lain ditutup di 356bd31). Belum diuji dengan percobaan login.
- **Lokasi:** `rateLimit` di `src/lib/ops/rate-limit.ts`. Pemanggilan di `src/app/api/ops/login/route.ts`. `requestIp` di `src/lib/ops/audit.ts`.
- **Skenario:** penghitung hanya hidup di memori proses. Kedua kunci login memuat IP. IP diambil dari hop pertama `X-Forwarded-For`. Saat peta melewati 5000 kunci, seluruh peta dikosongkan.
- **Bukti:** kode ketiga fungsi dibaca pada 2026-10-17. Tidak ada tes serangan yang dijalankan.
- **Rekomendasi:** batas per nama pengguna yang tidak ikut berubah saat IP dipalsukan, jangan mengosongkan seluruh peta, dan jangan mempercayai `X-Forwarded-For` tanpa proxy yang dikenal.
- **Verifikasi ulang:** tes negatif yang memutar header dan mengisi lebih dari 5000 kunci, tanpa menembak akun nyata.

### F-003 — Tautan reset dapat mengikuti header Host

- **Keparahan:** HIGH
- **Status:** ✅ Selesai (4a078a6). Keaktifan SMTP tidak diperiksa, karena itu ada di environment.
- **Lokasi:** `resetOrigin` di `src/lib/ops/mail.ts`, dipanggil dari `src/app/api/ops/password/forgot/route.ts`.
- **Skenario:** bila `OPS_PUBLIC_URL` kosong atau tidak lolos pola, origin tautan diambil dari `Host` dan `X-Forwarded-Proto`. Token reset ikut di tautan surel.
- **Bukti:** fungsi dibaca. Token disimpan sebagai hash SHA-256, berlaku 30 menit, sekali pakai, dan reset menaikkan `sessionVersion` (`src/lib/ops/reset-token.ts`, `src/app/api/ops/password/reset/route.ts`).
- **Rekomendasi:** tolak pengiriman bila `OPS_PUBLIC_URL` tidak valid. Jangan menyusun tautan dari header permintaan.
- **Verifikasi ulang:** tes unit `resetOrigin` dengan dan tanpa URL publik. Jangan mencetak token.

### F-004 — Literal kredensial di working tree

- **Keparahan:** HIGH
- **Status:** ✅ Selesai (938e1dc; pemindaian riwayat penuh lihat SEC-02). Belum masuk `HEAD`.
- **Lokasi:** `.env.example`, `docker-compose.yml`. Kunci yang terisi: `DATABASE_URL`, `OSIRIS_POSTGRES_PASSWORD`, `OPS_SESSION_SECRET`, `OPS_ADMIN_USERNAME`, `OPS_ADMIN_PASSWORD`.
- **Skenario:** `git add` berkas contoh atau Compose membawa rahasia ke riwayat.
- **Bukti:** diff working tree mengklasifikasi nilai sebagai literal non-kosong. Nilai tidak disalin ke dokumen ini. `prisma/seed.mjs` membaca admin dari environment. Migrasi SQL yang ada tidak menyisipkan password.
- **Rekomendasi:** kosongkan literal sebelum commit apa pun. Jangan stage kedua berkas itu pada batch branding atau auth.
- **Verifikasi ulang:** `git diff -- .env.example docker-compose.yml` tidak lagi memuat nilai terisi. Jangan mencetak nilainya saat memeriksa.

### F-005 — Pembaca menerima situasi dan feed monitoring

- **Keparahan:** MEDIUM
- **Status:** 🟡 Sebagian (baca situasi dan CCTV untuk peran baca menunggu keputusan produk). Sebagian ditutup 2026-10-24. `/api/scanner` dan `/api/osint/*` kini hanya untuk Admin dan Operator (`isOperatorApi` di `src/lib/ops/gate.ts`, ditolak 403 di `src/proxy.ts`) [➖ route dan `isOperatorApi` dihapus 7e62735]. Baca situasi dan feed CCTV untuk `ANALYST`/`PIMPINAN` tetap terbuka sebagai keputusan produk.
- **Lokasi:** `seesAllKotamaops` dan `situationWhere` di `src/lib/ops/access.ts`. `GET` `src/app/api/ops/situations/route.ts`. `src/app/(id)/operator/page.tsx`. `src/proxy.ts` hanya menuntut sesi untuk feed. Ringkasan yang sama ada di `docs/akses-endpoint.md`.
- **Skenario:** `ANALYST` dan `PIMPINAN` membaca semua baris situasi, termasuk personel dan catatan, serta memanggil CCTV, OSINT [➖ dihapus 7e62735], pemindai [➖ dihapus 7e62735], dan AI. Tulis situasi ditolak di `PATCH` sebelum baris unit lain dibaca. Halaman `/pengguna` dan API admin menolak di server.
- **Bukti:** kode dan `docs/akses-endpoint.md` selaras. Uji dengan akun tiap peran belum dijalankan.
- **Rekomendasi:** putuskan klasifikasi data. Jika pembaca tidak boleh melihat angka personel atau OSINT, tolak di handler. Jangan hanya menyembunyikan tombol.
- **Verifikasi ulang:** permintaan dengan sesi `ANALYST` dan `OPERATOR_KODAM` pada `GET /api/ops/situations` dan satu feed OSINT [➖ dihapus 7e62735; pakai feed CCTV].

### F-006 — Registrasi publik membedakan akun yang sudah ada

- **Keparahan:** MEDIUM
- **Status:** ✅ Selesai (a710b57). Ditutup 2026-10-24. Nama pengguna atau email yang sudah terdaftar menerima 201 dan pesan yang sama dengan akun baru; hash sandi tetap dihitung agar waktu respons serupa. Duplikat dicatat di audit sebagai `duplicate`. Diuji di `src/app/api/ops/register/route.test.ts`.
- **Lokasi:** `src/app/api/ops/register/route.ts`. Route ada di `PUBLIC_API` pada `src/lib/ops/gate.ts`.
- **Skenario:** jawaban 409 berbeda untuk nama pengguna dan email. Akun baru `ANALYST`, `active: false`, `PENDING`. Login menolak status selain `ACTIVE`.
- **Bukti:** handler dibaca. Batas 5 permintaan per jam per IP memakai penghitung F-002.
- **Rekomendasi:** samakan jawaban, atau tutup registrasi bila server menghadap jaringan yang tidak dikenal.
- **Verifikasi ulang:** tes kontrak respons, tanpa membuat akun di database operasi.

### F-007 — Cookie sesi tanpa Secure di luar produksi

- **Keparahan:** LOW
- **Status:** 🟡 Sebagian (produksi memasang `Secure`; HTTP dev diterima sebagai risiko). Diterima sebagai risiko dev (2026-10-24). Server dev melayani HTTP di LAN; `Secure` di sana membuat login mustahil. Produksi tetap memasang `Secure`, jadi produksi harus di belakang HTTPS.
- **Lokasi:** `sessionCookie` di `src/lib/ops/session.ts`.
- **Skenario:** cookie `osiris_ops` adalah `HttpOnly`, `SameSite=Lax`, `Path=/`. `Secure` hanya saat produksi. Server dev mendengarkan di semua antarmuka.
- **Bukti:** fungsi dibaca. Masa berlaku 8 jam, atau 14 hari bila ingat saya. `readSession` menolak rahasia kosong, tanda tangan salah, dan kedaluwarsa.
- **Rekomendasi:** di belakang HTTPS, pastikan `NODE_ENV=production` atau setara sehingga `Secure` terpasang. Jangan mengganti nama cookie pada batch ini.
- **Verifikasi ulang:** header `Set-Cookie` pada lingkungan yang dimaksud, tanpa menyalin nilai cookie.

## Ditahan, bukan temuanexploit

Kontrol berikut terlihat dari kode pada tanggal audit. Itu bukan pernyataan bahwa seluruh kelas serangan sudah ditutup.

- Password login di-hash scrypt. Akun yang tidak ada tetap memakai hash umpan. Pesan gagal login tidak membedakan nama dan sandi (`src/lib/ops/password.ts`, `src/app/api/ops/login/route.ts`).
- Logout, ganti sandi, reset, dan penonaktifan menaikkan `sessionVersion`. Peran dibaca ulang dari database (`src/lib/ops/access.ts` `sessionMatchesUser`, `src/app/api/ops/logout/route.ts`).
- `SUPER_ADMIN` tidak dapat diangkat atau dicabut oleh peran lain. Super admin aktif terakhir tidak diturunkan (`src/app/api/ops/users/[id]/route.ts`).
- [➖ dihapus 7e62735] `POST /api/sdk/ingest` dan `POST /api/github-webhook` gagal tertutup bila rahasia masing-masing kosong. Keduanya tidak diuji hidup pada audit ini.
- `GET /api/health`, `/docs` [➖ dihapus 7e62735], `/privacy` [➖ dihapus 7e62735], `/masuk`, dan `/daftar` memang terbuka. `GET /` tanpa sesi menjawab 307 ke `/masuk`.

## Histori

| Tanggal | Perubahan |
| --- | --- |
| 2026-10-17 | Audit awal working tree. F-001 sampai F-007 dibuka. Tidak ada perbaikan kode. |
| 2026-10-24 | Perbaikan MEDIUM/LOW audit lanjutan: CSP `script-src 'self'` (tanpa `unsafe-eval` di produksi) plus `object-src`/`base-uri`/`form-action`/`frame-ancestors`; port intel 4000 hanya `127.0.0.1`; RECON/OSINT hanya Admin dan Operator; `OPS_SESSION_SECRET` < 32 karakter dianggap kosong; tolak POST lintas situs (`Sec-Fetch-Site`/`Origin`, nginx kini meneruskan `Host` lengkap dengan port); tautan IntelFeed hanya http(s); iframe kamera dan live feed di-sandbox; registrasi tidak membedakan akun yang ada (F-006); `safeFetch` memaku koneksi ke IP yang sudah divalidasi (undici); `/api/proxy-tiles` hanya host dan path basemap CARTO; sisa interpolasi popup peta di-escape; daftar Sherlock dipaku ke commit `e40a45e`. F-005 sebagian, F-006 ditutup, F-007 diterima. |
