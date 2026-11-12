# 08 — Konteks ATLAS untuk perancang UI/UX (ringkasan eksekutif)

> Catatan 12 November 2026: layer pesawat (watch list) dan satelit sudah dihapus. Basemap citra satelit tetap ada. Panel Style Studio sudah tidak ada; yang tersisa hanya penerapan setelan tersimpan lewat `src/lib/style-tokens.ts`.

Dokumen ini adalah titik masuk untuk merancang upgrade UI **ATLAS Premium Hybrid** (navy gelap, cyan, gold) tanpa merusak fitur yang ada. Semua isinya diambil dari source code aktual per 30 Oktober 2026. Detail dan bukti `file:baris` ada di dokumen 00–07; dokumen ini hanya merangkum.

**Batas bukti:** halaman yang butuh login **belum pernah dilihat** saat discovery, karena tidak ada login yang dipakai. Tampilan visualnya berstatus UNVERIFIED. Yang terverifikasi di runtime hanya halaman publik (screenshot di `screenshots/`) dan perilaku gerbang akses.

---

## 1. Sistem ATLAS saat ini

- **Apa:** peta situasi operasional untuk Pusdalops TNI, ditambah papan status per Kotamaops dan manajemen pengguna. Pengembangan lokal (WSL), belum di-deploy.
- **Stack:**
  - Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 (`@import "tailwindcss"` di `src/app/globals.css`, ±2.750 baris).
  - framer-motion, lucide-react, MapLibre GL (peta), hls.js + mpegts.js (video).
  - Prisma + PostgreSQL. Tes memakai vitest, hanya `.test.ts` di lingkungan Node, **tanpa tes UI/E2E**.
- **Pola:** modular monolith. Satu aplikasi Next.js melayani UI, API (46 route), dan pengambilan data feed. Ada dua route group dengan root layout masing-masing:
  - `(id)`: halaman operasional berbahasa Indonesia, `lang="id"`.
  - `(en)`: peta, `lang="en"`, dan isinya masih sebagian besar berbahasa Inggris.
- **Akses:** `src/proxy.ts` menjaga semua halaman dan API. Sesi berupa cookie HMAC (8 jam, atau 14 hari dengan "ingat saya"). `sessionVersion` dipakai untuk mencabut semua sesi seorang pengguna.
- **Peran:** `SUPER_ADMIN`, `ADMIN`, `OPERATOR_PUSDALOPS`, `OPERATOR_KODAM` (dibatasi ke satu Kotamaops), `ANALYST`, `PIMPINAN`. Semua aturan ditegakkan di server (`src/lib/ops/access.ts`).
- **Data:** hanya data operasional dan autentikasi yang disimpan: `User`, `Kotamaops`, `Situation`, `SituationRevision`, `PasswordReset`, `AuthAudit`. Data peta (pesawat, kapal, gempa, CCTV, berita) diambil langsung dari sumber luar dan dicache di memori server. Browser mengambil data dengan polling (10 detik sampai 15 menit); tidak ada push real-time.
- **State:** tidak ada store global. Setiap halaman memakai state React lokal, server component membaca DB secara langsung, dan beberapa preferensi disimpan di `localStorage`.

Detail: [00_ATLAS_SYSTEM_OVERVIEW.md](00_ATLAS_SYSTEM_OVERVIEW.md)

## 2. Halaman yang tersedia (9)

| Route | Halaman | Akses | Status |
|---|---|---|---|
| `/` | Redirect ke beranda sesuai peran | semua | WORKING |
| `/masuk` | Login | publik | WORKING (sudah memakai gaya baru) |
| `/daftar` | Pendaftaran akun (status PENDING) | publik | WORKING (belum memakai gaya baru) |
| `/lupa-sandi`, `/atur-sandi` | Reset kata sandi lewat email | publik | PARTIAL (bergantung SMTP) |
| `/operator` | Papan situasi Kotamaops + shell portal (memuat `/peta` di iframe) | semua peran yang login; menyimpan: SUPER_ADMIN, ADMIN, OPERATOR_PUSDALOPS, OPERATOR_KODAM (ANALYST dan PIMPINAN hanya membaca) | UNVERIFIED (visual) |
| `/pengguna` | Manajemen pengguna + jejak autentikasi | SUPER_ADMIN, ADMIN | UNVERIFIED (visual); API teruji |
| `/peta` | Peta operasional: layer, alert, intel, CCTV, pesawat, AOI, rute | semua yang login | UNVERIFIED (visual) |
| `/peta/multiview` | Dinding kamera (sampai 4×4) | semua yang login | UNVERIFIED |

Tidak ada halaman `error`, `not-found`, maupun `loading` buatan sendiri.

Detail: [01_ATLAS_PAGE_INVENTORY.md](01_ATLAS_PAGE_INVENTORY.md)

## 3. Design system aktual (bukan ideal)

- **Token terpusat:** CSS custom properties di `:root` (`globals.css:11-92`), ditambah tema alternatif `body.theme-ghost` (ungu) dan "Style Studio", yang menimpa variabel lewat style inline di `<body>`. Tailwind `@theme` hanya memetakan 4 hal: background, foreground, font sans, dan font mono. **Tidak ada token** untuk ukuran teks, radius, shadow, maupun motion.

| Peran | Token | Nilai |
|---|---|---|
| Background | `--bg-void` / `--bg-primary` / `--bg-secondary` / `--bg-tertiary` | `#0A0D16` / `#0E121D` / `#151A29` / `#1D2437` |
| Panel | `--bg-panel` | `rgba(10,13,22,0.86)` |
| Aksi utama | `--gold-primary` | `#D4AF37` |
| Sinyal/data | `--cyan-primary` | `#00E5FF` |
| Danger / warning / success / info | `--alert-red/orange/green/blue` | `#FF3D3D` / `#FF9500` / `#00E676` / `#448AFF` |
| Teks | `--text-primary` / `--text-secondary` / `--text-muted` | `#E8E6E0` / `#B0ACA3` / `#A3A099` |
| Border | `--border-primary` / `--border-cyan` | gold 20% / cyan 20% |

- **Nilai hardcoded:** 566 literal hex dan 213 kelas Tailwind `[#…]`. Contohnya `#5C5A54` ×64, dengan kontras sekitar 2,5:1. Banyak nilai token yang ditulis ulang sebagai literal, sehingga tidak ikut tema.
- **Font:**
  - Inter (UI) dan JetBrains Mono (HUD) dimuat dari Google Fonts saat runtime.
  - Archivo (lebar, tebal) di-self-host dan hanya dipakai di halaman auth.
- **Ukuran teks:**
  - ±365 ukuran `text-[Npx]` arbitrer; 9–11px paling sering.
  - Ada label 7px (`.hud-label`) dan 5–6px (nav mobile).
- **Komponen bersama:**
  - Hanya `authField`, `authButton`, dan `authLink` (`src/components/ops/auth-frame.tsx`) serta `PasswordField`.
  - Tidak ada komponen Button, Field, maupun Dialog bersama.
- **Ikon:** lucide-react.
- **Tema:** dark-only; tidak ada light mode.
- **Paling dekat ke Premium Hybrid:** halaman auth, dengan panel kaca, aksen cyan, tombol gold, dan sudut braket. Gaya ini cocok dijadikan sumber pola untuk halaman lain.

Detail: [02_ATLAS_COMPONENT_INVENTORY.md](02_ATLAS_COMPONENT_INVENTORY.md), [03_ATLAS_DESIGN_SYSTEM_AS_IS.md](03_ATLAS_DESIGN_SYSTEM_AS_IS.md)

## 4. Fitur dan interaksi yang ada

- **Auth:**
  - Login dengan "ingat saya"; parameter `next` divalidasi dengan allowlist.
  - Pendaftaran menghasilkan akun PENDING yang disetujui admin.
  - Lupa dan atur sandi lewat token email.
  - Logout mencabut semua sesi pengguna itu.
- **Kebijakan sandi** (server dan klien, satu sumber: `prisma/password-policy.mjs`): minimal 12 karakter; menolak nama pengguna, nama aplikasi, nama peran, atau satu karakter yang diulang. Mengganti sandi **wajib** disertai konfirmasi.
- **Manajemen pengguna:**
  - Tambah pengguna.
  - Edit nama, peran, Kotamaops, aktif/nonaktif, dan sandi baru + konfirmasi.
  - Setujui, Tolak, Nonaktifkan, Aktifkan.
  - Tabel audit (80 baris terakhir, waktu WIB).
  - Perlindungan khusus: ADMIN tidak bisa mengubah SUPER_ADMIN, dan SUPER_ADMIN aktif terakhir tidak bisa diturunkan.
- **Papan situasi:** status KONDUSIF/WASPADA/SIAGA, personel, dikerahkan, jumlah kejadian, dan catatan per Kotamaops. Operator Kodam hanya bisa mengubah satuannya sendiri. Setiap simpanan tercatat sebagai revisi.
- **Peta:**
  - Panel layer, peringatan langsung (gempa BMKG, cuaca, berita), feed intel, dan ringkasan heuristik (tanpa model AI eksternal).
  - Pencarian lokasi, rute, gambar AOI dan ekspor.
  - Pesawat (watch list), kapal, satelit, kebakaran.
  - CCTV publik dengan pratinjau dan multiview.
  - Menu token CCTV (khusus admin), status bar, dan shortcut keyboard.

Detail alur dan API: [04_ATLAS_USER_FLOWS.md](04_ATLAS_USER_FLOWS.md), [05_ATLAS_USER_MANAGEMENT_DEEP_DIVE.md](05_ATLAS_USER_MANAGEMENT_DEEP_DIVE.md)

## 5. Masalah UI utama (top 10 dari 35)

| # | Masalah | Prio |
|---|---|---|
| 1 | `/pengguna`: Tolak, Nonaktifkan, ganti peran, dan reset sandi langsung jalan **tanpa konfirmasi** | P0 |
| 2 | `/pengguna`: tombol Setujui/Tolak/Nonaktifkan/Aktifkan **ikut mengirim edit yang belum disimpan** | P0 |
| 3 | Indikator "ONLINE"/"LIVE" di peta **statis**; tidak ada tanda kesegaran data | P0 |
| 4 | `/pengguna`: tanpa status sibuk, bisa terkirim dua kali, error jaringan tidak tampil | P1 |
| 5 | Panel peringatan resmi (LiveAlerts) tidak bisa dibuka di mobile | P1 |
| 6 | Form tambah pengguna: nilai default (Operator Kotamaops tanpa Kotamaops) pasti ditolak | P1 |
| 7 | Kolom sandi dikosongkan sebelum server menjawab | P1 |
| 8 | Label navigasi mobile 5–6px | P1 |
| 9 | `/operator` memuat seluruh `/peta` di iframe (polling ganda) | P2 |
| 10 | Bahasa campur Inggris/Indonesia; `/peta` ber-`lang="en"` | P2 |

Juga penting:
- Form daftar dan lupa sandi belum seragam dengan login yang baru.
- Fokus keyboard dihapus di beberapa kontrol peta.
- Kontras rendah (`#5C5A54`).
- Tidak ada pencarian, filter, maupun paginasi di daftar pengguna.

Detail dan bukti: [06_ATLAS_UX_GAP_ANALYSIS.md](06_ATLAS_UX_GAP_ANALYSIS.md)

## 6. Batasan teknis yang wajib dihormati

1. **RBAC tetap di server.** Menyembunyikan tombol di UI hanyalah kenyamanan, bukan pengamanan. Jangan memindahkan pengecekan ke klien.
2. **Kontrak API tidak berubah:** nama field body POST/PATCH; PATCH pengguna mengirim **salah satu** dari `active` atau `accountStatus`; `kotamaopsId` bernilai `null` untuk peran selain Operator Kotamaops; `confirmPassword` wajib bila `password` diisi.
3. **Kopling tersembunyi:** handler simpan di `user-board.tsx` membaca kolom sandi lewat `document.getElementById('password-<id>')` dan `('password-confirm-<id>')`. Bila id itu berubah tanpa memperbarui handler, sandi terkirim kosong dan **diam-diam tidak berubah**.
4. **Komponen berisiko tinggi:**
   - `OsirisMap.tsx` (2.675 baris; popup berupa string HTML yang memanggil fungsi di `window`).
   - `monitoring-dashboard.tsx` (1.466 baris).
   - `LiveAlerts.tsx` (1.028 baris).
   - Tema ghost dan Style Studio.
   - `AuthFrame`, yang dipakai 4 halaman.
5. **Pesan error berasal dari server** (Bahasa Indonesia). UI menampilkannya apa adanya, jadi jangan diganti dengan teks generik.
6. **Warna peta** disinkronkan dengan `src/lib/map-palette.ts` lewat tes. Mengubah token `--map-*` harus diikuti di sana.
7. **Tidak ada tes UI.** Setiap perubahan wajib lolos:
   - `npx vitest run`
   - `npx tsc --noEmit`
   - `npx eslint`
   - `npm run build` (termasuk pemeriksaan artefak)
   - bila menyentuh autentikasi: `npm run test:db` (memakai DB tes `osiris_ops_test`)

   Disarankan menambah tes komponen untuk halaman yang di-redesign.

Detail: [07_ATLAS_UI_REDESIGN_CONSTRAINTS.md](07_ATLAS_UI_REDESIGN_CONSTRAINTS.md)

## 7. Halaman prioritas untuk upgrade

1. **`/pengguna` (Manajemen Pengguna)**
   - Memuat dua dari tiga masalah P0.
   - Kodenya kecil dan terpisah dari peta, dan API-nya sudah teruji.
   - Mulai dengan menambahkan dialog konfirmasi, status sibuk, perbaikan default form, label yang terlihat, serta pencarian dan filter, sambil mempertahankan kontrak di §6.
2. **Halaman auth** (`/daftar`, `/lupa-sandi`, `/atur-sandi`)
   - Samakan dengan `/masuk` yang sudah memakai gaya Premium Hybrid.
   - Ini sekaligus menjadi sumber pola field, tombol, dan panel untuk halaman lain.
3. **`/operator`**
   - Halaman kerja harian operator; sebagian sudah memakai token.
   - Selaraskan visual dan putuskan nasib iframe `/peta`.

**`/peta` ditunda** sampai ada baseline visual atau E2E, karena risikonya paling tinggi. Pengecualiannya perbaikan kecil yang terisolasi: indikator status nyata, ukuran label nav mobile, dan akses LiveAlerts di mobile.

## 8. Rujukan

| Dokumen | Isi |
|---|---|
| [00_ATLAS_SYSTEM_OVERVIEW.md](00_ATLAS_SYSTEM_OVERVIEW.md) | Arsitektur, stack, routing, model data, auth/RBAC, katalog API, diagram Mermaid |
| [01_ATLAS_PAGE_INVENTORY.md](01_ATLAS_PAGE_INVENTORY.md) | Semua halaman: akses, komponen, data, state, status |
| [02_ATLAS_COMPONENT_INVENTORY.md](02_ATLAS_COMPONENT_INVENTORY.md) | Komponen per kategori, duplikasi, kopling |
| [03_ATLAS_DESIGN_SYSTEM_AS_IS.md](03_ATLAS_DESIGN_SYSTEM_AS_IS.md) | Token, nilai hardcoded, tipografi, kontras, motion |
| [04_ATLAS_USER_FLOWS.md](04_ATLAS_USER_FLOWS.md) | Alur pengguna dan request API |
| [05_ATLAS_USER_MANAGEMENT_DEEP_DIVE.md](05_ATLAS_USER_MANAGEMENT_DEEP_DIVE.md) | Manajemen pengguna: matriks aksi → API → peran |
| [06_ATLAS_UX_GAP_ANALYSIS.md](06_ATLAS_UX_GAP_ANALYSIS.md) | 35 masalah UX berprioritas, quick wins |
| [07_ATLAS_UI_REDESIGN_CONSTRAINTS.md](07_ATLAS_UI_REDESIGN_CONSTRAINTS.md) | Batasan, risiko, tes regresi, urutan kerja |
| `screenshots/` | Halaman publik, desktop 1366×768 dan mobile 390×844 |
