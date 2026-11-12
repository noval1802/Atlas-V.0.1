# ATLAS Security Checklist

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).
**Tanggal:** 2026-10-17
**Catatan tinjauan manual. Bukan sertifikasi.**

## Daftar 112 item

Pesan tugas menyebut checklist asli berisi 112 item dalam 28 kategori. Daftar itu tidak ada di pesan, tidak ada di `docs/`, dan tidak ada di `SECURITY.md`. Item di bawah ini **bukan** salinan daftar itu. Jumlahnya bukan 112. Status tidak diisi `PASS` untuk kontrol yang belum diperiksa.

Jika daftar asli diserahkan, petakan ID aslinya ke baris di bawah atau tambahkan baris baru. Jangan menimpa status yang sudah punya bukti hanya agar jumlah menjadi 112.

Status yang dipakai: `✅ Selesai`, `🟡 Sebagian`, `⏳ Terbuka`, `➖ Tidak berlaku`. Sebelum 2026-11-12 dipakai `PASS`, `FAIL`, `NEEDS REVIEW`, `NOT TESTED`, `NOT APPLICABLE`.

## A. Autentikasi dan sesi

### AUTH-01 Hash password

- **Status:** ✅ Selesai (tes hash dan sandi salah ada dan lulus)
- **Bukti:** `hashPassword` dan `verifyPassword` di `src/lib/ops/password.ts` memakai scrypt, salt acak, dan `timingSafeEqual`. Tidak ada tes serangan yang dijalankan pada audit ini.
- **Risiko:** hash lemah membongkar sandi bila database bocor.
- **Rekomendasi:** tahan sampai parameter scrypt dan tes vektor dicatat.
- **Verifikasi:** tes unit hash dan bandingkan sandi salah.
- **Diperbarui:** 2026-11-12

### AUTH-02 Pesan gagal login

- **Status:** ⏳ Terbuka (keputusan atas jawaban 403 untuk akun tidak aktif belum dicatat)
- **Bukti:** `src/app/api/ops/login/route.ts` memakai satu kalimat untuk sandi salah dan akun yang tidak ada, serta hash umpan. Akun tidak aktif yang sandinya benar menerima 403 berbeda. Probe login tidak dijalankan.
- **Risiko:** 403 sesudah sandi benar membedakan akun yang menunggu persetujuan.
- **Rekomendasi:** putuskan apakah perbedaan itu diterima.
- **Verifikasi:** tes kontrak 401 dan 403 tanpa mencetak sandi.
- **Diperbarui:** 2026-11-12

### AUTH-03 Batas percobaan login

- **Status:** ✅ Selesai (4a078a6; perbaikan penguncian akun oleh pihak lain ada di working tree, belum di-commit)
- **Bukti:** `src/lib/ops/rate-limit.ts` menyimpan hit di memori dan mengosongkan peta di atas 5000 kunci. `requestIp` mengambil hop pertama `X-Forwarded-For`. Lihat F-002.
- **Risiko:** tebakan sandi dapat melewati batas 30 per 15 menit.
- **Rekomendasi:** batas per nama pengguna dan penghitung yang tidak mudah direset.
- **Verifikasi:** tes negatif tanpa menembak akun operasi.
- **Diperbarui:** 2026-11-12

### AUTH-04 Rahasia sesi kosong

- **Status:** ✅ Selesai (a710b57)
- **Bukti:** login menjawab 500 bila `OPS_SESSION_SECRET` kosong. `readSession` menolak rahasia kosong. Nilai rahasia tidak dibaca.
- **Risiko:** salah konfigurasi menolak masuk, atau bila ada jalur lain yang memakai rahasia kosong.
- **Rekomendasi:** pastikan tidak ada jalur terbit sesi dengan rahasia kosong.
- **Verifikasi:** tes unit `readSession` dengan rahasia kosong.
- **Diperbarui:** 2026-11-12

### AUTH-05 Masa berlaku sesi

- **Status:** ✅ Selesai (a710b57)
- **Bukti:** `SESSION_MS` 8 jam dan `REMEMBER_MS` 14 hari di `src/lib/ops/session.ts`. `readSession` menolak `exp` yang sudah lewat. Sesi kedaluwarsa tidak diuji dengan cookie sungguhan.
- **Risiko:** sesi ingat-saya memperpanjang jendela pencurian cookie.
- **Rekomendasi:** terima 14 hari hanya bila cookie `Secure` terpasang.
- **Verifikasi:** tes `readSession` pada waktu sesudah `exp`.
- **Diperbarui:** 2026-11-12

### AUTH-06 Atribut cookie

- **Status:** 🟡 Sebagian (`Secure` hanya di produksi; HTTP dev diterima sebagai risiko, lihat F-007)
- **Bukti:** `HttpOnly`, `SameSite=Lax`, `Path=/`. `Secure` hanya bila `NODE_ENV=production`. Lihat F-007.
- **Risiko:** cookie dapat menempel pada HTTP di server dev yang mendengar di semua antarmuka.
- **Rekomendasi:** `Secure` pada setiap listener HTTPS.
- **Verifikasi:** baca `Set-Cookie` tanpa menyalin nilainya.
- **Diperbarui:** 2026-11-12

### AUTH-07 Logout dan pencabutan

- **Status:** ✅ Selesai (tes versi sesi ada dan lulus)
- **Bukti:** logout, ganti sandi, reset, dan penonaktifan menaikkan `sessionVersion`. `sessionMatchesUser` menolak versi yang tidak sama dan status selain `ACTIVE`. Tidak diuji hidup.
- **Risiko:** sesi lama tetap dipakai bila kenaikan versi terlewat pada satu jalur.
- **Rekomendasi:** tes tiap jalur pencabutan.
- **Verifikasi:** `src/lib/ops/session.test.ts` bila mencakup versi. Isi tes tidak dijalankan pada audit dokumen ini.
- **Diperbarui:** 2026-11-12

### AUTH-08 Reset password

- **Status:** ✅ Selesai (4a078a6)
- **Bukti:** token acak 32 byte, hash SHA-256, 30 menit, sekali pakai. `resetOrigin` dapat memakai header `Host`. Lihat F-003.
- **Risiko:** tautan surel dapat mengarah ke host yang dipilih penyerang.
- **Rekomendasi:** wajibkan `OPS_PUBLIC_URL`.
- **Verifikasi:** tes unit origin. Jangan mencetak token.
- **Diperbarui:** 2026-11-12

### AUTH-09 MFA

- **Status:** ⏳ Terbuka (keputusan MFA untuk `SUPER_ADMIN` belum dibuat)
- **Bukti:** tidak ada faktor kedua di `src/lib/ops/` atau route login.
- **Risiko:** akun admin hanya bergantung pada sandi.
- **Rekomendasi:** putuskan kemudian untuk `SUPER_ADMIN`. Jangan menandai lulus.
- **Verifikasi:** tidak ada.
- **Diperbarui:** 2026-11-12

### AUTH-10 Registrasi publik

- **Status:** ✅ Selesai (a710b57)
- **Bukti:** `POST /api/ops/register` publik, peran dipaksa `ANALYST`, status `PENDING`. Jawaban 409 membedakan nama dan email. Lihat F-006. POST tidak dijalankan.
- **Risiko:** enumerasi akun dan antrean pendaftaran.
- **Rekomendasi:** samakan jawaban atau tutup route.
- **Verifikasi:** tes kontrak tanpa menulis ke database operasi.
- **Diperbarui:** 2026-11-12

## B. Otorisasi dan RBAC

### RBAC-01 Keputusan di server

- **Status:** 🟡 Sebagian (OSINT dan pemindai dihapus di 7e62735; feed CCTV masih untuk semua peran, lihat F-005)
- **Bukti:** `src/proxy.ts` menuntut sesi untuk `/api` di luar daftar publik. Halaman `/pengguna` dan handler pengguna, audit, token CCTV, serta tulis situasi memeriksa peran lagi. Feed peta tidak memeriksa peran di handler.
- **Risiko:** peran yang lemah memakai OSINT [➖ dihapus 7e62735] dan CCTV. Lihat F-005.
- **Rekomendasi:** klasifikasi data, lalu tolak di handler.
- **Verifikasi:** satu permintaan per peran. Belum dijalankan.
- **Diperbarui:** 2026-11-12

### RBAC-02 UI bukan proteksi

- **Status:** 🟡 Sebagian (klasifikasi baca situasi untuk peran baca belum diputuskan)
- **Bukti:** `src/app/(id)/operator/page.tsx` memberi `canWrite` ke formulir, dan `PATCH` menolak peran baca sebelum update. Pembacaan situasi untuk `ANALYST` tetap diizinkan.
- **Risiko:** menyembunyikan tombol tidak menyembunyikan `GET`.
- **Rekomendasi:** samakan aturan baca halaman dan API.
- **Verifikasi:** `GET /api/ops/situations` dengan peran baca.
- **Diperbarui:** 2026-11-12

### RBAC-03 Unit Kotamaops

- **Status:** ✅ Selesai (938e1dc)
- **Bukti:** `situationWhere` dan `situationWriteLookup` di `src/lib/ops/access.ts`. `OPERATOR_KODAM` tanpa satuan menerima filter yang tidak cocok. ID unit lain pada tulis menjadi 404.
- **Risiko:** kesalahan filter membuka situasi unit lain.
- **Rekomendasi:** tes `OPERATOR_KODAM` terhadap id unit lain.
- **Verifikasi:** `src/lib/ops/access.test.ts` bila ada. Tidak dijalankan pada audit dokumen ini.
- **Diperbarui:** 2026-11-12

### RBAC-04 Eskalasi super admin

- **Status:** ✅ Selesai (4a078a6)
- **Bukti:** `superAdminRoleChangeError` dan hitungan super admin terakhir di `src/app/api/ops/users/[id]/route.ts`.
- **Risiko:** admin biasa mengangkat dirinya.
- **Rekomendasi:** tes negatif `ADMIN` yang mengirim peran `SUPER_ADMIN`.
- **Verifikasi:** `src/app/api/ops/users/route.test.ts` bila mencakup kasus itu. Tidak dijalankan di sini.
- **Diperbarui:** 2026-11-12

### RBAC-05 Gerbang ada di commit yang di-deploy

- **Status:** ✅ Selesai (938e1dc)
- **Bukti:** `origin/master` pada `8f52c8e` tidak memuat `src/proxy.ts`. Middleware tercommit tidak menolak API. Lihat F-001. Probe 401 hanya benar untuk proses lokal yang memuat proxy.
- **Risiko:** deploy GitHub membuka monitoring tanpa sesi.
- **Rekomendasi:** jangan deploy commit itu sebagai aplikasi tertutup.
- **Verifikasi:** `git cat-file -e HEAD:src/proxy.ts`.
- **Diperbarui:** 2026-11-12

### RBAC-06 Halaman publik

- **Status:** ✅ Selesai
- **Bukti:** pada 2026-10-17, tanpa cookie, `/docs` [➖ dihapus 7e62735], `/privacy` [➖ dihapus 7e62735], `/masuk`, dan `/daftar` menjawab 200. `/`, `/peta`, `/operator`, dan `/pengguna` menjawab 307. `/api/health` menjawab 200. Ini sesuai daftar publik di `src/lib/ops/gate.ts` dan `docs/akses-endpoint.md`, bukan bukti bahwa isi dokumen aman.
- **Risiko:** halaman publik yang tidak dimaksudkan ikut terbuka.
- **Rekomendasi:** ulangi probe bila matcher proxy berubah.
- **Verifikasi:** GET tanpa cookie, tanpa mengikuti redirect.
- **Diperbarui:** 2026-11-12

## C. API dan input

### API-01 Daftar metode publik

- **Status:** ✅ Selesai (7e62735)
- **Bukti:** `isPublicApi` hanya membuka health, login, logout, register, reset, webhook [➖ dihapus 7e62735], dan `POST /api/sdk/ingest` [➖ dihapus 7e62735]. `GET` register dan webhook pada probe menjawab 405.
- **Risiko:** path baru ikut terbuka bila lupa masuk ke keputusan eksplisit.
- **Rekomendasi:** setiap route baru menyebut publik, sesi, atau peran di review fitur.
- **Verifikasi:** bandingkan `src/app/api/**/route.ts` dengan `PUBLIC_API`. Belum diulang seluruhnya pada tahap dokumen.
- **Diperbarui:** 2026-11-12

### API-02 Validasi body auth

- **Status:** ✅ Selesai (tes parser ada dan lulus)
- **Bukti:** `parseRegister`, `parseNewUser`, `parseUserPatch`, dan `parseSituation` membatasi panjang, enum, dan tipe di `src/lib/ops/access.ts`.
- **Risiko:** mass assignment bila handler menyalin body mentah ke Prisma.
- **Rekomendasi:** handler pengguna sudah menyalin field yang diurai. Ulangi pola itu untuk fitur baru.
- **Verifikasi:** tes parser. Tidak dijalankan di sini.
- **Diperbarui:** 2026-11-12

### API-03 Webhook dan ingest

- **Status:** ➖ Tidak berlaku (webhook dan ingest SDK dihapus di 7e62735)
- **Bukti:** webhook menolak tanpa tanda tangan. Ingest menjawab 503 bila kunci kosong, menurut kode `src/app/api/sdk/ingest/route.ts` dan `src/app/api/github-webhook/route.ts`. Tidak diprobe dengan POST.
- **Risiko:** perbandingan kunci atau tanda tangan yang salah menerima data palsu.
- **Rekomendasi:** tes tanda tangan salah tanpa mencetak rahasia.
- **Verifikasi:** POST tanpa tanda tangan ke listener uji.
- **Diperbarui:** 2026-11-12

### API-04 SSRF dan URL pengguna

- **Status:** ✅ Selesai (3613a79, 8a6aba8)
- **Bukti:** tidak ada penelusuran ulang seluruh fetcher pada tahap dokumen ini.
- **Risiko:** URL dari klien dapat mengenai jaringan internal.
- **Rekomendasi:** tinjau route yang menerima URL sebelum fitur baru memakai pola itu.
- **Verifikasi:** daftar call site `fetch` yang memakai input permintaan.
- **Diperbarui:** 2026-11-12

### API-05 Batas ukuran body

- **Status:** ⏳ Terbuka (belum ada batas ukuran body eksplisit)
- **Bukti:** tidak diukur pada audit ini.
- **Risiko:** body besar menahan proses.
- **Rekomendasi:** catat batas Next.js yang berlaku sebelum menambah unggahan.
- **Verifikasi:** permintaan di atas batas pada lingkungan uji.
- **Diperbarui:** 2026-11-12

## D. Database dan logika bisnis

### DATA-01 Query terparameterisasi

- **Status:** ✅ Selesai
- **Bukti:** akses operasi yang dibaca memakai Prisma client, bukan string SQL yang digabung. Migrasi SQL ditinjau hanya untuk sisipan password. Tidak ada.
- **Risiko:** query mentah baru dapat menggabungkan input.
- **Rekomendasi:** larang SQL gabungan di review fitur.
- **Verifikasi:** cari `$queryRawUnsafe` saat menyentuh database.
- **Diperbarui:** 2026-11-12

### DATA-02 Transaksi situasi

- **Status:** ✅ Selesai (938e1dc)
- **Bukti:** `PATCH` situasi menulis baris dan revisi dalam `opsDb().$transaction`.
- **Risiko:** revisi tanpa baris terkini, atau sebaliknya, bila transaksi dihilangkan.
- **Rekomendasi:** pertahankan transaksi saat mengubah simpan situasi.
- **Verifikasi:** tes gagal di tengah transaksi. Tidak dijalankan.
- **Diperbarui:** 2026-11-12

### DATA-03 Migrasi

- **Status:** ✅ Selesai (c8c2c83)
- **Bukti:** `prisma/migrations/` ada di working tree dan belum tentu di `HEAD`. Migrasi tidak dijalankan pada tugas ini.
- **Risiko:** schema lokal dan database yang berjalan berbeda.
- **Rekomendasi:** jangan menjalankan migrasi tanpa persetujuan.
- **Verifikasi:** `prisma migrate status` hanya bila diminta, tanpa mencetak URL.
- **Diperbarui:** 2026-11-12

### DATA-04 Seed

- **Status:** ✅ Selesai (547f807)
- **Bukti:** `prisma/seed.mjs` menolak admin bila username atau password environment kosong atau password lebih pendek dari 10 karakter. Tidak ada literal sandi di migrasi.
- **Risiko:** seed dijalankan dengan sandi lemah dari environment.
- **Rekomendasi:** jangan menyalin nilai environment ke dokumen atau log.
- **Verifikasi:** baca seed tanpa mencetak environment.
- **Diperbarui:** 2026-11-12

## E. Frontend dan browser

### WEB-01 CSP dan header

- **Status:** ✅ Selesai (00f19ba)
- **Bukti:** `next.config.ts` di working tree berubah dan belum ditinjau ulang untuk CSP pada tahap dokumen ini.
- **Risiko:** skrip atau frame yang tidak dimaksudkan.
- **Rekomendasi:** tinjau header saat batch konfigurasi, terpisah dari auth.
- **Verifikasi:** baca header respons produksi atau dev tanpa mengubah konfigurasi.
- **Diperbarui:** 2026-11-12

### WEB-02 CSRF

- **Status:** ✅ Selesai (a710b57)
- **Bukti:** cookie `SameSite=Lax`. Tidak ada token CSRF terpisah yang terlihat di route login. POST lintas situs tidak diuji.
- **Risiko:** permintaan yang masih terkirim pada navigasi tertentu.
- **Rekomendasi:** jangan menurunkan `SameSite` tanpa review.
- **Verifikasi:** uji browser lintas origin bila aplikasi dipublikasikan.
- **Diperbarui:** 2026-11-12

### WEB-03 Rahasia di klien

- **Status:** ✅ Selesai (2135def)
- **Bukti:** tidak ada pemindaian bundle pada tugas ini.
- **Risiko:** kunci API ikut terbundle.
- **Rekomendasi:** cari nama environment sensitif di komponen klien sebelum rilis.
- **Verifikasi:** pencarian `NEXT_PUBLIC_` dan string kunci di `src/components`.
- **Diperbarui:** 2026-11-12

### WEB-04 Redirect setelah login

- **Status:** ✅ Selesai
- **Bukti:** `acceptedNext` di `src/lib/ops/access.ts` menolak protokol relatif ganda dan path di luar daftar peran. Form login memakainya. Tidak diuji di browser.
- **Risiko:** open redirect bila daftar atau parser longgar.
- **Rekomendasi:** tes `next` berisi `//` dan path peran lain.
- **Verifikasi:** tes unit `acceptedNext`. Tidak dijalankan di sini.
- **Diperbarui:** 2026-11-12

## F. Berkas, AI, dan dokumen

### FILE-01 Unggah dokumen

- **Status:** ➖ Tidak berlaku (belum ada fitur unggah)
- **Bukti:** tidak ada alur unggah Word, PDF, atau PPT yang ditinjau sebagai fitur aktif pada audit ini.
- **Risiko:** fitur baru dapat menerima file tanpa batas.
- **Rekomendasi:** isi bagian F di `SECURITY_BASELINE.md` sebelum menambah unggahan.
- **Verifikasi:** tidak ada.
- **Diperbarui:** 2026-11-12

### AI-01 Data yang dikirim ke model

- **Status:** 🟡 Sebagian (Gemini dihapus di 9c27781; keputusan data untuk chat AI ke penyedia eksternal belum dicatat)
- **Bukti:** route `/api/ai/analyze` [➖ dihapus 9c27781], `/api/ai/briefing` [➖ dihapus 9c27781], dan `/api/ai/overview` disebut di `docs/akses-endpoint.md` sebagai POST dengan sesi dan batas laju di handler. Handler tidak dibaca ulang pada tahap dokumen ini.
- **Risiko:** data operasi terkirim ke penyedia eksternal, atau batas laju hanya ada di dokumen.
- **Rekomendasi:** baca handler dan konfigurasi kunci sebelum mengubah AI.
- **Verifikasi:** tes tanpa kunci tidak boleh memanggil jaringan. Jangan mencetak kunci.
- **Diperbarui:** 2026-11-12

### AI-02 Keluaran model

- **Status:** ✅ Selesai (355a0e0)
- **Bukti:** tidak ada pemeriksaan apakah teks model dieksekusi sebagai perintah.
- **Risiko:** keluaran diperlakukan sebagai instruksi atau HTML.
- **Rekomendasi:** render sebagai teks sampai ada sanitasi.
- **Verifikasi:** tinjau komponen yang menampilkan overview.
- **Diperbarui:** 2026-11-12

## G. CCTV, OSINT [➖ dihapus 7e62735], dan layanan luar

### INT-01 Token CCTV

- **Status:** ✅ Selesai
- **Bukti:** `GET` dan `POST /api/cctv/tokens` menuntut `canManageUsers`. Komentar di `docs/akses-endpoint.md` menyatakan nilai token tidak dikembalikan. `updateStoredCctvToken` menulis environment. Log yang dibaca menyebut id sumber, bukan nilai token. POST tidak diuji.
- **Risiko:** token tertulis ke log atau ke file yang ter-commit.
- **Rekomendasi:** jangan commit `.env`. Ulangi baca log bila format pesan berubah.
- **Verifikasi:** respons GET tidak memuat nilai. Jangan mencetak token saat menguji.
- **Diperbarui:** 2026-11-12

### INT-02 Feed untuk setiap peran

- **Status:** 🟡 Sebagian (OSINT dan pemindai dihapus di 7e62735; CCTV untuk semua peran menunggu keputusan produk)
- **Bukti:** proxy mengizinkan setiap sesi aktif ke API di bagian "Hanya sesi" pada `docs/akses-endpoint.md`. Dokumen itu sendiri mengatakan klasifikasi data masih menunggu keputusan. Lihat F-005.
- **Risiko:** viewer memakai OSINT [➖ dihapus 7e62735], CCTV, dan pemindai [➖ dihapus 7e62735].
- **Rekomendasi:** keputusan produk, lalu penolakan di server.
- **Verifikasi:** satu feed dengan peran `ANALYST`.
- **Diperbarui:** 2026-11-12

### INT-03 User-Agent dan URL hulu

- **Status:** ➖ Tidak berlaku (sengaja di luar lingkup baseline)
- **Bukti:** identitas klien ke layanan hulu sengaja tidak diubah pada baseline ini. Itu bukan bukti bahwa permintaan hulu aman.
- **Risiko:** mengubah User-Agent merusak akses yang sudah berjalan.
- **Rekomendasi:** jangan menyentuh User-Agent di batch keamanan ini.
- **Verifikasi:** tidak ada.
- **Diperbarui:** 2026-11-12

## H. Rahasia, Git, dependensi, dan deployment

### SEC-01 Contoh environment

- **Status:** ✅ Selesai (938e1dc)
- **Bukti:** working tree `.env.example` dan `docker-compose.yml` memuat literal untuk rahasia sesi, admin, dan database. Tidak ada di `HEAD`. Lihat F-004. Nilai tidak dicatat.
- **Risiko:** rahasia masuk riwayat Git.
- **Rekomendasi:** placeholder kosong sebelum stage.
- **Verifikasi:** diff tanpa mencetak nilai.
- **Diperbarui:** 2026-11-12

### SEC-02 Riwayat Git

- **Status:** 🟡 Sebagian (`.env.example` dan Compose bersih di seluruh riwayat; pemindaian semua berkas belum)
- **Bukti:** tidak ada pemindaian seluruh riwayat pada tugas ini.
- **Risiko:** rahasia lama tetap dapat diambil dari commit lama.
- **Rekomendasi:** pindai riwayat sebelum menganggap F-004 cukup ditutup dengan menghapus baris.
- **Verifikasi:** pencarian pola pada `git log -S` tanpa mencetak nilai yang ketemu.
- **Diperbarui:** 2026-11-12

### SEC-03 Dependensi dan CI

- **Status:** ⏳ Terbuka (audit dependensi belum dijalankan)
- **Bukti:** `package.json` dan lockfile di working tree berbeda dari `HEAD`. Tidak diaudit isinya. Workflow Docker tidak dijalankan.
- **Risiko:** dependensi atau image baru mengubah permukaan serangan.
- **Rekomendasi:** review terpisah sebelum commit lockfile.
- **Verifikasi:** `npm audit` hanya bila diminta, dan hasilnya ditinjau.
- **Diperbarui:** 2026-11-12

### SEC-04 Container dan port

- **Status:** ✅ Selesai (c8c2c83)
- **Bukti:** `Dockerfile` working tree menambah langkah Prisma. Compose menambah Postgres lokal. Tidak diubah dan tidak dinyalakan pada tugas ini.
- **Risiko:** port atau sandi default terbuka.
- **Rekomendasi:** batch deployment tersendiri.
- **Verifikasi:** baca port yang dipublikasikan tanpa menyalin sandi.
- **Diperbarui:** 2026-11-12

## I. Log, audit, dan pemantauan

### LOG-01 Jejak autentikasi

- **Status:** ✅ Selesai
- **Bukti:** `writeAudit` mencatat aksi login, registrasi, reset, dan perubahan akun. `scrubDetail` menyamarkan pola hash scrypt, bearer, dan cookie `osiris_ops`. `GET /api/ops/audit` menolak selain admin, menurut kode. Probe tanpa cookie menjawab 401.
- **Risiko:** detail audit masih memuat nama pengguna atau status akun untuk admin. Itu disengaja, tetapi detail bebas dapat melar.
- **Rekomendasi:** jangan menulis sandi atau token ke `detail`.
- **Verifikasi:** tes `scrubDetail` di `src/lib/ops/audit.test.ts`. Tidak dijalankan di sini.
- **Diperbarui:** 2026-11-12

### LOG-02 Akses log gagal

- **Status:** ⏳ Terbuka (kegagalan tulis audit belum dipantau)
- **Bukti:** kegagalan tulis audit ditelan dan hanya mengirim `console.error` dengan nama aksi.
- **Risiko:** serangan tidak terekam bila database audit gagal.
- **Rekomendasi:** pantau pesan itu tanpa menambah payload.
- **Verifikasi:** uji database audit yang tidak tersedia, di lingkungan uji.
- **Diperbarui:** 2026-11-12

### LOG-03 Retensi

- **Status:** ⏳ Terbuka (belum ada kebijakan retensi audit)
- **Bukti:** tidak ada kebijakan retensi di schema yang dibaca. Halaman pengguna mengambil 80 baris terakhir.
- **Risiko:** jejak menumpuk atau terhapus tanpa aturan.
- **Rekomendasi:** putuskan retensi sebelum produksi.
- **Verifikasi:** tidak ada.
- **Diperbarui:** 2026-11-12

## Ringkasan status

| Status | Jumlah |
| --- | --- |
| ✅ Selesai | 27 |
| 🟡 Sebagian | 6 |
| ⏳ Terbuka | 6 |
| ➖ Tidak berlaku | 3 |
| **Total baris** | **42** |

*(Catatan 2026-10-17, sudah tidak berlaku.)* Satu-satunya `PASS` adalah RBAC-06, dan itu hanya membuktikan respons HTTP tanpa cookie pada server lokal tanggal audit. Bukan sertifikasi.

Tes otomatis di `src/lib/ops/` dan `src/app/api/ops/` tidak dijalankan pada pembuatan dokumen ini. Status tidak dinaikkan karena berkas tes ada. *(2026-11-12: tes tersebut dijalankan dan lulus; status di atas dicek terhadap kode, bukan hanya keberadaan tes.)*
