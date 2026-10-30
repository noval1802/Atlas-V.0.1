# 02 — Inventaris Komponen UI ATLAS (AS-IS)

> Dokumen discovery, read-only. Semua angka berasal dari `grep`/`wc` pada working tree `/home/wizard/Atlas-V.0.1` (30 Okt 2026).
> Path relatif terhadap root repo. Notasi `file:baris` merujuk baris sumber saat dokumen ditulis.
> Pemisahan istilah: **token terpusat** = CSS custom property di `src/app/globals.css` / konstanta kelas bersama; **hardcoded** = hex, px, inline style, nilai arbitrer Tailwind; **inferensi** = pola yang disimpulkan, ditandai eksplisit.

---

## 0. Ringkasan angka

| Metrik | Nilai | Sumber |
|---|---|---|
| File di `src/components/**` | 43 (36 `.tsx` non-test, 1 `.ts` data `nkri-outline.ts`, 6 test) | `find src/components -type f` |
| — di `src/components/ops/` | 9 `.tsx` + `nkri-outline.ts` + `zone-clocks.test.ts` | |
| File `.tsx` page-level di `src/app/**` | 19 (2 layout, 9 `page.tsx`, 8 komponen klien halaman) | |
| Komponen > 500 baris | **6**: `OsirisMap.tsx` 2675, `monitoring-dashboard.tsx` 1466, `LiveAlerts.tsx` 1028, `DirectionsBar.tsx` 940, `ArcGISPanel.tsx` 618, `LayerPanel.tsx` 508 (ditambah `ops/operator-dashboard.tsx` 499, di ambang) | `wc -l` |
| Total baris `src/components/**` | 11.708 | `wc -l` |
| Elemen `<button` di TSX | 138 | grep |
| `style={{` / `style="` inline | 162 di TSX React + 192 `style="` di string HTML `OsirisMap.tsx` | grep |
| Literal hex di TSX | 566 kemunculan; terbanyak `OsirisMap.tsx` (182 baris), `LiveAlerts.tsx` (70), `ArcGISPanel.tsx` (28), `monitoring-dashboard.tsx` (18) | grep `#[0-9a-f]{3,6}` |
| File yang memakai `framer-motion` | 15 (47 pemakaian `<motion.*>`/`AnimatePresence` hanya di `monitoring-dashboard.tsx`) | grep |
| File yang memakai `lucide-react` | 27 file, 29 pernyataan import, ±81 nama ikon unik | grep |
| `role="dialog"` | hanya 2 (`CctvTokenButton.tsx:97` dengan `aria-modal`, `SatelliteCard.tsx:93`) | grep |
| Pemakai `focus-visible` | 12 file; 0 di `OsirisMap`, `ArcGISPanel`, `DrawingToolbar`, `CameraViewer`, `SearchBar`, `DirectionsBar` | grep |

Dua "dunia" UI yang terpisah secara visual dan teknis:
1. **Peta / HUD** (`/peta`, `/peta/multiview`, layout `(en)`, bahasa Inggris): mono JetBrains, teks 7–11 px, glass panel, framer-motion, banyak hex hardcoded.
2. **Portal operasional & auth** (`/masuk`, `/daftar`, `/lupa-sandi`, `/atur-sandi`, `/operator`, `/pengguna`, layout `(id)`, bahasa Indonesia): `text-sm`, `min-h-11`, focus ring konsisten, token `var(--…)`, Archivo di halaman auth.

---

## 1. Layout & Navigation

| Komponen | Path | Props utama | Dipakai di | Catatan |
|---|---|---|---|---|
| `DocumentShell` | `src/components/ops/document-shell.tsx` | `lang: "id"\|"en"`, `children` | `(id)/layout.tsx`, `(en)/layout.tsx` | Root `<html>/<body className="antialiased">`, preconnect Google Fonts (`:15-16`), favicon, JSON-LD, membungkus `MotionPreference` + `ErrorBoundary name="ATLAS Core"`. |
| `MotionPreference` | `ops/motion-preference.tsx` | `children` | `DocumentShell` | `MotionConfig reducedMotion="user"` (`:7`) — satu-satunya penanganan reduced-motion untuk framer-motion. |
| `OpsShell` | `ops/ops-shell.tsx` | `title`, `subtitle`, `role?` | `(id)/pengguna/page.tsx` | Header `bg-[#07070b]` hardcoded (`:16`), eyebrow `text-[10px]` gold. Tidak dipakai oleh `/operator` (yang punya shell sendiri). |
| `OperatorDashboard` | `ops/operator-dashboard.tsx` (499) | `me`, `boardUser`, `canWrite`, `canManage`, `initial: SituationRow[]`, `revisions` | `(id)/operator/page.tsx` | Sidebar collapsible (`aside md:w-52/md:w-14`, `:180`), nav `aria-current`, tabel+kartu responsif, iframe `/peta` (`:435`), `StatusBadge` lokal (`:497`). Konstanta kelas lokal `control` (`:174`). |
| `PortalMenu` | `ops/portal-menu.tsx` | `role`, `name?`, `className?` | `OpsShell`, `OperatorDashboard`, `monitoring-dashboard.tsx` | Menu `role="menu"`, tutup via klik-luar & Escape + kembalikan fokus (`:22-35`), item `min-h-11`, logout state `Keluar...`. Panel `bg-[#0b0b12]` hardcoded (`:66`). **Satu-satunya komponen yang dipakai bersama peta dan portal.** |
| `AuthFrame` | `ops/auth-frame.tsx` | `title`, `subtitle`, `children` | 4 halaman auth (`masuk`, `daftar`, `lupa-sandi`, `atur-sandi`) | Font Archivo via `next/font/google` (`:8`), backdrop SVG NKRI, reticle, `ZoneClocks`, `AuthPointer`. Mengekspor konstanta `authField`, `authButton`, `authLink` (`:10-16`). |
| `AuthPointer` | `ops/auth-pointer.tsx` | – | `AuthFrame` | Menulis `--px/--py` ke `.auth-root`; hanya jika `pointer: fine` dan `prefers-reduced-motion: no-preference` (`:9`). |
| `ZoneClocks` | `ops/zone-clocks.tsx` | `zones` | `AuthFrame` | Jam WIB/WITA/WIT, interval 15 s. |
| Dashboard peta | `src/app/(en)/peta/monitoring-dashboard.tsx` (1466) | `kotamaops`, `role`, `userName`, `tileProxy` | `(en)/peta/page.tsx` | Orkestrator seluruh HUD: splash, header, tool rail kanan, mobile bottom nav + drawer, modal live feed, region dossier. 54 `useState`, 21 `useEffect`. |
| `dashboard-chrome` | `src/components/dashboard-chrome.tsx` | `useIsMobile()`, `WibClock`, `ActiveEntityCount`, `ViewSegment{active,onClick,title,icon,label,layoutId}` | `monitoring-dashboard.tsx` | `useIsMobile` = `w<768 \|\| (h<500 && w<1024)` (`:14`) — breakpoint JS paralel dengan media query CSS. `ViewSegment` memakai `motion.span layoutId` (`:79`). |
| `GlobalStatusBar` | `GlobalStatusBar.tsx` | `revealed?` | dashboard | Popover `bg-black/90 … text-[11px] font-mono` (`:84`). |
| `KeyboardShortcuts` | `KeyboardShortcuts.tsx` | – | dashboard | Overlay `glass-panel osiris-glow` (`:42`), Escape menutup (`:23`), tanpa `role="dialog"`. |
| Multiview | `src/app/(en)/peta/multiview/multiview.tsx` | – | `/peta/multiview` | Header `bg-[#07070b] text-[10px] font-mono` (`:82`), tombol preset `aria-pressed`. |
| Mobile bottom nav | `monitoring-dashboard.tsx:1243-1287` | – | `/peta` (mobile) | Kelas CSS `.mobile-nav*` (`globals.css:433-470`); label tombol **6 px** (5 px di ≤390 px). |

## 2. Buttons & Actions

Tidak ada komponen `<Button>` bersama. Pola yang ditemukan:

| Pola | Lokasi | Gaya | State |
|---|---|---|---|
| `authButton` (konstanta) | `ops/auth-frame.tsx:13` | gradien gold `color-mix(var(--gold-primary) 70%, white)→gold`, teks `#1a1404`, `text-[14px] tracking-[0.3em]`, `min-h-12`, glow `shadow-[0_0_24px_-6px_rgba(var(--gold-rgb),0.6)]`, efek `.auth-sheen` | hover `brightness-110`, active `scale-[0.99]`, focus-visible outline 2px gold, disabled `cursor-wait opacity-70`, label loading teks ("Memeriksa...") |
| Tombol primer portal | `operator-board.tsx:239`, `user-board.tsx:206,294` | `bg-[var(--gold-primary)] text-black font-bold text-xs/text-sm` | operator-board: `min-h-11`, focus-visible, disabled; user-board: **tanpa** min-h, focus-visible, atau disabled |
| Tombol sekunder portal | `user-board.tsx:297,312,318`; `operator-board.tsx:119`; `ops-shell.tsx:24` | `rounded border border-white/15–20 px-3 py-2 text-xs font-bold` | hanya hover di sebagian; danger memakai `border-rose-300/50 text-rose-200` (palet Tailwind, bukan token) |
| `control` (konstanta lokal) | `operator-dashboard.tsx:174` | input/select/pagination `min-h-11 … focus-visible:outline-[var(--gold-primary)]` | `disabled:opacity-40` |
| Rail ikon peta | `monitoring-dashboard.tsx:1026-1140` | `w-8 h-8 rounded-full`, aktif `bg-[#00E5FF]/20`, tooltip hover `text-[9px]` | `focus-visible:ring-1 ring-white/50`; tooltip juga muncul via `group-focus-within` |
| `ViewSegment` | `dashboard-chrome.tsx:61` | segmented control mono `text-[10px] tracking-[0.18em]`, indikator `motion.span layoutId` | `aria-pressed`, hover warna |
| `MapControls.Btn` | `MapControls.tsx:69` | `w-10 h-10 md:w-8 md:h-8`, ikon 3.5, hover `--hover-accent` | press-and-hold via pointer capture, keyboard `onClick detail===0`, focus-visible outline 1px, disabled |
| Tombol popup peta (HTML string) | `OsirisMap.tsx:891` | inline style cyan `rgba(0,229,255,0.10)`, `font-size:9px` | **tanpa** hover/focus; `onclick` memanggil `window.osirisWatchFlight` |
| `.btn-tactical` (CSS) | `globals.css:842-896` | gold/cyan glass button | **0 pemakaian** di TSX |
| Link aksi | `authLink` (`auth-frame.tsx:16`); link tabel operator `underline decoration-[var(--gold-dim)] min-h-11` (`operator-dashboard.tsx:377`) | | focus-visible tersedia |

Reuse potential: tinggi — `authButton`, `control`, dan tombol primer portal dapat disatukan menjadi satu `Button` dengan varian `primary/secondary/danger/icon/hud`.

## 3. Forms & Validation

| Komponen/pola | Path | Props/kelas | Catatan |
|---|---|---|---|
| `authField` | `ops/auth-frame.tsx:10` | `min-h-12 rounded-md border-[rgba(var(--auth-accent-rgb),0.35)] bg-[rgba(0,0,0,0.35)] text-[15px]`, focus border cyan + ring 3px | Dipakai 4 form auth + `PasswordField`. |
| `PasswordField` | `ops/password-field.tsx` | `name`, `label`, `autoComplete`, `minLength?`(default `PASSWORD_MIN_LENGTH`), `placeholder?` | Toggle tampil/sembunyi `aria-pressed` + `aria-label` ID (`:41-49`), ikon `Lock`. Dipakai login/register/reset. |
| `LoginForm` | `(id)/masuk/login-form.tsx` | – | Ikon `User` di field (`:57`), checkbox `accent-[var(--auth-accent)]`, error `role="alert"`, `aria-busy` pada form memicu reticle cepat (`globals.css:2700`). |
| `RegisterForm` / `ForgotForm` / `ResetForm` | `daftar/register-form.tsx`, `lupa-sandi/forgot-form.tsx`, `atur-sandi/reset-form.tsx` | – | Field **tanpa ikon** (berbeda dari login); sukses `text-white` hardcoded (`register-form.tsx:76`, `reset-form.tsx:63`, `forgot-form.tsx:56`). |
| Pesan error auth | 5 salinan identik: `login-form.tsx:76`, `register-form.tsx:110`, `forgot-form.tsx:51`, `reset-form.tsx:51,76` | `border-l-[3px] border-[var(--auth-signal)] bg-[rgba(255,90,79,0.1)] text-[#ffd9d6]` | Kandidat `<FormAlert>`. |
| Form situasi | `(id)/operator/operator-board.tsx:147-240` | input `min-h-11 border-[var(--control-border)] bg-[var(--bg-primary)]` + focus-visible, `disabled:opacity-60` | Pesan status `role="status"`/`role="alert"` sr-only + versi visual (`:137-140`). Kelas input disalin 6×. |
| Form pengguna | `(id)/pengguna/user-board.tsx:171-206, 262-290` | `rounded border-[var(--control-border)] bg-black/40 px-3 py-2 text-sm text-white` | Tanpa `min-h-11`, tanpa focus-visible (hanya fokus global `.ops-scroll :is(input…):focus` di `globals.css:2609`). Placeholder `"Minimal 12 karakter"` hardcoded (`:183`) padahal ada `PASSWORD_MIN_LENGTH`. |
| Input HUD peta | `SearchBar.tsx:246`, `DirectionsBar.tsx:241` (`PlaceInput`), `ArcGISPanel.tsx:385`, `LiveAlerts.tsx:757,770`, `DrawingToolbar.tsx:307`, `CctvTokenButton.tsx:138` | `text-[10–12px] font-mono outline-none` + `focus:border-…` | 10 input memakai `outline-none` tanpa focus-visible; fokus hanya terlihat dari perubahan warna border (sering ≤50% opasitas). |
| Range slider | `globals.css:2464-2493` | thumb gold 14px, `box-shadow rgba(212,175,55,0.4)` hardcoded | Global untuk semua `input[type=range]`. |

## 4. Tables & Data Display

| Komponen | Path | Catatan |
|---|---|---|
| Tabel situasi | `operator-dashboard.tsx:345-385` | Satu-satunya `<table>` semantik: `<caption class="sr-only">`, `thead text-[var(--text-secondary)]`, baris `border-t border-[var(--border-secondary)] hover:bg-[var(--hover-accent)]`, kolom Lokasi `hidden 2xl:table-cell`. Mobile memakai `<ul>` kartu (`:322`). Paginasi `PAGE_SIZE = 8`. |
| Riwayat revisi | `operator-dashboard.tsx:440+` | Daftar `ops-rise`. |
| Daftar akun | `user-board.tsx:236-330` | `<article>` akordeon (`aria-expanded`), badge status via peta `statusTone`. |
| `IntelFeed` | `IntelFeed.tsx` (`data`, `onLocate`) | `glass-panel`, kelas `.risk-*` (`:19-22`), `gotham-tag` dengan override inline `fontSize:'9px'`. |
| `LiveAlerts` | `LiveAlerts.tsx` (1028; `data`, `onLocate`, `pinsOn?`, `onTogglePins?`, `onPinnedChange?`, `onWatchFeed?`, `onRefresh?`) | Sub-komponen lokal `Chip`, `NewsCard`, `StatementCard`, `QuakeCard`, `WarningCard`. Palet abu-abu netral sendiri (`#111111`, `#26262A`, `#15151A`, `#5C5A54`, `#8A8880`) dan aksen `ACCENT = '#FF4081'` (`:60`) — di luar token. 17 pemakaian teks ≤9 px. |
| `AiOverview` | `AiOverview.tsx` (dipakai `LiveAlerts`) | `LeanBar`, `ThreadRow`, `AlertsBrief`; spinner `animate-spin` ×6. |
| `SatelliteCard` | `SatelliteCard.tsx` (`sat`, `onClose`) | `role="dialog"` (`:93`), `Field{label,value,color}` lokal. |
| `FlightWatchPanel` | `FlightWatchPanel.tsx` (`watched`, `telemetry`, `onRemove`, `onLocate`, `onDetail`) | `glass-panel` + `boxShadow` inline. |
| `ScaleBar` | `ScaleBar.tsx` (`zoom`, `latitude`) | Murni presentasional, ada test. |

## 5. Cards & Statistics

| Pola | Lokasi | Catatan |
|---|---|---|
| Kartu ringkasan operator | `operator-dashboard.tsx:244-250` (grid `grid-cols-2 sm:3 xl:5`) | Token `--bg-secondary`. |
| Statistik board (legacy chrome) | `operator-board.tsx:123-133` | `rounded-xl border-white/10`, label `text-[10px] text-white/55`, nilai `text-2xl text-[var(--gold-primary)]`; tampil hanya bila `showChrome` (default true, tapi `OperatorDashboard` mengirim `false`, `operator-dashboard.tsx:414`). |
| Mobile drawer stats | `monitoring-dashboard.tsx:1309-1314` | `glass-panel-sm` + `hud-label` dengan override `fontSize:'9px'`. |
| Region dossier | `monitoring-dashboard.tsx:1361-1390` | `glass-panel p-5 osiris-glow`, label `.hud-label` (7 px). |
| `.gotham-card`, `.gotham-stat`, `.stat-value-glow` (CSS) | `globals.css:1737-1905, 795-833` | **0 pemakaian**. |

## 6. Dialogs / Modals / Drawers / Popovers

| Komponen | Lokasi | Semantik & interaksi | Masalah |
|---|---|---|---|
| Live feed viewer | `monitoring-dashboard.tsx:1150-1237` | Overlay `fixed inset-0 z-[500] bg-black/70`, klik backdrop menutup | Tanpa `role="dialog"`, `aria-modal`, focus trap, Escape; tombol tutup ikon `X` tanpa `aria-label`; header `bg-[#111]`, badge `bg-red-500/20 text-red-400`, CTA `#39FF14` (neon hijau di luar palet). |
| `CameraViewer` | `CameraViewer.tsx` (`camera`, `onClose`, `onLocate?`, `pinned?`, `onTogglePin?`) | Panel `fixed z-[500]` | Tanpa role dialog; 9 teks ≤9 px. |
| `CctvTokenButton` | `CctvTokenButton.tsx` (`compact?`, `onSaved?`) | `role="dialog" aria-modal="true"` (`:97`), Escape (`:25`) | Satu-satunya modal ber-ARIA lengkap; input `outline-none`. |
| `KeyboardShortcuts` | `KeyboardShortcuts.tsx` | Escape menutup | Tanpa role dialog. |
| `SharePanel` | `SharePanel.tsx` (`mapView`, `activeLayers`, `mouseCoords`) | Popover `glass-panel osiris-glow z-[300]` | – |
| Mobile drawer | `monitoring-dashboard.tsx:1291-1335` | `motion.div` spring, handle `.mobile-drawer-handle` | Kelas `.mobile-drawer`/`.open` di CSS (`globals.css:410-423`) tidak dipakai; animasi via framer. |
| `PortalMenu` | lihat §1 | Menu aria lengkap | – |
| Popup peta MapLibre | `OsirisMap.tsx:847-850` (helper `popup()`), 13 pemanggilan | HTML string via `setHTML` | Lihat §8 dan §12. |

## 7. Feedback & Notifications

- **Tidak ada sistem toast/snackbar** (0 hasil `toast|snackbar`).
- Live region: 16 `role="status"|role="alert"|aria-live` total, hampir semuanya di portal/auth. Peta hampir tidak memiliki live region (kecuali `operator-dashboard.tsx:430` untuk status iframe).
- Loading: spinner ad-hoc `border-2 border-t-transparent rounded-full animate-spin` dengan `style` inline (`camera-feed-view.tsx:186,194`), `animate-spin` ×13, `Loader2`; skeleton `.skeleton-shimmer` dipakai 1× (`ArcGISPanel.tsx:437`).
- Error: `ErrorBoundary` (`ErrorBoundary.tsx`, prop `name`) — kartu `border-red-900/30` (`:32`); error auth (§3); error operator `border-[var(--alert-red)]`; error user-board `border-rose-300/40 text-rose-200` → tiga gaya error berbeda.
- Status "live": `animate-osiris-pulse` dot (7 pemakaian), `.news-live-dot`, `.auth-live`.
- Teks status kamera dalam bahasa Inggris dramatis ("DECRYPTING FEED...", "SECURE FEED ENCRYPTED", `camera-feed-view.tsx:187,209`) sementara portal berbahasa Indonesia.

## 8. Maps & Geospatial Controls

| Komponen | Path | Props utama | Catatan |
|---|---|---|---|
| `OsirisMap` | `OsirisMap.tsx` (2675, `memo`) | 31 props (`OsirisMapProps`, `:57-116`): `data`, `activeLayers`, `onEntityClick`, `flyToLocation`, `projection`, `terrain*`, `theme: 'core'\|'ghost'`, `drawMode`, `drawCommand`, `route`, `userLocation`, `navigating`, `aircraftAirports`, `tileProxy`, dll. | Dimuat `dynamic(..., {ssr:false})` (`monitoring-dashboard.tsx:30`). Membuat layer MapLibre, event, popup HTML, gambar, dan meng-import `MapControls`, `CctvPreviews`, `LiveNewsPreviews`, `SatelliteCard`. Membaca warna dari `--map-*` via `src/lib/map-palette.ts`. 192 atribut `style="..."` dalam string HTML; 46× `#5C5A54`. |
| `MapControls` | `MapControls.tsx` (`mapRef`, `onInteract`) | Pad pan/zoom/rotate | Komponen peta paling aksesibel. |
| `LayerPanel` | `LayerPanel.tsx` (508; `data`, `activeLayers`, `setActiveLayers`, `isMobile?`, `theme?`, `setTheme?`, `terrainStatus?`, `onTerrain*`, `revealed?`) | Rail kiri | `ToggleSwitch` lokal (`:149`) berwarna putih transparan via inline style — berbeda dari `.layer-toggle` (gold) dan `.layer-toggle-premium` di CSS (keduanya 0 pemakaian). Tombol baris `aria-pressed` (`:280,451`). Pemilih tema core/ghost. |
| `SearchBar` | `SearchBar.tsx` (`onLocate`, `alwaysExpanded?`, `center?`) | `glass-panel-sm` / `glass-panel`, dropdown `z-[9999]` | |
| `DirectionsBar` | `DirectionsBar.tsx` (940; `onRoute`, `onLocate?`, `onClose?`, `center?`, `onLiveLocation?`, `onActiveSegment?`, `onFollowChange?`, `onStartNavigation?`) | Satu-satunya pemakai `.instrument-grid/.instrument-corners` (`:518`) | |
| `NavigationView` | `NavigationView.tsx` | Turn-by-turn, `glass-panel !border-[var(--border-active)]` | |
| `DrawingToolbar` / `DrawHud` | `DrawingToolbar.tsx` (494), `DrawHud.tsx` | AOI/polygon | Toolbar `bg-black/90 … glass-panel` ganda (`:163`); HUD border cyan. |
| `ArcGISPanel` | `ArcGISPanel.tsx` (618; `onImportLayer`, `onRemoveLayer`, `onUpdateLayer`, `importedLayers`, `mapBounds?`) | 13 `motion`, 28 hex, 15 teks ≤9 px | Gold dihardcode `#D4AF37` (tidak ikut tema ghost). |
| `ViewPresets` | `ViewPresets.tsx` (`onNavigate`) | `glass-panel p-2.5` | |
| Popup peta (raw HTML) | `OsirisMap.tsx:851-962, 1319, 1366` | `pStyle`/`linkStyle` string (`:851-852`), `font-family:'JetBrains Mono'` inline | Tidak mengikuti token/tema; link eksternal `target="_blank"` tanpa `rel` (`:897-899`); tombol tanpa state focus. |

## 9. CCTV & Media

| Komponen | Path | Props | Catatan |
|---|---|---|---|
| `CctvPreviews` | `CctvPreviews.tsx` (477; `mapRef`, `active`, `onOpen`) | `ImageMedia`, `VideoMedia`, `Tile`, `Connector` lokal | Tile `<button class="cctv-tile … focus:outline-none">` (`:204`); fokus hanya `translateY(-3px)`+brightness (`globals.css:680-686`), tanpa outline. Warna dari `--map-cctv`. |
| `LiveNewsPreviews` | `LiveNewsPreviews.tsx` (364, `memo`) | `Tile`, `Connector` — struktur paralel dengan `CctvPreviews` | Duplikasi pola tile+connector. |
| `CameraFeedView` / `useCameraFeed` | `camera-feed-view.tsx` (`feed`, `contain?`) | Dipakai `CameraViewer`, `multiview.tsx` | Overlay status loading/offline/external; spinner inline-style. |
| `CameraViewer` | §6 | | |
| `SpaceCam` | `SpaceCam.tsx` (`cameras`, `onRemove`, `onLocate`) | Kartu "CCTV TERPILIH" `text-[#00E5FF]` hardcoded (`:24-25`). |
| Multiview | `multiview.tsx` | Grid kamera `bg-[#020202]`, tombol hapus muncul saat hover/focus-visible (`:31`). |
| `CctvTokenButton` | §6 | | |

## 10. Icons / Typography / Visual Assets

- **Ikon**: `lucide-react ^1.14.0` (27 file). Ukuran dominan `w-3 h-3`, `w-3.5 h-3.5`, `h-4 w-4`, `h-5 w-5`; `strokeWidth={1.5}` hanya di `MapControls`. Sebagian ikon dekoratif memakai `aria-hidden` (portal), sebagian besar ikon peta tidak.
- **Logo**: `public/eye-of-horus.svg` (650×500) dipakai sebagai CSS mask (`globals.css:2643-2644` `.auth-logo`; `operator-dashboard.tsx:219` inline style). Header peta **menyalin path SVG yang sama secara inline** (`monitoring-dashboard.tsx:964-968`) dengan `text-[#D4AF37]`.
- **Ikon peta**: `public/icons/cctv.svg` (via `src/lib/camera-icon.ts:4`), 22 lambang PNG `public/kodam/*.png` (via data DB, `src/lib/kotamaops-points.ts:24`), style basemap `public/dark-matter-style.json` (`src/lib/basemap-tone.ts:4`).
- **Favicon/PWA**: `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192/512`; `favicon.svg`, `favicon-32.svg`, `icon-192.png` tidak direferensikan dari `src/` (inferensi: aset yatim). `site.webmanifest` `theme_color: #06060C`, sedangkan `site-metadata.ts:8` `themeColor: "#D4AF37"`.
- **Tipografi**: lihat dokumen 03 (§3).

---

## 11. Komponen/pola duplikat

1. **Tombol**: `authButton`, tombol primer operator-board, tombol primer user-board, `control` operator-dashboard, `.btn-tactical` (tak terpakai), tombol HTML popup, CTA neon `#39FF14` live-feed → ≥6 gaya tombol primer/sekunder.
2. **Field**: `authField`, kelas input operator-board (disalin 6×), input user-board (`bg-black/40`, tanpa min-h), `control` operator-dashboard (`bg-[var(--bg-secondary)]`), input HUD mono 10–12 px (≥7 varian).
3. **Toggle**: `LayerPanel.ToggleSwitch` (inline style putih), `.layer-toggle` (gold, CSS), `.layer-toggle-premium` (CSS) — 2 dari 3 tidak terpakai.
4. **Jam**: `WibClock` (`dashboard-chrome.tsx:27`, format `en-GB`), `WibNow` (`operator-dashboard.tsx:49`, `id-ID`), `ZoneClocks` (`zone-clocks.tsx`), plus `stamp()`/`formatWib` → 3 komponen jam.
5. **Pesan error**: blok auth disalin 5×; error operator dan user-board berbeda warna.
6. **Shell portal**: `OpsShell` (`/pengguna`, header `#07070b`) vs shell internal `OperatorDashboard` (`--bg-primary` + sidebar). Dua header/navigasi berbeda untuk portal yang sama.
7. **Tile pratinjau peta**: `CctvPreviews.Tile/Connector` vs `LiveNewsPreviews.Tile/Connector`.
8. **Logo Eye of Horus**: CSS mask (2 tempat) + path SVG inline (header peta).
9. **Kelas CSS ganda**: `.gotham-command-bar`, `.gotham-stat`, `.gotham-tag`, `.gotham-divider`, `.gotham-enter` masing-masing didefinisikan dua kali (`globals.css:1522/1631`, `1535/1823`, `1559/1982`, `1580/1911`, `1617/2380`); modifier tag memakai dua konvensi (`gotham-tag--critical` di `:1572` vs `gotham-tag-critical` di `:2011`).
10. **Status badge**: `StatusBadge` (operator-dashboard), `statusTone` (user-board), `Chip` (LiveAlerts), `.gotham-tag`, `.threat-badge-*` (0 pemakaian), `.risk-*`.

## 12. Styling tidak konsisten

- **Ops vs peta**: ops memakai `text-sm`/`text-xs`, `min-h-11`, focus-visible gold; peta memakai `text-[9px]`/`text-[10px]` mono uppercase, `w-8 h-8`, `focus:outline-none`.
- **Token vs hardcode di file yang sama**: `ArcGISPanel` menulis `#D4AF37` sekaligus `var(--gold-primary)`; header peta `text-[#D4AF37]` sehingga tidak berubah ke ungu saat `body.theme-ghost` aktif.
- **Palet di luar token**: `LiveAlerts` (abu netral + `#FF4081`), live feed (`#39FF14`, `bg-[#111]`), user-board (`rose-*`, `white/xx`), `OpsShell`/multiview (`#07070b`), `PortalMenu` (`#0b0b12`), popup (`#5C5A54`, `#B0BEC5`, `#78909C`, `#7FE9FF`).
- **Bahasa campur**: peta berbahasa Inggris (`LAYERS`, `Open in YouTube`, `EMBED RESTRICTED`), sebagian label Indonesia (`CCTV TERPILIH`, `aria-label` "Keluarkan … dari multiviewer"); portal Indonesia.
- **Background halaman**: `/operator` `--bg-primary #0E121D`, `/pengguna` `#07070b`, auth radial `--bg-secondary→--bg-void`, peta `--bg-void #0A0D16`, splash `#0a0a14`.

## 13. Bagian yang tightly coupled

- **`OsirisMap.tsx` (2675 baris)**: inisialisasi peta, ±semua layer, event, popup HTML, fetch rute/airframe, draw tool, animasi api Kotamaops dalam satu komponen; popup memanipulasi DOM langsung (`el.innerHTML = …`, `:910-962`).
- **Global window**: popup memanggil `window.osirisWatchFlight` (`OsirisMap.tsx:891`) yang dipasang oleh dashboard (`monitoring-dashboard.tsx:152-157`) via cast `as unknown as {…}` — kontrak tidak bertipe antar file; `window.__osirisMap` hanya dev (`OsirisMap.tsx:796`); `_globeSpinTimer` di `OsirisWindow` (`:44-47`).
- **`monitoring-dashboard.tsx` (1466 baris)**: 54 state, data fetching/polling, tema (`document.body.className = …`, `:231` — menimpa `className="antialiased"` dari `DocumentShell`), splash, seluruh layout HUD.
- **Komponen `components/` mengimpor dari `app/`**: `ops/operator-dashboard.tsx:8` mengimpor `OperatorBoard` dari `@/app/(id)/operator/operator-board` (arah dependensi terbalik).
- **Tema ganda**: kelas `body.theme-ghost` (CSS) + Style Studio (`src/lib/style-tokens.ts`, inline var di `<body>` + `<style id="osiris-style-studio">`) + `theme` prop yang dioper ke `OsirisMap`/`LayerPanel`.
- **Halaman auth bergantung pada `:has()`** (`.auth-root:has(form[aria-busy])`, `.auth-panel:has([role=alert])`, `html:has(.ops-scroll)`) — perilaku scroll/animasi bergantung pada struktur DOM anak.

## 14. Potensi reuse (prioritas, inferensi)

| Kandidat | Sumber yang sudah ada | Alasan |
|---|---|---|
| `Button` (primary/secondary/danger/ghost-icon/hud) | `authButton`, `control`, `ViewSegment`, `MapControls.Btn` | 6+ gaya tersebar |
| `TextField`/`Select` | `authField`, input operator-board | disalin 6–10× |
| `FormAlert` | blok error auth | 5 salinan identik |
| `StatusBadge`/`Tag` | `StatusBadge`, `Chip`, `.gotham-tag` | 6 pola |
| `Dialog` | pola `CctvTokenButton` (role+aria-modal+Escape) | 5 overlay tanpa semantik |
| `Panel` | `.glass-panel` (21 pemakaian) + `.instrument-*` | sudah ada di CSS, belum jadi komponen |
| `Clock` | `ZoneClocks` | 3 implementasi |
| `PopupCard` React (via `setDOMContent`/portal) | popup HTML `OsirisMap` | menghapus `window.osirisWatchFlight` & inline style |

*Belum diperiksa*: isi lengkap setiap sub-komponen `LiveAlerts`/`DirectionsBar`/`ArcGISPanel` baris demi baris; perilaku runtime (tanpa build/menjalankan app).
