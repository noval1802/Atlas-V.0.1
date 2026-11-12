# 01 — Inventaris Halaman ATLAS (AS-IS)

> Catatan 12 November 2026: layer pesawat dan satelit, `FlightWatchPanel` (beserta tesnya), `/api/aircraft`, dan `/api/flight-route` sudah dihapus. Basemap citra satelit tetap ada.

Tanggal pemeriksaan: 2026-10-30. Cakupan: `src/app/(id)` dan `src/app/(en)` (Next.js 16 App Router, React 19, Prisma/PostgreSQL).
Dokumen ini hanya mencatat keadaan saat ini. Tidak ada kode yang diubah.

## Dasar bukti

**Terbukti lewat pengujian/runtime**

- *Runtime* (GET tanpa sesi ke `http://localhost:3000`, 2026-10-30):

| Permintaan | Hasil |
|---|---|
| `GET /` | `307 → /masuk` |
| `GET /masuk`, `/daftar`, `/lupa-sandi`, `/atur-sandi`, `/atur-sandi?token=x` | `200` |
| `GET /peta` | `307 → /masuk?next=%2Fpeta` |
| `GET /peta?layers=cctv` | `307 → /masuk?next=%2Fpeta%3Flayers%3Dcctv` |
| `GET /peta/multiview` | `307 → /masuk?next=%2Fpeta` (tujuan *multiview* hilang) |
| `GET /operator` | `307 → /masuk?next=%2Foperator` |
| `GET /pengguna` | `307 → /masuk?next=%2Fpengguna` |
| `GET /tidak-ada` | `404` (halaman 404 bawaan Next.js) |
| `GET /api/health`, `/api/health/ready` | `200` (`status: serving`, `scope: process`) |
| `GET /api/ops/users`, `/api/ops/situations`, `/api/ops/audit`, `/api/cctv/tokens` | `401 {"error":"Masuk diperlukan."}` |

- *Pengujian*: `npx vitest run` pada 16 berkas uji yang terkait ops, LiveAlerts, dan health → **16 berkas, 95 tes lulus**. Berkasnya: `src/lib/ops/{access,gate,rbac.integration,situation-save,operator-view,reset-token,mail,password-policy}.test.ts`, `src/app/api/ops/**/route.test.ts`, `src/components/LiveAlerts.test.ts`, `src/app/api/health/route.test.ts`. Tes ini menguji logika dan handler API dengan DB tiruan. **Tidak ada tes render UI atau E2E untuk halaman mana pun.**

**Hanya dari pembacaan kode**

- Isi semua halaman yang memerlukan sesi (`/peta`, `/peta/multiview`, `/operator`, `/pengguna`). Secara visual, semua halaman ini **UNVERIFIED** karena pemeriksaan tidak memakai login.

**Tangkapan layar**

- Halaman publik direkam pada 1366x768 (desktop) dan 390x844 (mobile), dalam keadaan tidak login: `docs/ui-discovery/screenshots/{masuk,daftar,lupa-sandi,atur-sandi}-{desktop,mobile}.png`. Lingkaran "N" di kiri bawah adalah indikator mode dev Next.js, bukan bagian UI.

## Ringkasan rute

| URL | Nama | Akses | Tanpa sesi | Peran tak berizin | Status |
|---|---|---|---|---|---|
| `/` | Pengalih akar | publik | 307 → `/masuk` | — (sesi aktif → `homeForRole`) | WORKING (runtime + tes `homeForRole`) |
| `/masuk` | Masuk | publik | 200 | — | WORKING (runtime 200 + tes API login) |
| `/daftar` | Daftar | publik | 200 | — | WORKING (runtime 200 + tes API register) |
| `/lupa-sandi` | Lupa kata sandi | publik | 200 | — | PARTIAL (halaman 200; pengiriman surel UNVERIFIED) |
| `/atur-sandi?token=` | Atur kata sandi baru | publik | 200 | — | PARTIAL (halaman 200 + tes API reset; token nyata butuh SMTP) |
| `/peta` | Peta operasional (HUD) | semua peran aktif | 307 → `/masuk?next=/peta[?layers=]` | — | UNVERIFIED (gerbang WORKING) |
| `/peta/multiview` | Multiviewer CCTV | semua peran aktif | 307 → `/masuk?next=/peta` | — | UNVERIFIED (gerbang WORKING) |
| `/operator` | Dashboard Operator | semua peran aktif (tulis: 4 peran) | 307 → `/masuk?next=/operator` | — (baca saja) | UNVERIFIED (gerbang dan RBAC teruji) |
| `/pengguna` | Manajemen pengguna + Jejak autentikasi | SUPER_ADMIN, ADMIN | 307 → `/masuk?next=/pengguna` | 307 → `homeForRole(role)` | UNVERIFIED (gerbang dan API teruji) |
| *(404)* | Bawaan Next.js | — | 404 | — | WORKING (runtime), tanpa halaman khusus |

Halaman khusus `not-found.tsx`, `error.tsx`, `global-error.tsx`, dan `loading.tsx` **tidak ada** di `src/app`. Galat render ditangkap oleh `ErrorBoundary name="ATLAS Core"` di `src/components/ops/document-shell.tsx:32`.

## Aturan akses lintas halaman

Peran (`src/lib/ops/access.ts:3-10`): `SUPER_ADMIN`, `ADMIN`, `OPERATOR_PUSDALOPS`, `OPERATOR_KODAM`, `ANALYST`, `PIMPINAN`.

| Fungsi | Isi | Bukti |
|---|---|---|
| `canManageUsers` (`access.ts:23`) | SUPER_ADMIN, ADMIN | tes rbac |
| `canWriteSituation` (`access.ts:44`) | dua peran admin + OPERATOR_PUSDALOPS + OPERATOR_KODAM | tes access |
| `homeForRole` (`access.ts:66`) | admin → `/pengguna`, operator → `/operator`, ANALYST/PIMPINAN → `/peta` | `rbac.integration.test.ts:108-124` |
| `portalLinks` (`access.ts:75`) | `/peta`, `/operator` (label "Dasbor operator" atau "Dasbor situasi"), `/pengguna` khusus admin | kode |
| `deniedPage` (`access.ts:85`) | hanya `/pengguna*` yang ditolak untuk non-admin; tujuannya `homeForRole` | tes rbac |
| `allowedNext` (`access.ts:119`) + `acceptedNext` (`access.ts:126`) | daftar putih tujuan `next` sesudah login; hanya parameter `layers` yang dipertahankan | tes access |
| `situationWhere` (`access.ts:93`) | OPERATOR_KODAM hanya membaca Kotamaops miliknya; peran lain membaca semua | tes rbac |
| Label portal (`portalLabel`, `access.ts:58`) | Admin / Operator / Viewer (ANALYST) / Monitoring (PIMPINAN) | kode |

Lapisan penjagaan:

1. `src/proxy.ts:29-46` (pengganti middleware pada Next 16). `isProtectedPage` (`gate.ts:69`) membaca `sessionAccount`, yaitu cookie bertanda tangan ditambah baris user hidup (`gate.ts:53-66`). Tanpa sesi, permintaan dialihkan ke `/masuk?next=`. Peran yang ditolak dialihkan ke `deniedPage`. Untuk API, permintaan tanpa sesi mendapat 401 (`proxy.ts:19-20`), peran non-admin pada API admin mendapat 403 (`proxy.ts:21-23`), dan tulis lintas situs mendapat 403 (`proxy.ts:15-17`).
2. Penjagaan ulang di setiap `page.tsx` lewat `currentUser()` (`src/lib/ops/current-user.ts:9-17`).
3. Tidak ada halaman 403. Peran tak berizin selalu dialihkan, tidak diberi pesan.

## Layout

| Berkas | Isi | Catatan |
|---|---|---|
| `src/app/(id)/layout.tsx:9-11` | `DocumentShell lang="id"` | `/`, `/masuk`, `/daftar`, `/lupa-sandi`, `/atur-sandi`, `/operator`, `/pengguna` |
| `src/app/(en)/layout.tsx:9-11` | `DocumentShell lang="en"` | `/peta`, `/peta/multiview` |
| `src/components/ops/document-shell.tsx:5-38` | `<html>`, ikon, JSON-LD, `MotionPreference`, `ErrorBoundary` | Pada `/peta`, `lang="en"`, padahal sebagian teks UI berbahasa Indonesia ("PILIH UNTUK SPACE", menu portal) |

Metadata bersama diambil dari `src/app/site-metadata.ts`.

---

## `/` — Pengalih akar

- **Berkas**: `src/app/(id)/page.tsx:10-15`. Halaman server dengan `force-dynamic`.
- **Tujuan**: meneruskan pengunjung. Sesi hidup → `homeForRole(role)`. Tanpa sesi → `/masuk`.
- **Sumber data**: `sessionAccount(cookie)`, yang membaca tabel User di server.
- **UI**: tidak ada.
- **Status**: WORKING. Runtime `307 → /masuk` tanpa sesi. Cabang dengan sesi hanya didukung tes `homeForRole`.

## `/masuk` — Masuk

- **Berkas**: `src/app/(id)/masuk/page.tsx:7-15` dan `login-form.tsx:11-100`.
- **Tujuan**: autentikasi nama pengguna dan kata sandi, dengan opsi "Ingat saya".
- **Akses**: publik. Halaman ini **tidak** memeriksa sesi, sehingga pengguna yang sudah login tetap melihat form login.
- **Layout dan komponen**:
  - `AuthFrame` (`src/components/ops/auth-frame.tsx:30-100`): latar SVG nusantara, `AuthPointer`, `ZoneClocks` WIB/WITA/WIT, dan judul "{title} / Peta Operasi".
  - `PasswordField` (`src/components/ops/password-field.tsx:8-54`) dengan tombol tampil/sembunyi.
  - Ikon `lucide-react`.
- **Fitur dan interaksi**:
  - Validasi kosong di klien (`login-form.tsx:24-27`).
  - `POST /api/ops/login`.
  - Sesudah berhasil, halaman pindah memakai `window.location.assign`. Tujuannya `acceptedNext(next, allowed)`, atau `home` bila `next` tidak diterima (`login-form.tsx:47-49`).
  - Tautan ke `/lupa-sandi` dan `/daftar`.
  - Catatan "Setiap upaya masuk dicatat".
- **State**: `useState` untuk `error` dan `busy`. `useSearchParams` untuk `next`.
- **Loading, error, empty**:
  - Fallback Suspense "Memuat formulir..." (`page.tsx:10`).
  - Teks tombol "Memeriksa..." (`login-form.tsx:81`).
  - Galat ditampilkan dengan `role="alert"` (`:75-79`).
  - Kegagalan jaringan: "Jaringan bermasalah. Coba lagi."
- **Responsif**:
  - `AuthFrame` memakai `sm:` untuk ukuran SVG dan padding, serta varian kustom `short:` untuk layar pendek (misalnya `short:space-y-3.5`, `short:hidden`).
  - Tinggi minimum `min-h-[100svh]`.
- **Status**: WORKING. Runtime 200, dan `login/route.test.ts` (7 tes) menguji cookie, pesan galat yang sama, home per peran, akun nonaktif/pending, dan rate limit. Tampilan: `screenshots/masuk-desktop.png`, `screenshots/masuk-mobile.png`.

## `/daftar` — Pendaftaran akun

- **Berkas**: `src/app/(id)/daftar/page.tsx:6-12` dan `register-form.tsx:11-124`.
- **Tujuan**: pendaftaran mandiri. Akun dibuat sebagai `PENDING` dengan peran `ANALYST` (`register/route.ts:26-37`).
- **Komponen**: `AuthFrame`, `PasswordField` (dua kali).
- **Isian**: nama lengkap, nama pengguna, email, satuan atau instansi, pangkat atau jabatan, kata sandi, dan konfirmasi.
- **Validasi**:
  - Klien (`register-form.tsx:26-42`): regex nama pengguna, regex email, `passwordProblem`, dan konfirmasi.
  - Server: `parseRegister` (`access.ts:317-339`).
- **Sesudah berhasil**: form diganti panel `role="status"` berisi pesan server, catatan "Anda belum masuk…", dan tombol "Kembali ke masuk" (`:73-83`).
- **State**: `error`, `message`, `busy`.
- **Loading**: teks tombol "Mengirim...".
- **Responsif**: mengikuti `AuthFrame`.
- **Status**: WORKING. Runtime 200, dan `register/route.test.ts` membuktikan akun pending dibuat tanpa sesi serta respons duplikat sama dengan respons sukses. Tampilan: `screenshots/daftar-desktop.png`, `screenshots/daftar-mobile.png`. Kolom form daftar belum memakai ikon dan placeholder seperti form masuk.

## `/lupa-sandi` — Lupa kata sandi

- **Berkas**: `src/app/(id)/lupa-sandi/page.tsx` dan `forgot-form.tsx:7-70`.
- **Tujuan**: meminta tautan reset lewat email.
- **Fitur**: satu isian email, lalu `POST /api/ops/password/forgot`. Server selalu menjawab `PUBLIC_RESET_MESSAGE` (`src/lib/ops/reset-token.ts:5-6`), kecuali untuk format email yang salah (400) atau rate limit (429).
- **Status**: PARTIAL.
  - Halaman 200, dan tes `forgot/route.test.ts` membuktikan pesannya sama untuk email yang dikenal maupun tidak.
  - **Pengiriman surel UNVERIFIED**. Bila `smtpConfigured()` atau `resetOrigin()` belum diset, tidak ada tautan yang dibuat. Kejadian itu hanya diaudit sebagai `unconfigured` atau `no_origin` (`forgot/route.ts:29-38`).
  - Tampilan: `screenshots/lupa-sandi-desktop.png`, `screenshots/lupa-sandi-mobile.png`; atur sandi tanpa token: `screenshots/atur-sandi-desktop.png`.

## `/atur-sandi` — Atur kata sandi baru

- **Berkas**: `src/app/(id)/atur-sandi/page.tsx` dan `reset-form.tsx:9-85`.
- **Tujuan**: menetapkan kata sandi baru dari token di URL. Token berlaku 30 menit dan hanya sekali pakai.
- **Keadaan tampilan**:
  - Tanpa `token`: muncul alert "Tautan reset tidak lengkap. Minta tautan baru" (`:49-58`).
  - Sesudah berhasil: pesan dan tombol "Masuk" (`:60-69`).
- **Validasi klien**: hanya kesamaan konfirmasi. Kebijakan kata sandi diperiksa di server.
- **Status**: PARTIAL. Halaman 200, dan `reset/route.test.ts` (3 tes) membuktikan token sekali pakai, token kedaluwarsa, konfirmasi berbeda, dan kata sandi lemah. Alur ujung-ke-ujung bergantung pada SMTP dan statusnya UNVERIFIED.

## `/peta` — Peta operasional (Monitoring Dashboard)

- **Berkas**:
  - `src/app/(en)/peta/page.tsx:9-24`: halaman server. Membaca `kotamaops.findMany` lalu meneruskan `role`, `userName`, dan `tileProxy`.
  - `src/app/(en)/peta/monitoring-dashboard.tsx` (1466 baris, client).
- **Tujuan**: HUD peta global/NKRI dengan layer intelijen (CCTV, gempa, cuaca, berita, pesawat, maritim, satelit, kebakaran, GDELT, Kotamaops).
- **Akses**: semua peran aktif. `deniedPage` tidak menolak `/peta`. Tidak ada pembedaan fitur per peran di halaman ini, kecuali `CctvTokenButton`, yang tetap tampil untuk semua peran tetapi API-nya admin saja.
- **Panel utama** (rangkuman tingkat halaman; detail komponen di luar cakupan dokumen ini):

| Panel | Lokasi pemakaian | Catatan |
|---|---|---|
| `OsirisMap` (MapLibre, `ssr:false`) | `:30`, `:816` | Dibungkus `ErrorBoundary name="Map"` (`:815`) |
| `LayerPanel` | desktop `:1021`, mobile `:1317` | Toggle layer; `activeLayers` diserialkan ke `?layers=` (`:319-326`) |
| `LiveAlerts` (+ `AiOverview` di dalamnya, `LiveAlerts.tsx:782`) | `:1063` | Gempa, peringatan cuaca, berita, feed live; `AiOverview` → `POST /api/ai/overview` |
| `IntelFeed` | mobile `:1323` | Tab "INTEL" |
| `GlobalStatusBar` | `:1456` | Mengambil `/api/earthquakes` sendiri, terpisah dari dashboard |
| `CameraViewer` | `:1394-1400` | Terbuka saat entitas CCTV diklik (`:406`); tombol "PILIH UNTUK SPACE" |
| `CctvPreviews` | di dalam `OsirisMap.tsx:2647` | Pratinjau CCTV di peta |
| `SpaceCam` | `:1042` | Daftar CCTV terpilih dan tautan ke `/peta/multiview` (`SpaceCam.tsx:66`) |
| `FlightWatchPanel` | `:927` | `/api/aircraft`, `/api/flight-route` |
| `SearchBar` | desktop `:1109`, mobile `:1326` | `/api/geosearch` |
| `DirectionsBar` + `NavigationView` | `:901`, `:864` | `/api/directions`, `/api/geo` |
| `DrawingToolbar` / `DrawHud` (AOI) | `:1405-1416` | AOI disimpan di `localStorage` (`:421-428`); ekspor GeoJSON |
| `ArcGISPanel`, `SharePanel`, `ViewPresets`, `KeyboardShortcuts`, `CctvTokenButton`, `PortalMenu` | `:1135`, `:1327`, `:1319`, `:1453`, `:1013/1027`, `:1003/1011` | — |

- **Sumber data**:
  - Server: tabel Kotamaops saja.
  - Klien, lewat `fetchEndpoint` (`:491-517`):
    - Saat mount: `/api/earthquakes`, `/api/news`, `/api/weather`, dengan polling 15, 5, dan 5 menit (`:520-551`). Polling dilewati saat tab tersembunyi.
    - Saat sebuah layer dinyalakan: `onceFeeds` dan `pollFeeds` (`src/lib/layer-feeds`).
    - Katalog CCTV: `/api/cctv` (`src/lib/camera-catalog.ts:46`).
    - Lainnya: `/api/stats` (`:330`), `/api/geo/reverse`, `/api/region-dossier` (`:383-402`).
  - Respons 401 dari feed → `window.location.assign('/masuk?next=/peta')` (`:499-502`).
- **State**:
  - `useState`/`useRef` lokal, dengan banyak state di satu komponen.
  - `?layers=` di URL (`replaceState` dengan debounce 1,5 detik).
  - `localStorage` untuk AOI dan `atlas.spaceCams` (`src/lib/space-cams.ts:5`).
  - Pengaturan gaya dari `loadSavedSettings`.
- **Loading, error, empty**:
  - Splash bertahap; paling lama 7 detik (`:278-297`).
  - Indikator "STATUS: LIVE/CONNECTING/ERROR" (`:989`).
  - Dossier wilayah menampilkan loading (`:1360-1367`).
  - Galat feed hanya muncul di `console.warn`, tidak di UI.
- **Responsif**:
  - `useIsMobile()` (`src/components/dashboard-chrome.tsx:7-15`): `w<768` atau `(h<500 && w<1024)`.
  - Desktop: sidebar `LayerPanel` dan strip alat kanan (`:1026`).
  - Mobile: navigasi bawah LAYERS/INTEL/SEARCH/ROUTE (`:1244-1330`) dan menu portal di kanan atas (`:1009-1015`).
- **Status**: UNVERIFIED secara visual dan fungsional di halaman.
  - Pengalihan tanpa sesi WORKING (runtime).
  - Unit yang teruji: `LiveAlerts.test.ts` (9), `DirectionsBar.test.ts`, `FlightWatchPanel.test.ts`, `ScaleBar.test.ts`, serta banyak `api/cctv/*.test.ts` (adaptor feed). Tes-tes ini tidak membuktikan halaman merender dengan benar.

## `/peta/multiview` — Multiviewer CCTV

- **Berkas**:
  - `src/app/(en)/peta/multiview/page.tsx:9-13`: penjaga sesi. Tanpa sesi → `/masuk?next=/peta`.
  - `multiview.tsx:42-145`.
- **Tujuan**: grid penuh layar untuk CCTV yang dipilih di `/peta` ("PILIH UNTUK SPACE").
- **Fitur**:
  - Preset tata letak AUTO, 1, 2×2, 3×3, 4×4, beserta paginasi.
  - Layar penuh.
  - Pintasan keyboard F, 0–4, dan ←/→ (`:67-78`).
  - Tombol hapus per tile.
- **Data**: `useSpaceCams()`, yaitu `localStorage` per browser. Feed dimuat lewat `useCameraFeed` (`src/components/camera-feed-view.tsx`: `/api/cctv/resolve`, HLS).
- **Empty state**: "Belum ada CCTV dipilih…" (`:128-132`).
- **Responsif**: grid CSS dinamis, tanpa breakpoint.
- **Status**: UNVERIFIED.
- **Masalah**: tujuan `next` mengarah ke `/peta`, bukan ke multiview (dibuktikan runtime). Daftar kamera tidak ikut pindah perangkat atau browser.

## `/operator` — Dashboard Operator

- **Berkas**:
  - `src/app/(id)/operator/page.tsx:9-72` (server).
  - `src/components/ops/operator-dashboard.tsx:115-486` (client).
  - `src/app/(id)/operator/operator-board.tsx:28-249` (form situasi).
- **Tujuan**: ringkasan status Kotamaops (KONDUSIF/WASPADA/SIAGA), daftar dan form pembaruan situasi, peta tersemat, riwayat simpanan, dan probe kesehatan.
- **Akses**: semua peran aktif.
  - `canWrite` (empat peran) mengaktifkan form simpan.
  - ANALYST dan PIMPINAN melihat "Peran ini membaca situasi terkini dan tidak menyimpan perubahan." (`operator-board.tsx:144`).
  - OPERATOR_KODAM hanya melihat satuannya sendiri (`situationWhere`).
- **Komponen dan bagian**:
  - Sidebar yang bisa diciutkan, berisi Dasbor/Peta/Situasi/Pengguna (`:151-156`, `:180-214`).
  - Header berisi `WibNow`, identitas, dan `PortalMenu`.
  - "Ringkasan" dengan 5 angka dan teks Karhutla (`karhutlaScope`).
  - "Situasi satuan": cari, filter status, urut Terbaru/Terlama, 8 baris per halaman (`PAGE_SIZE`, `:20`).
  - "Formulir situasi" (`OperatorBoard`).
  - "Peta situasi": `<iframe src="/peta">` (`:434-436`).
  - "Riwayat simpanan": maksimal 20 entri.
  - "Status proses": `/api/health` setiap 60 detik (`:80-107`).
- **Sumber data**:
  - Server: `situation.findMany` dan `situationRevision.findMany` (`take: 20`) dengan cakupan peran (`page.tsx:12-28`).
  - Klien: `PATCH /api/ops/situations/:id` dan `GET /api/health`.
  - `GET /api/ops/situations` ada tetapi tidak dipakai UI.
- **State**: `useState` untuk `rows`, `extra` (revisi lokal), `query`, `status`, `direction`, `page`, `mapState`, dan `open`. Kunci simpan per baris memakai `useRef(Set)` (`situation-save.ts:31-66`). Pemilihan satuan lewat hash `#satuan-<id>` (`operator-board.tsx:51-61`).
- **Loading, error, empty**:
  - "Membuka peta." sampai iframe memicu `onLoad`.
  - Probe: "Memeriksa…/merespons/tidak merespons".
  - Empty: "Tidak ada Kotamaops pada cakupan akun ini." dan "Tidak ada satuan yang cocok…" (`:316-319`), "Belum ada riwayat simpanan…" (`:444-445`).
  - Pesan simpan muncul di `role=status` atau `role=alert` (`operator-board.tsx:137-143`).
- **Responsif**:
  - Sidebar `md:flex-row` dengan lebar `md:w-52` atau `md:w-14`.
  - Daftar berbentuk kartu `md:hidden`, tabel `hidden md:block`, kolom Lokasi `2xl:table-cell`.
  - Grid angka `grid-cols-2 sm:grid-cols-3 xl:grid-cols-5`.
  - Dua kolom pada `xl:grid-cols-2`.
  - Tinggi peta `h-[52vh] md:h-[58vh] xl:h-[64vh]`.
- **Status**: UNVERIFIED (render).
  - Teruji: `situation-save.test.ts` (6, termasuk anti-dobel-submit), `operator-view.test.ts` (4), `rbac.integration.test.ts` (filter dan tulis situasi berdasarkan peran sesi), dan `access.test.ts` (`parseSituation`).
  - Bagian "Status proses" sendiri menyatakan "CCTV, feed peta, bencana alam, unjuk rasa, laporan verifikasi, dan peringatan feed: Belum tersedia." (`:472-475`). Bagian itu **PARTIAL** menurut pengakuan kodenya sendiri.

## `/pengguna` — Manajemen pengguna dan Jejak autentikasi

- **Berkas**:
  - `src/app/(id)/pengguna/page.tsx:31-101` (server).
  - `user-board.tsx:58-332` (client).
  - `OpsShell` (`src/components/ops/ops-shell.tsx:4-36`).
- **Tujuan**: persetujuan akun pending, edit peran/Kotamaops/status/kata sandi, pembuatan pengguna baru, dan tabel audit autentikasi.
- **Akses**: SUPER_ADMIN dan ADMIN. Non-admin dialihkan (307) ke `homeForRole` oleh proxy, dengan penjagaan ulang di `page.tsx:34`. Tidak ada pesan 403. Akun SUPER_ADMIN terkunci untuk ADMIN (`user-board.tsx:234`, `:258-260`).
- **Komponen dan bagian**:
  - "Menunggu persetujuan (n)": kartu selalu terbuka, dengan tombol Setujui/Tolak.
  - "Akun terdaftar (n)": kartu akordeon, dengan tombol Simpan pengguna/Nonaktifkan/Aktifkan.
  - Aside "Pengguna baru": form buat.
  - Tabel "Jejak autentikasi": 80 entri terbaru, dengan label aksi berbahasa Indonesia (`page.tsx:10-25`).
- **Sumber data**:
  - Server: `user.findMany`, `kotamaops.findMany`, `authAudit.findMany` (`take: 80`) (`page.tsx:35-43`).
  - Klien: `POST /api/ops/users` dan `PATCH /api/ops/users/:id`.
  - `GET /api/ops/users` dan `GET /api/ops/audit` ada tetapi tidak dipakai UI.
- **State**: `useState` untuk `users`, `error`, `info`, dan `openId`. Edit bersifat optimistis lokal lewat `change()` sampai disimpan. Isian kata sandi tidak terkontrol dan dibaca lewat `document.getElementById` (`:306-308`).
- **Loading, error, empty**:
  - "Tidak ada akun yang menunggu." (`:146`).
  - "Belum ada catatan." untuk audit (`page.tsx:66`).
  - Galat dan info dalam satu banner bersama (`:137-141`).
  - **Tidak ada state busy atau loading** pada tombol buat, simpan, setujui, atau tolak.
- **Responsif**:
  - `lg:grid-cols-[minmax(0,1fr)_340px]`, aside `lg:sticky`.
  - Isian kartu `sm:grid-cols-2`.
  - Tabel audit `min-w-[640px]` dengan `overflow-auto` dan `max-h-[28rem]`.
- **Status**: UNVERIFIED (render). API teruji di `users/route.test.ts` (14 tes, termasuk penolakan `confirmPassword` kosong atau berbeda, `:275-278`), RBAC audit di `rbac.integration.test.ts:126-133`, dan `parseUserPatch` di `access.test.ts:107-140`.

---

## Temuan UX lintas halaman (dari kode)

1. `/masuk` tidak mengalihkan pengguna yang sudah login. Sebaliknya `/` mengalihkan (`(id)/page.tsx:13`).
2. `/peta/multiview` tanpa sesi kehilangan tujuan, karena `proxy.ts:35` memetakan semua `/peta*` ke `/peta` (dibuktikan runtime).
3. Tidak ada halaman 403, 404, atau error khusus. Halaman 404 memakai bawaan Next.js (runtime 404).
4. `/operator` menyematkan seluruh `/peta` dalam iframe, sehingga semua feed dan polling peta berjalan dobel bila tab `/peta` juga terbuka. Teks "Belum tersedia" untuk CCTV dan feed bertentangan dengan `/peta` yang menampilkan keduanya.
5. `/pengguna` tidak punya state busy, tidak punya konfirmasi untuk Tolak/Nonaktifkan, dan tabel audit tidak diperbarui sesudah aksi (perlu muat ulang). Detail di `04_ATLAS_USER_FLOWS.md`.
6. `CctvTokenButton` tampil untuk semua peran di `/peta`. Non-admin baru tahu ditolak setelah dialog dibuka (`CctvTokenButton.tsx:35-46`).
7. Atribut bahasa campur: `/peta` memakai `lang="en"` tetapi menampilkan sebagian label berbahasa Indonesia.
