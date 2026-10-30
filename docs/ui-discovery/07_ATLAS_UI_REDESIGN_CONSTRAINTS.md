# 07 — Batasan Redesign UI ATLAS ("Premium Hybrid")

Tanggal: 2026-10-30. Dasar: dokumen 00–06 dan verifikasi kode sumber pada tanggal ini. Dokumen ini adalah **pagar** untuk redesign visual (navy gelap, cyan, gold): apa yang tidak boleh rusak, apa yang aman diubah, dan tes yang wajib lulus. ID isu `UX-xx` merujuk ke `06_ATLAS_UX_GAP_ANALYSIS.md`.

Singkatan path sama dengan doc 06 (`BOARD`, `PAGE`, `DASH`, `OPD`, `CSS`, `MAP`) ditambah `ACCESS` = `src/lib/ops/access.ts`, `GATE` = `src/lib/ops/gate.ts`.

---

## 1. Fitur yang wajib dipertahankan

| Area | Fitur | Rujukan |
|---|---|---|
| Auth | Login + "Ingat saya" (8 jam / 14 hari), daftar mandiri → PENDING/ANALYST, lupa sandi (pesan netral), atur sandi via token 30 menit | doc 04 §1, §3, §8 |
| Auth | Toggle tampil/sembunyi sandi, jam WIB/WITA/WIT, catatan "Setiap upaya masuk dicatat" | `src/components/ops/password-field.tsx`, `zone-clocks.tsx`, `login-form.tsx` |
| /pengguna | Pemisahan "Menunggu persetujuan" vs "Akun terdaftar", buat akun, edit nama/peran/Kotamaops/aktif/sandi, kartu SUPER_ADMIN terkunci untuk ADMIN, tabel 80 jejak autentikasi | `BOARD:129-168,234,258-260`; `PAGE:37-41` |
| /operator | Ringkasan 5 angka, daftar situasi dengan cari/filter/urut/8 per halaman, formulir situasi, riwayat ≤20, probe `/api/health` 60 detik, peta situasi | `OPD:20,80-107`; `operator-board.tsx` |
| /peta | Semua layer + `?layers=` di URL, LiveAlerts + AiOverview, CCTV viewer + "PILIH UNTUK SPACE", SpaceCam → multiview, AOI (localStorage + ekspor GeoJSON), pencarian, rute + navigasi, FlightWatch, Style Studio, tema core/ghost, pintasan keyboard | doc 01 `/peta` |
| /peta/multiview | Preset grid AUTO/1/2×2/3×3/4×4, paginasi, layar penuh, pintasan F, 0–4, ←/→ | `src/app/(en)/peta/multiview/multiview.tsx:67-78` |
| Lintas | `PortalMenu` per peran + Keluar; `ErrorBoundary` "ATLAS Core" dan "Map"; `MotionConfig reducedMotion="user"`; dukungan `prefers-reduced-motion` | `document-shell.tsx:32`; `DASH:815` |

## 2. Interaksi yang tidak boleh berubah (kontrak perilaku)

1. **Id elemen sandi di kartu pengguna.** Handler Simpan membaca `document.getElementById("password-${row.id}")` dan `("password-confirm-${row.id}")` (`BOARD:306-307`). Jika input dipindah ke modal, dibuat controlled, atau id diganti, handler **harus** ikut diganti dalam commit yang sama; kalau tidak, sandi terkirim `""` = "tidak diubah" **tanpa galat**.
2. **`confirmPassword` wajib** setiap kali `password` diisi pada PATCH (`ACCESS:295-296`; test `users/route.test.ts:273-278`), juga di registrasi dan reset. Dua isian harus tetap ada di UI.
3. **Tepat satu dari `active` atau `accountStatus`** di body PATCH (`BOARD:109-110`). Tombol keputusan → `accountStatus`; Simpan → `active`. `accountStatus` mengalahkan `active` di `nextAccountState` (`ACCESS:172-187`, tested). Perbaikan UX-16 tidak boleh mengirim keduanya.
4. **Aturan pilihan peran**: `roleChoices` — ADMIN tidak pernah ditawari SUPER_ADMIN; kartu SUPER_ADMIN terkunci untuk ADMIN (`BOARD:52-56,234`). Server menjaga ulang (`superAdminRoleChangeError`, tested).
5. **Kotamaops**: `kotamaopsId` dikirim `null` untuk peran ≠ OPERATOR_KODAM (`BOARD:105`); OPERATOR_KODAM wajib punya Kotamaops (server). OPERATOR_KODAM hanya membaca/menulis satuannya (`situationWhere`, `mayWriteSituationRow`, `ACCESS:93-104`) dan 404 untuk satuan lain (bukan 403) agar keberadaan baris tidak bocor.
6. **Login `next`**: klien pindah dengan `window.location.assign(next ? acceptedNext(next, allowed) ?? home : home)` (`login-form.tsx:47-49`). Daftar putih `allowedNext` (`ACCESS:119-123`), hanya query `layers` ≤500 karakter yang dipertahankan (`ACCESS:126-140`, proxy `src/proxy.ts:35-37`). Jangan ganti ke `router.push` tanpa uji: navigasi penuh memastikan cookie baru dipakai server component.
7. **Sesi & redirect**: tanpa sesi → `/masuk?next=…` (proxy `:29-38`); non-admin di `/pengguna` → `homeForRole` (`deniedPage`); 401 dari feed peta → `/masuk?next=/peta` (`DASH:499-501`); logout menaikkan `sessionVersion` (semua perangkat keluar) lalu ke `/masuk`. Nonaktifkan/reset sandi menaikkan `sessionVersion` target.
8. **Pesan galat server** ditampilkan apa adanya dari `{ error }`; fallback klien ("Pengguna gagal dibuat.", "Perubahan gagal disimpan.", "Jaringan bermasalah. Coba lagi.", "Simpan gagal."). Live region `role="alert"`/`role="status"` harus tetap ada (`BOARD:134-135`, `operator-board.tsx:137-143`).
9. **Anti-dobel simpan situasi**: kunci per baris `useRef(Set)` (`src/lib/ops/situation-save.ts:31-66`, tested). Jangan dipindah ke state yang kehilangan kunci saat re-render.
10. **Pesan netral** di registrasi duplikat dan lupa sandi (anti-enumerasi). Redesign tidak boleh menambah petunjuk "akun sudah ada".
11. **Sandi tidak disimpan** di state/DOM setelah dikirim; `autocomplete="new-password"` / `current-password` dipertahankan.

## 3. API yang tidak boleh rusak

| Endpoint | Dipakai oleh | Request | Respons yang dibaca UI |
|---|---|---|---|
| `POST /api/ops/login` | `login-form.tsx:31-35` | `username, password, remember` | `ok, role, home, allowed` (`login/route.ts:56`), `error` |
| `POST /api/ops/logout` | `portal-menu.tsx:39`, `operator-board.tsx:100` | — | diabaikan |
| `POST /api/ops/register` | `register-form.tsx:46-49` | `name, username, email, organization, position, password, confirmPassword` | `message`/`error` |
| `POST /api/ops/password/forgot` | `forgot-form.tsx:25-28` | `email` | pesan netral |
| `POST /api/ops/password/reset` | `reset-form.tsx:30-33` | `token, password, confirmPassword` | pesan / `error` |
| `POST /api/ops/users` | `BOARD:78-88` | `name, username, password, role, kotamaopsId` | `UserRow` |
| `PATCH /api/ops/users/:id` | `BOARD:111-115` | `name, role, kotamaopsId, password, confirmPassword` + `active` **atau** `accountStatus` | `UserRow` |
| `GET /api/ops/users`, `GET /api/ops/audit` | belum dipakai UI (kandidat refresh UX-22) | — | `{audits:[{id,action,result,actor,target,ip,detail,createdAt}]}` |
| `PATCH /api/ops/situations/:id` | `situation-save.ts:54` | `status, personnel, deployed, incidentCount, note` | `id, code, name, region, location, status, personnel, deployed, incidentCount, note, updatedByName, updatedAt` (`situations/[id]/route.ts:30-44`) |
| `GET /api/health` | `OPD:87` | — | status proses |
| `GET /api/cctv/tokens`, `POST` | `CctvTokenButton.tsx:35,58` | per sumber | `sources[{id,label,hint,configured}]` |
| Feed peta | `DASH:489-546`, `src/lib/layer-feeds` | `/api/earthquakes`, `/api/news`, `/api/weather`, `/api/cctv`, `/api/aircraft`, `/api/geosearch`, `/api/directions`, `/api/geo/reverse`, `/api/region-dossier`, `/api/ai/overview`, `/api/cctv/resolve` | bentuk per transform; diuji per route |

`UserRow` (`BOARD:32-46`) = `presentUser` (`src/lib/ops/current-user.ts:21-37`) dan dibangun ulang di `PAGE:43-57`. Field: `id, name, username, email|null, organization, position, role, active, accountStatus, kotamaopsId|null, kotamaops{id,code,name}|null, lastLoginAt|null, createdAt`. `passwordHash`/`sessionVersion` tidak pernah ke klien. Galat selalu `{ error: string }`.

## 4. RBAC yang wajib tetap di server

- Proxy (`src/proxy.ts:14-47`): 401 tanpa sesi untuk semua `/api/*` kecuali `PUBLIC_API` (`GATE:6-14`); 403 non-admin untuk `isAdminApi` (users, audit, cctv/tokens; `GATE:22-30`); 403 tulis lintas situs.
- Server component: `currentUser()` + `canManageUsers` di `PAGE:31-33`; `canWrite` di `/operator`.
- Route: cek peran ulang di `users/route.ts`, `users/[id]/route.ts` (kunci SUPER_ADMIN, super admin terakhir), `situations/[id]/route.ts:10-15`, `audit/route.ts`.
- **Larangan**: jangan mengganti cek server dengan menyembunyikan tombol. Menyembunyikan `CctvTokenButton` untuk non-admin (UX-32) atau tombol peran di UI hanya **tambahan**; proxy dan route tetap menolak. Jangan membaca peran dari `localStorage`/URL.

## 5. Komponen yang aman di-refactor (risiko rendah)

| Komponen | Alasan | Syarat |
|---|---|---|
| `src/components/ops/ops-shell.tsx` (36 baris) | presentasional, hanya dipakai `/pengguna` | pertahankan `ops-scroll`, `PortalMenu` |
| `src/components/ops/portal-menu.tsx` | daftar dari `portalLinks` (tested) | jangan hitung tautan sendiri |
| Tabel audit di `PAGE:59-98` | server-rendered, read-only | tetap WIB, detail tersensor server |
| `UserCard` visual (`BOARD:215-332`) | logika di `save` | lihat §2.1, §2.3 |
| `GlobalStatusBar.tsx` (102 baris) | isolasi, satu fetch | perbaiki UX-01, jangan tambah polling |
| `password-field.tsx`, `zone-clocks.tsx` | kecil; `zone-clocks.test.ts` ada | dipakai 3–4 halaman auth |
| `SpaceCam`, `ViewPresets`, `KeyboardShortcuts`, `ScaleBar` | props sederhana | — |

## 6. Komponen berisiko tinggi

| Komponen | Risiko | Mitigasi |
|---|---|---|
| `src/components/OsirisMap.tsx` (2675 baris) | MapLibre, paint color dari `map-palette.ts`, popup string HTML (`MAP:849`), `innerHTML` susulan (`MAP:908-962` via `getElementById`), global `window.osirisWatchFlight` (`DASH:153`, `MAP:891`), `__osirisMap` dev (`MAP:797`) | ubah popup per jenis, satu per PR; jaga `htmlEsc/urlSafe` (`src/lib/map-popup.ts:159,168`); jangan ubah nama global tanpa mengubah pemanggil |
| `src/app/(en)/peta/monitoring-dashboard.tsx` (1466 baris) | banyak state di satu komponen, cabang `isMobile` paralel dengan CSS `.mobile-nav`, polling, splash, tema | jangan pecah dan restyle dalam PR yang sama |
| `src/components/LiveAlerts.tsx` (1028 baris) | parser severity/hitung mundur (tested 9), 16× `#5C5A54` | jalankan `LiveAlerts.test.ts`; ganti warna via token |
| Tema ghost & Style Studio | `body.className` ditimpa (`DASH:231`); Style Studio menulis var inline ke `<body>` + `<style id="osiris-style-studio">` (`src/lib/style-tokens.ts`); key `osiris:style-studio` | token baru harus punya nilai ghost + entri `DEFAULTS`; jaga nama var |
| `auth-frame.tsx` + varian `short:` | 4 halaman, `@custom-variant short` (`CSS:4`), font Archivo self-hosted, `.auth-*` (`CSS:2624-2746`) | uji 1366×768, 390×844, dan tinggi ≤820 |
| `globals.css` (2746 baris) | ±40% kelas mati, `*` transition (`CSS:94-101`), 8 blok reduced-motion | hapus CSS mati hanya dengan grep 0 pemakaian + build |

## 7. Ketergantungan lintas halaman

- `AuthFrame` + konstanta `authField/authButton/authLink` → `/masuk`, `/daftar`, `/lupa-sandi`, `/atur-sandi`. Mengubah satu = mengubah empat.
- `PasswordField` → login, daftar, atur sandi (bukan /pengguna).
- `globals.css` → semua halaman; token `:root` + `body.theme-ghost` + `.auth-root` + `.ops-scroll`.
- `/operator` **menyematkan `/peta` lewat iframe** (`OPD:435`): setiap perubahan `/peta` (splash, layout mobile, 401-redirect) muncul di dalam dasbor operator.
- `src/lib/layer-feeds` → `DASH`, `OsirisMap`, `LayerPanel`, `SharePanel` (dan `?layers=` yang dipakai proxy/login).
- `map-palette.ts` ↔ `--map-*` di CSS ↔ `style-tokens.ts` ↔ `CctvPreviews` (sinkron diuji `map-palette.test.ts`, `style-tokens.test.ts`).
- `portalLinks`/`homeForRole` → menu portal, sidebar operator, redirect login.
- `localStorage`: `atlas.spaceCams`, `osiris.aoi.shapes.v1`, `osiris:style-studio`. Mengganti key = data pengguna hilang.

## 8. Risiko migrasi styling

1. **Hex literal vs token**: 566 hex di TSX, 213 kelas `[#…]` (doc 03). Mengganti token tidak mengubah elemen ini; sebaliknya mengganti literal ke token mengubah tampilan di tema ghost/Style Studio. Ubah per komponen dan lihat kedua tema.
2. **Tailwind v4**: hanya 4 pemetaan `@theme inline` (`CSS:153-158`). Menambah `--color-primary` dll. aman, tetapi kelas arbitrer `bg-[var(--x)]/40` bergantung pada format var (hex vs `rgb` channel). Var `--gold-rgb`/`--cyan-rgb` dipakai `rgba(var(--…),a)` — jangan ubah ke hex.
3. **Varian kustom** `short:` hanya untuk auth; breakpoint JS `useIsMobile` tidak sama dengan breakpoint Tailwind (`md` 768 vs `h<500 && w<1024`).
4. **Paint peta** dibaca dari `map-palette.ts`/`readMapPalette`, bukan dari kelas Tailwind; warna layer di legenda dan di peta bisa berbeda bila hanya satu sisi diubah.
5. **Popup HTML** tidak bisa memakai kelas Tailwind yang tidak ter-scan (string di TS). Gunakan var CSS di string atau render React ke node.
6. **Font**: Inter/JetBrains Mono dari Google (`CSS:1`) vs Archivo self-hosted. Di jaringan tertutup HUD jatuh ke fallback; redesign tipografi harus memakai `next/font` atau berkas lokal.
7. **Kontras preset Style Studio** (PHANTOM, TERMINAL, ARCTIC, BLACKOUT, CRIMSON) gagal <3:1 (doc 03 §15.2); token teks baru harus dicek untuk tiap preset.

## 9. Risiko perubahan form & validasi

- Kebijakan sandi tunggal `prisma/password-policy.mjs` (`passwordProblem`) dipakai **klien** (`register-form.tsx:7,34`) dan **server** (`ACCESS:1,157`). Reset sandi memakai `passwordError` di route (`password/reset/route.ts:28`). Menambah validasi klien di /pengguna atau /atur-sandi harus mengimpor fungsi yang sama, bukan menyalin regex.
- Pesan server adalah sumber kebenaran (daftar lengkap: doc 05 §5.2). Validasi klien boleh mendahului, tetapi teksnya harus sama agar tidak ada dua versi aturan.
- Regex username `^[a-z0-9][a-z0-9._-]{2,31}$` ada di `ACCESS:21` dan klien registrasi; jaga sinkron.
- Validasi situasi (0–1.000.000, deployed ≤ personnel, catatan ≤2000) di `parseSituation`; atribut `max` di klien boleh ditambah, server tetap menolak.
- Mengubah default form (UX-17) tidak boleh membuat ADMIN bisa memilih SUPER_ADMIN.

## 10. Tes regresi wajib

**Perintah** (dari root repo; tanpa jaringan luar):

```bash
npx tsc --noEmit
npx eslint .                       # atau: npm run lint
npx vitest run                     # semua src/**/*.test.ts (environment node)
TEST_DATABASE_URL=postgresql://osiris@127.0.0.1:5433/osiris_ops_test npm run test:db
npm run build                      # postbuild menjalankan tools/check-artifact.mjs --report
node tools/check-artifact.mjs      # mode ketat sebelum distribusi
```

`test:db` hanya boleh ke `osiris_ops_test` di localhost (dijaga `src/lib/ops/test-db-guard.ts`).

**Berkas tes per area**

| Area | Berkas |
|---|---|
| Auth & sesi | `src/app/api/ops/login/route.test.ts`, `register/route.test.ts`, `password/forgot/route.test.ts`, `password/reset/route.test.ts`, `src/lib/ops/session.test.ts`, `reset-token.test.ts`, `rate-limit.test.ts`, `mail.test.ts`, `password-policy.test.ts`, `src/components/ops/zone-clocks.test.ts` |
| RBAC & proxy | `src/proxy.test.ts`, `src/lib/ops/gate.test.ts`, `rbac.integration.test.ts`, `access.test.ts` |
| /pengguna | `src/app/api/ops/users/route.test.ts` (POST + PATCH), `src/lib/ops/audit.test.ts`, `access.test.ts` |
| /operator | `src/lib/ops/situation-save.test.ts`, `operator-view.test.ts`, `src/app/api/health/route.test.ts`, `health/ready/route.test.ts` |
| /peta | `src/components/LiveAlerts.test.ts`, `DirectionsBar.test.ts`, `FlightWatchPanel.test.ts`, `ScaleBar.test.ts`, `LiveNewsPreviews.test.ts`, `src/lib/layer-feeds.test.ts`, `map-palette.test.ts`, `style-tokens.test.ts`, `map-popup.test.ts`, `space-cams.test.ts`, `aoi*.test.ts`, `src/app/api/stats/route.test.ts`, `src/app/api/cctv/**` |
| DB | `src/lib/ops/seed.db.test.ts`, `recover-admin.db.test.ts` |

**Celah yang perlu tes baru** (saat ini **tidak ada tes render UI atau E2E**; `vitest.config.ts:11-12` = `environment: 'node'`, `include: ['src/**/*.test.ts']`, jadi tes komponen `.tsx` butuh jsdom/happy-dom + `@testing-library/react`, belum terpasang):

1. `UserBoard`: tombol per status, `roleChoices` per aktor, kartu SUPER_ADMIN terkunci, body PATCH berisi `password`+`confirmPassword` (menjaga §2.1), `kotamaopsId:null` untuk non-Kodam, tepat satu dari `active`/`accountStatus`.
2. Konfirmasi & busy (setelah UX-15/23): request tidak terkirim sebelum konfirmasi; tombol disabled selama request.
3. Route: `account_reject`, `account_enable`, `active:false` pada REJECTED, 409 username ganda, Kotamaops tidak ditemukan.
4. `acceptedNext` untuk `/peta/multiview` bila UX-05 diperbaiki (+ `proxy.test.ts`).
5. `GlobalStatusBar`/indikator status: status turun ke error saat respons non-OK.
6. E2E (Playwright, belum ada): login per peran → home; approve akun; simpan situasi; buka `/peta` mobile 390×844; tangkapan layar halaman bersesi 1366×768 dan 390×844 untuk baseline visual.

## 11. Quick wins vs refactor besar

**Quick wins** (≤1 hari masing-masing, tanpa ubah API): daftar di doc 06 "Quick wins" (konfirmasi, busy, default form, ONLINE, ukuran font nav, `#5C5A54` → token, sembunyikan tombol token, hapus fetch `/api/stats`, `rel`/`aria-label`).

**Refactor besar** (perlu tes dulu):
1. Popup peta → komponen React ber-token (keluar dari `OsirisMap.tsx`).
2. Pecah `monitoring-dashboard.tsx` (state feed, HUD desktop, HUD mobile).
3. Skala token tipografi/radius/shadow/motion di `@theme`, migrasi 566 hex.
4. Bersihkan `globals.css` (CSS mati, transisi `*`).
5. Ganti iframe /operator dengan peta ringan khusus situasi.
6. Akses LiveAlerts di mobile (tab baru di nav bawah).

## 12. Urutan kerja yang disarankan

**Tiga halaman pertama**

1. **/pengguna** — memuat dua dari tiga isu P0 (UX-15, UX-16) dan tiga P1 (UX-17, UX-18, UX-23); kodenya kecil (`BOARD` 332 baris, `PAGE` ±100), terisolasi dari peta, API sudah teruji 14 tes. Visual paling jauh dari token (`#07070b`, `white/xx`). Risiko rendah, dampak keselamatan operasi tertinggi. Tulis tes `UserBoard` dulu (§10 celah 1).
2. **Halaman auth (konsistensi daftar/lupa/atur sandi dengan login)** — sudah paling dekat ke Premium Hybrid, sehingga menjadi **sumber token dan komponen** (field, tombol, panel) untuk halaman lain; perbaikan UX-08 kecil dan terlihat langsung di screenshot. Risiko: `AuthFrame` dipakai 4 halaman; uji `short:`.
3. **/operator** — halaman kerja utama operator; sudah memakai token dan target 44px, jadi redesign sebagian besar penyelarasan. Selesaikan UX-03 dan putuskan nasib iframe (UX-29) sebelum menyentuh `/peta`.

**/peta ditunda** sampai ada baseline visual/E2E: risiko tertinggi (OsirisMap 2675 + dashboard 1466 baris, tema, Style Studio, popup HTML). Pengecualian yang boleh lebih awal karena terisolasi: UX-01 (`GlobalStatusBar`), UX-11 (CSS nav mobile), UX-32, UX-24.

*Tidak dicek:* render halaman bersesi, perilaku Style Studio setelah diterapkan, E2E apa pun (tidak ada tooling).
