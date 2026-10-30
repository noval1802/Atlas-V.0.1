# 06 — Analisis Celah UX ATLAS (AS-IS → Premium Hybrid)

Tanggal: 2026-10-30. Sumber: dokumen 00–05 di folder ini, tangkapan layar `screenshots/`, dan **verifikasi ulang di kode sumber** (setiap rujukan `file:line` di bawah dibaca ulang pada tanggal ini). Tidak ada kode, konfigurasi, atau DB yang diubah. Tidak ada login, build, atau akses jaringan luar.

## Cara membaca

**Prioritas**

| Kode | Arti |
|---|---|
| UX-P0 | Menghalangi tugas penting atau berisiko memicu kesalahan operator |
| UX-P1 | Sangat mengganggu alur utama |
| UX-P2 | Efisiensi atau keterbacaan |
| UX-P3 | Polesan visual |

**Jenis bukti**: `runtime/screenshot` (dilihat/diminta langsung), `test` (dijaga vitest), `code-only` (terbaca jelas di kode, belum dilihat di layar), `UNVERIFIED` (dugaan yang perlu dibuktikan dengan login atau jaringan).

**Pemisahan**: bug fungsional dan masalah UX yang terukur ditulis sebagai isu. Preferensi selera (mis. "kurang premium") **tidak** dinilai sebagai bug; itu ada di §15.

Singkatan path: `BOARD` = `src/app/(id)/pengguna/user-board.tsx`, `PAGE` = `src/app/(id)/pengguna/page.tsx`, `DASH` = `src/app/(en)/peta/monitoring-dashboard.tsx`, `OPD` = `src/components/ops/operator-dashboard.tsx`, `CSS` = `src/app/globals.css`, `MAP` = `src/components/OsirisMap.tsx`.

### Koreksi terhadap dokumen sebelumnya

- `ONLINE` palsu ada di `src/components/GlobalStatusBar.tsx:74-76` (titik hijau `:75`, teks `:76`), bukan `:73`.
- Jumlah kelas Tailwind teks ≤9.5px (`text-[5–9.5px]`) di TSX saat ini: **143** (grep), sejalan dengan perkiraan ±150 di doc 03 (yang juga menghitung inline dan kelas CSS).
- `/api/stats`: temuan baru — state `globalStats` **tidak pernah dirender** (hanya `useState` di `DASH:91` dan setter di `DASH:334`). Jadi dugaan "stats kosong" tidak tampak di layar; dampaknya beban server, bukan tampilan (UX-24).
- `LiveAlerts` di mobile: diverifikasi. Tab INTEL (`IntelFeed`) hanya memuat `data.news` (`src/components/IntelFeed.tsx:49`), jadi peringatan resmi cuaca dan gempa sama sekali tidak terjangkau di ponsel.

---

## 1. Arsitektur informasi

**UX-01 — Status sistem tidak jujur: "ONLINE" statis dan "STATUS: LIVE" yang tidak pernah turun** · **UX-P0**
- Bukti: `GlobalStatusBar.tsx:74-76` merender titik hijau berdenyut + teks `ONLINE` tanpa kondisi apa pun. `DASH:507` men-set `connected` pada respons sukses pertama; respons non-OK (`DASH:503-510`) tidak mengubah status, hanya exception jaringan yang men-set `error` (`DASH:511-513`). Indikator di `DASH:989`. Tidak ada stempel "terakhir diperbarui" di dashboard (grep `lastUpdate|updatedAt|fetchedAt` di `DASH` dan `LayerPanel.tsx`: 0).
- Dampak: di pusat komando, operator melihat "ONLINE/LIVE" walau feed gempa/cuaca/berita gagal (mis. 5xx) atau basi berjam-jam. Keputusan bisa diambil dari data usang. Galat feed hanya ke `console.warn`.
- Jenis: code-only.

**UX-02 — Beranda admin adalah manajemen pengguna, bukan gambaran operasional** · UX-P3
- Bukti: `homeForRole` → `/pengguna` untuk admin (`src/lib/ops/access.ts:66-70`).
- Dampak: admin yang juga memantau harus berpindah menu setiap login. Ini keputusan produk; dicatat, bukan bug.
- Jenis: code-only (tested: `rbac.integration.test.ts:108-124`).

**UX-03 — Bagian "Status proses" di /operator menyatakan CCTV & feed "Belum tersedia", padahal /peta (di iframe yang sama) menampilkannya** · UX-P2
- Bukti: `OPD:472-475` vs iframe `/peta` di `OPD:435`.
- Dampak: pesan bertentangan di satu layar; operator tidak tahu mana yang benar.
- Jenis: code-only.

## 2. Navigasi

**UX-04 — Peringatan resmi (LiveAlerts) tidak terjangkau di mobile** · **UX-P1**
- Bukti: tombol dan panel `LiveAlerts` hanya di strip alat `{!isMobile && …}` (`DASH:1026`, tombol `:1050`, panel `:1061-1063`). Navigasi bawah mobile hanya LAYERS/INTEL/SEARCH/ROUTE (`DASH:1245-1252`). `IntelFeed` hanya berita (`IntelFeed.tsx:49`). SpaceCam juga hanya di strip desktop.
- Dampak: pengguna ponsel (PIMPINAN/ANALYST di lapangan) tidak bisa melihat peringatan cuaca/gempa resmi — konten yang menurut komentar kode "the one thing in the panel a reader may have to act on" (`DASH:530-532`).
- Jenis: code-only (render mobile UNVERIFIED).

**UX-05 — Multiviewer kehilangan tujuan setelah login** · UX-P2
- Bukti: runtime `GET /peta/multiview` → `307 /masuk?next=%2Fpeta` (doc 01). Tiga titik yang memaksa ini: `src/proxy.ts:35`, `src/app/(en)/peta/multiview/page.tsx:11`, dan `allowedNext` tanpa `/peta/multiview` (`access.ts:119-123`).
- Dampak: tautan multiviewer yang dibagikan selalu mendarat di peta; pengguna harus mencari tombol SPACE lagi.
- Jenis: runtime.

**UX-06 — Peran tak berizin dialihkan diam-diam, tanpa halaman 403/404/error khusus** · UX-P2
- Bukti: tidak ada `not-found.tsx`, `error.tsx`, `global-error.tsx`, `loading.tsx` di `src/app` (find: 0). `/tidak-ada` → 404 bawaan Next.js (runtime, doc 01). `deniedPage` mengalihkan tanpa pesan (`access.ts:85-90`).
- Dampak: tampilan 404 putih generik di luar identitas ATLAS; non-admin yang membuka tautan `/pengguna` tidak tahu mengapa dipindah.
- Jenis: runtime (404) + code-only.

**UX-07 — `/masuk` tidak mengalihkan pengguna yang sudah login** · UX-P3
- Bukti: `src/app/(id)/masuk/page.tsx` tidak memeriksa sesi, sedangkan `/` memeriksa (`src/app/(id)/page.tsx:10-15`).
- Jenis: code-only.

## 3. Hierarki visual

**UX-08 — Form registrasi tidak setara dengan form login yang sudah didesain ulang** · UX-P2
- Bukti: `screenshots/daftar-desktop.png` vs `masuk-desktop.png`. Login memakai ikon + placeholder (`login-form.tsx:61-70`); daftar memakai `authField` polos tanpa ikon/placeholder (`register-form.tsx:89-105`). Dengan 7 isian, tombol kirim berada di bawah lipatan pada 1366×768 (screenshot terpotong di "Konfirmasi kata sandi").
- Dampak: tidak ada petunjuk format (nama pengguna huruf kecil, sandi ≥12) sebelum galat; langkah terpenting (kirim) tidak terlihat tanpa gulir.
- Jenis: screenshot + code-only.

**UX-09 — Kartu pengguna menampilkan edit yang belum disimpan seolah sudah tersimpan** · UX-P2
- Bukti: `change()` menulis langsung ke `users` (`BOARD:125-127`); badge peran/status membaca baris yang sama (`BOARD:250-255`); gagal simpan tidak me-rollback (`BOARD:117-120`).
- Dampak: badge bisa memperlihatkan peran yang tidak ada di DB.
- Jenis: code-only.

## 4. Spasi & perataan

**UX-10 — Di layar < lg, form "Pengguna baru" jatuh di bawah seluruh daftar, sedangkan banner hasil ada di atas** · UX-P2
- Bukti: grid `BOARD:133`, banner `BOARD:137-141`, aside `BOARD:170`.
- Dampak: setelah submit di mobile, pesan galat/sukses tidak terlihat dari posisi form.
- Jenis: code-only (tampilan UNVERIFIED).

## 5. Tipografi & keterbacaan

**UX-11 — Label navigasi bawah mobile 6px, turun ke 5px di ≤390px dan landscape** · **UX-P1**
- Bukti: `.mobile-nav-btn { font-size: 6px }` (`CSS:451-455`), `5px` di `CSS:513` dan `CSS:524`; label disembunyikan total di landscape (`CSS:526`). Dipakai di `DASH:1280`.
- Dampak: satu-satunya navigasi mobile praktis tidak terbaca di iPhone standar (390px).
- Jenis: code-only.

**UX-12 — Teks HUD < 10px tersebar luas** · UX-P2
- Bukti: 143 kelas `text-[5–9.5px]` di TSX; `.hud-label` 7px (`CSS:292-298`), dipakai dengan override inline `fontSize:'9px'` (`DASH:1311-1314`); popup peta `font-size:9px` inline (mis. `MAP:891,910,957,962`).
- Dampak: hitungan (AIR/SAT/CAM/WX, `DASH:1311-1314`) dan label alert sulit dibaca di monitor ruang komando dari jarak pandang; ukuran `px` tidak ikut skala root di ultrawide (doc 03 §3.2).
- Jenis: code-only.

## 6. Kontras

**UX-13 — `#5C5A54` (kontras 2.5–2.8:1) untuk metadata di popup dan LiveAlerts** · UX-P2
- Bukti: 46 kemunculan di `MAP`, 16 di `LiveAlerts.tsx` (grep), mis. `LiveAlerts.tsx:202,261,268,375` dengan ukuran 8.5–9px. Rasio dihitung di doc 03 §15.2.
- Dampak: waktu ("x menit lalu"), sumber, dan status rute gagal WCAG AA; kombinasi kecil + redup = tak terbaca.
- Jenis: code-only (rasio dihitung).

**UX-14 — `text-white/40` untuk stempel waktu akun** · UX-P3
- Bukti: `BOARD:246` (`text-[11px] text-white/40`, ≈3.7:1).
- Jenis: code-only.

## 7. Kegunaan form

**UX-15 — Tindakan berdampak tanpa konfirmasi: Tolak, Nonaktifkan, ubah peran, reset sandi** · **UX-P0**
- Bukti: tombol langsung memanggil `onSave` (`BOARD:294-299`, `:303-315`, `:317-325`). Nonaktifkan dan sandi baru menaikkan `sessionVersion` → target ter-logout (`src/app/api/ops/users/[id]/route.ts:54,64`). Tolak bersebelahan dengan Setujui.
- Dampak: salah klik mengeluarkan operator yang sedang bertugas atau menolak pendaftar; tidak ada undo selain "Aktifkan".
- Jenis: code-only (efek sesi: test `users/route.test.ts`).

**UX-16 — Tombol keputusan ikut mengirim edit yang belum disimpan** · **UX-P0**
- Bukti: `save()` selalu mengirim `name, role, kotamaopsId` dari state lokal (`BOARD:102-108`) lalu menambah `accountStatus` (`BOARD:109`). Setujui/Tolak/Nonaktifkan/Aktifkan memakai `save` yang sama (`BOARD:294,297,318,323`).
- Dampak: admin mengubah peran (belum "Simpan"), lalu menekan Nonaktifkan → peran ikut berubah tanpa niat. Audit mencatat `role_change` yang tidak disengaja.
- Jenis: code-only.

**UX-17 — Form tambah default `OPERATOR_KODAM` + "Tanpa Kotamaops": submit pertama pasti gagal** · UX-P1
- Bukti: `defaultValue="OPERATOR_KODAM"` (`BOARD:187`), opsi pertama `""` (`BOARD:198`); server menolak "Operator Kodam wajib diikat ke satu Kotamaops." (test `access.test.ts:61`). Select Kotamaops tetap aktif untuk peran lain dan nilainya dibuang server (test `access.test.ts:83`).
- Jenis: code-only + test (aturan server).

**UX-18 — Field sandi dikosongkan sebelum respons server** · UX-P1
- Bukti: `void onSave(...)` lalu langsung `field.value = ""` (`BOARD:308-310`).
- Dampak: sandi ditolak (lemah/konfirmasi beda) → admin mengetik ulang dua field tanpa tahu isian mana yang salah.
- Jenis: code-only.

**UX-19 — Form edit tanpa label terlihat; Kotamaops hanya kode; field sandi tampil di kartu PENDING tetapi diabaikan** · UX-P2
- Bukti: input hanya `aria-label`/placeholder (`BOARD:263-290`); opsi `{unit.code}` (`BOARD:281`) vs `code · name` di form tambah (`BOARD:201`); Setujui/Tolak mengirim `password: ""` (`BOARD:294,297`) padahal field sandi dirender untuk semua status (`BOARD:289-290`).
- Jenis: code-only.

**UX-20 — Form tambah tanpa ulangi sandi dan tanpa tombol tampilkan** · UX-P3
- Bukti: satu `<input type="password">` (`BOARD:183`); registrasi & edit memakai dua field; auth memakai `PasswordField` dengan toggle.
- Jenis: code-only.

## 8. Kegunaan tabel/daftar

**UX-21 — Daftar pengguna tanpa cari/filter/paginasi** · UX-P2
- Bukti: semua baris dirender (`BOARD:129-168`); bandingkan `/operator` yang punya cari, filter status, urut, 8 baris/halaman (`OPD` `PAGE_SIZE`).
- Dampak: dengan puluhan Kotamaops × operator, menemukan satu akun = gulir manual.
- Jenis: code-only.

**UX-22 — Tabel jejak autentikasi statis dan hasil mentah** · UX-P2
- Bukti: data hanya dari render server `take: 80` (`PAGE:37-41`); tidak di-refresh setelah aksi board; kolom Hasil `{row.result}` mentah (`PAGE:84`); tanpa filter/ekspor. `GET /api/ops/audit` tersedia tetapi tidak dipakai.
- Jenis: code-only.

## 9. Status umpan balik

**UX-23 — /pengguna tanpa state busy, klik ganda, dan galat jaringan tak tertangkap** · **UX-P1**
- Bukti: state hanya `users/error/info/openId` (`BOARD:67-70`); `await fetch` tanpa try/catch (`BOARD:78,111`); tombol tak pernah `disabled`.
- Dampak: double-submit (create kedua → 409), tidak ada tanda request berjalan, dan saat jaringan putus tidak ada pesan apa pun. Bandingkan `/operator` yang punya kunci anti-dobel (test `situation-save.test.ts`).
- Jenis: code-only.

Lihat juga UX-01 (status feed) — galat feed peta tidak pernah muncul di UI.

## 10. Responsif

UX-04, UX-10, UX-11 di atas. Tambahan:

**UX-25 — Peta dalam iframe /operator bisa jatuh ke tata letak mobile** · UX-P3
- Bukti: `useIsMobile` = `w<768 || (h<500 && w<1024)` (`src/components/dashboard-chrome.tsx:14`); iframe tinggi `52vh` (`OPD:434`), sehingga di tablet/laptop kecil bisa memicu cabang mobile di dalam iframe.
- Jenis: UNVERIFIED.

## 11. Aksesibilitas

**UX-26 — Fokus keyboard dihapus di HUD peta** · UX-P2
- Bukti: 12 `focus:outline-none` di 6 file (`ArcGISPanel`, `LayerPanel`, `CctvTokenButton`, `CctvPreviews`, `SatelliteCard`, `DASH`); sebagian diganti `focus-visible:ring-1 ring-white/50` (mis. `DASH:1029,1050`) yang tipis; `input[type=range] { outline: none }` (`CSS:2467`). Di /pengguna tombol tak punya `focus-visible` (aturan `.ops-scroll` hanya untuk input/select, `CSS:2609`).
- Jenis: code-only.

**UX-27 — Elemen tanpa nama/semantik** · UX-P2
- Bukti: tombol tutup drawer mobile hanya ikon `X` tanpa `aria-label` (`DASH:1305`); tooltip gempa hanya `onMouseEnter` (`GlobalStatusBar.tsx:56-57`), tak terjangkau keyboard; hanya 2 `role="dialog"` di seluruh TSX (`CctvTokenButton.tsx:97`, `SatelliteCard.tsx:93`); tautan popup `target="_blank"` tanpa `rel` (`MAP:896-898,1126`).
- Jenis: code-only.

**UX-28 — Bahasa campur dan `lang` salah** · UX-P2
- Bukti: `/peta` dirender di `(en)` dengan `lang="en"` (`src/app/(en)/layout.tsx:9-10`), sementara UI campur: "PILIH UNTUK SPACE", "Peta situasi" (Indonesia) vs `LAYERS/INTEL/SEARCH/ROUTE` (`DASH:1246-1252`), `ONLINE`, `Depth:`/`Time:` (`GlobalStatusBar.tsx:94-95`), `+ WATCH THIS AIRCRAFT` (`MAP:891`), SEVERE/MODERATE di LiveAlerts.
- Dampak: pembaca layar membaca teks Indonesia dengan fonetik Inggris; operator berganti bahasa antar panel.
- Jenis: code-only.

## 12. Performa yang dirasakan

**UX-24 — Fetch `/api/stats` yang tidak pernah ditampilkan, dan kemungkinan selalu kosong** · UX-P2
- Bukti: `DASH:329-337` memanggil `/api/stats`; `globalStats` tidak dibaca di mana pun (grep). Route mengambil 5 feed internal termasuk `/api/cctv` (~14MB menurut komentar `src/app/api/stats/route.ts:23-27`) **tanpa meneruskan cookie** (`route.ts:42-46`), sedangkan proxy menuntut sesi untuk semua `/api/*` kecuali daftar publik (`src/proxy.ts:18-20`, `src/lib/ops/gate.ts:6-14`).
- Dampak: tiap load peta memicu agregasi berat yang hasilnya dibuang; kemungkinan besar setiap sub-fetch dijawab 401 sehingga stats = 0. Status "selalu kosong": **UNVERIFIED** (perlu runtime dengan sesi).
- Jenis: code-only (tidak dirender) + UNVERIFIED (isi kosong).

**UX-29 — /operator menyematkan seluruh /peta dalam iframe** · UX-P2
- Bukti: `<iframe src="/peta">` (`OPD:435`) tanpa `loading="lazy"`; iframe menjalankan splash 2,2–7 detik (`DASH:265-272`), polling inti (`DASH:536-542`), dan `GlobalStatusBar` polling `/api/earthquakes` tiap 60 detik tanpa cek tab tersembunyi (`GlobalStatusBar.tsx:28-30`). Bila operator juga membuka tab `/peta`, semua polling berjalan dua kali. Respons 401 di dalam iframe memanggil `window.location.assign('/masuk?next=/peta')` (`DASH:499-501`) sehingga form login muncul **di dalam** kotak peta.
- Jenis: code-only (dobel polling bergantung perilaku pengguna).

**UX-30 — Transisi universal 600ms pada `*`** · UX-P3
- Bukti: `CSS:94-101`. Hover/warna terasa lamban di luar `.ops-scroll` (yang menimpa ke 180ms, `CSS:2603-2606`).
- Jenis: code-only.

## 13. Konsistensi

**UX-31 — Tiga bahasa visual tanpa komponen bersama** · UX-P3
- Bukti: latar `/pengguna` `bg-[#07070b]` + `white/xx` (`src/components/ops/ops-shell.tsx:16`), `/operator` memakai token `--bg-primary`/`--text-*` (`OPD:178`), auth memakai `--auth-*`; tombol primer ditulis ulang literal di `BOARD:206,294` dan `operator-board.tsx`; target sentuh `py-2 text-xs` di `BOARD` vs `min-h-11` di `OPD:175`.
- Jenis: code-only.

**UX-32 — CctvTokenButton tampil untuk semua peran** · UX-P2
- Bukti: dirender tanpa syarat peran (`DASH:1013`, `:1027`); komponen tak menerima `role` (`CctvTokenButton.tsx:13`); non-admin baru tahu ditolak setelah dialog terbuka (`:42-46`, 403 dari proxy).
- Jenis: code-only.

## 14. Keterpeliharaan desain

**UX-33 — Popup peta = string HTML mentah dengan gaya inline dan global window** · UX-P2
- Bukti: `setHTML(html)` (`MAP:849`); tombol `onclick="window.osirisWatchFlight…"` (`MAP:891`) yang didaftarkan di `DASH:153`; `innerHTML` susulan (`MAP:910-962`); warna/hex inline (popup bg `rgba(21,26,41,0.95)`, `#5C5A54`, `#78909C`). Escaping ada (`htmlEsc`/`urlSafe` di `src/lib/map-popup.ts:159,168`).
- Dampak: popup tidak ikut token/tema/Style Studio, tidak bisa diuji sebagai komponen, dan tiap perubahan visual menyentuh string 2675-baris `OsirisMap.tsx`.
- Jenis: code-only.

**UX-34 — `globals.css` 2746 baris dengan banyak kelas mati** · UX-P3
- Bukti: contoh 0 pemakaian TSX: `btn-tactical`, `gotham-card`, `glass-panel-interactive`, `data-grid-cell`, `layer-toggle-premium` (grep). Doc 03 memperkirakan ±40% mati.
- Jenis: code-only.

**UX-35 — Tema ghost menimpa `body.className`** · UX-P3
- Bukti: `document.body.className = …` (`DASH:231`) menghapus kelas lain di `<body>` (mis. `antialiased` dari `DocumentShell`); 566 hex literal tidak ikut tema (doc 03 §2.5).
- Jenis: code-only.

## 15. Catatan selera (bukan bug)

- Login/auth sudah paling dekat ke "Premium Hybrid" (navy, cyan sinyal, gold aksi); jadikan acuan, bukan sasaran perbaikan.
- Splash 2,2–7 detik adalah pilihan brand; hanya bermasalah di iframe /operator (UX-29).
- Warna di luar palet (`#FF4081`, `#39FF14`, `rose-*`) adalah keputusan identitas, dicatat di doc 03 §17.

---

## Top-10

| # | ID | Judul | Prio | Bukti |
|---|---|---|---|---|
| 1 | UX-15 | Tolak/Nonaktifkan/peran/reset sandi tanpa konfirmasi | P0 | code-only |
| 2 | UX-16 | Tombol keputusan mengirim edit yang belum disimpan | P0 | code-only |
| 3 | UX-01 | "ONLINE"/"LIVE" palsu, tanpa kesegaran data | P0 | code-only |
| 4 | UX-23 | /pengguna tanpa busy, double-submit, galat jaringan senyap | P1 | code-only |
| 5 | UX-04 | LiveAlerts (peringatan resmi) tak terjangkau di mobile | P1 | code-only |
| 6 | UX-17 | Default form tambah pasti gagal (KODAM tanpa Kotamaops) | P1 | code-only + test |
| 7 | UX-18 | Field sandi dikosongkan sebelum respons | P1 | code-only |
| 8 | UX-11 | Label nav mobile 5–6px | P1 | code-only |
| 9 | UX-29 | /operator menyematkan /peta penuh di iframe | P2 | code-only |
| 10 | UX-28 | Bahasa campur & `lang="en"` di /peta | P2 | code-only |

## Quick wins (kecil, risiko rendah)

1. `confirm`/dialog sebelum Tolak, Nonaktifkan, dan simpan dengan sandi/peran berubah (UX-15).
2. Tombol keputusan kirim hanya `accountStatus` dari nilai **tersimpan**, atau nonaktifkan tombol keputusan saat ada edit kotor (UX-16) — tetap patuhi kontrak "tepat satu dari `active`/`accountStatus`" (doc 07 §2).
3. State `busy` + `disabled` + try/catch di `create`/`save` (UX-23); kosongkan field sandi hanya setelah `response.ok` (UX-18).
4. Default peran form tambah ke peran tanpa Kotamaops, atau disable select Kotamaops bila bukan OPERATOR_KODAM (UX-17).
5. Hapus teks `ONLINE` statis atau ikat ke `backendStatus`; set `error` saat `!res.ok`; tampilkan "diperbarui HH:MM WIB" (UX-01).
6. Naikkan `.mobile-nav-btn` ke ≥10px, `.hud-label` ke ≥9px (UX-11/12).
7. Ganti `#5C5A54` dengan `var(--text-muted)` (UX-13).
8. Sembunyikan `CctvTokenButton` untuk non-admin (prop `role` sudah ada di dashboard) (UX-32).
9. Hapus fetch `/api/stats` yang tak dipakai (UX-24).
10. `rel="noopener noreferrer"` dan `aria-label` tombol tutup drawer (UX-27).

*Tidak dicek:* render aktual halaman bersesi (tanpa login), kontras di atas basemap, perilaku pembaca layar.
