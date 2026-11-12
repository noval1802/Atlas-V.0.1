# 03 — Design System ATLAS (AS-IS)

> Catatan 12 November 2026: token warna peta untuk kategori satelit (sat comms, military, navigation, earth, science, dll.) sudah dihapus; di `globals.css` tinggal `--map-cctv`. Panel Style Studio (`StyleStudio.tsx`) dihapus 28 Okt 2026; yang tersisa hanya mesin tokennya di `src/lib/style-tokens.ts`.

> Dokumen discovery, read-only, 30 Okt 2026. Sumber utama: `src/app/globals.css` (2746 baris), `src/lib/style-tokens.ts` (446), `src/lib/map-palette.ts` (148), `src/components/ops/auth-frame.tsx`.
> Angka frekuensi = hasil `grep -o` pada `src/components/**/*.tsx` + `src/app/**/*.tsx` (tanpa test). Rasio kontras dihitung dengan rumus WCAG 2.x (luminans relatif).
> Label: **[TOKEN]** = terpusat; **[HARDCODE]** = nilai literal; **[INFERENSI]** = kesimpulan analis.

---

## 1. Arsitektur token

| Lapisan | Lokasi | Isi |
|---|---|---|
| CSS custom properties `:root` | `globals.css:11-92` | warna permukaan, gold, cyan, alert, aksen layer, `--map-*`, border, teks, scrollbar, hover, font, spacing panel |
| Tema `body.theme-ghost` | `globals.css:104-151` | override ungu untuk sebagian besar token di atas |
| Tailwind v4 `@theme inline` | `globals.css:153-158` | hanya 4 pemetaan: `--color-background: var(--bg-void)`, `--color-foreground: var(--text-primary)`, `--font-sans: var(--font-body)`, `--font-mono: var(--font-hud)` |
| Custom variant | `globals.css:4` | `@custom-variant short (@media (max-height: 820px))` |
| Token lokal auth | `globals.css:2624-2633` (`.auth-root`) | `--auth-sea/deep/sand/mist/line/signal/accent/accent-rgb` |
| Mirror JS | `src/lib/style-tokens.ts:78-107` (`DEFAULTS`), `src/lib/map-palette.ts` (`MAP_DEFAULTS`, `readMapPalette`) | Style Studio: menulis var ke `<body>` inline + `<style id="osiris-style-studio">` (`style-tokens.ts:1-16`); 6 preset (`:112-119`) |
| Konstanta kelas TSX | `auth-frame.tsx:10-16` (`authField`, `authButton`, `authLink`); `operator-dashboard.tsx:174` (`control`, lokal) | |

Konsekuensi: warna Tailwind seperti `bg-background`/`text-foreground` tersedia, tetapi tidak ada skala warna semantik (`primary`, `danger`, …) di `@theme`; komponen menulis `bg-[var(--gold-primary)]` atau hex langsung. Penggunaan `var(--…)` di TSX: `--gold-primary` 143, `--text-muted` 138, `--cyan-primary` 64, `--text-secondary` 61, `--text-primary` 46, `--alert-green` 40, `--border-secondary` 36, `--text-heading` 28, `--border-primary` 22, `--alert-red` 20, `--control-border` 19.

## 2. Warna

### 2.1 Permukaan / background [TOKEN] (`globals.css:16-21`)

| Token | Core | Ghost (`:110-115`) |
|---|---|---|
| `--bg-void` | `#0A0D16` | `#05000F` |
| `--bg-primary` | `#0E121D` | `#08001A` |
| `--bg-secondary` | `#151A29` | `#0D0025` |
| `--bg-tertiary` | `#1D2437` | `#140033` |
| `--bg-panel` | `rgba(10,13,22,0.86)` | `rgba(8,0,26,0.92)` |
| `--bg-panel-solid` | `#151A29` | `#0D0025` |

Background [HARDCODE] yang menyimpang: `#07070b` (`ops-shell.tsx:16`, `multiview.tsx:82`), `#0b0b12` (`portal-menu.tsx:66`), `#0a0a14` (splash, `monitoring-dashboard.tsx:634`), `bg-[#111111]` ×6, `bg-[#17171B]` ×5, `#15151A` (`LiveAlerts.tsx:150`), `#020202` (multiview), `bg-black` / `bg-black/40–90` (luas), popup `rgba(21,26,41,0.95)` (`OsirisMap.tsx:851`), `.vignette`/`.mobile-nav` `rgba(4,4,10,…)` (`globals.css:404,439`), manifest `#06060C` (`public/site.webmanifest`).

### 2.2 Aksen

| Peran | Token | Nilai core | Ghost |
|---|---|---|---|
| Primer (aksi, brand) | `--gold-primary` / `--gold-light` / `--gold-dim` / `--gold-glow` | `#D4AF37` / `#F0D060` / `#8B7325` / `rgba(212,175,55,0.3)` | `#B388FF` / `#D1C4E9` / `#6A1B9A` |
| Sekunder (sinyal, data) | `--cyan-primary` / `--cyan-dim` / `--cyan-glow` | `#00E5FF` / `#006B7A` / `rgba(0,229,255,0.15)` | `#7C4DFF` / `#4A148C` |
| Kanal RGB | `--gold-rgb` / `--cyan-rgb` | `212,175,55` / `0,229,255` | `179,136,255` / `124,77,255` |
| Danger | `--alert-red` | `#FF3D3D` | (tidak di-override) |
| Warning | `--alert-orange` | `#FF9500` | – |
| Success | `--alert-green` | `#00E676` | – |
| Info | `--alert-blue` | `#448AFF` | – |
| Layer | `--accent-weather` `#E040FB`, `--accent-nuclear` `#76FF03` | | |
| Auth signal | `--auth-signal` | `#ff5a4f` (`:2630`) | – |

Peta [TOKEN] `--map-*` (`globals.css:47-59`): cctv `#00e676`, sat comms `#00e676`, military `#ff3d3d`, navigation `#448aff`, earth `#90ee90`, science `#ffd700`, other `#00e5ff`, flight civil `#00e5ff`, private `#ffd700`, gov `#ff9500`, military `#ff0000`, unknown `#546e7a`. Ghost meng-override cctv/flight (`:146-150`). Disinkronkan dengan `map-palette.ts` lewat test (komentar `:44-46`).

### 2.3 Border [TOKEN] (`globals.css:62-68`)
`--border-primary rgba(gold,0.2)`, `--border-secondary rgba(gold,0.11)`, `--border-active rgba(gold,0.4)`, `--border-cyan rgba(cyan,0.2)`, `--control-border rgba(255,255,255,0.42)`.
[HARDCODE] umum: `border-white/5,/10,/15,/20` (portal & peta), `#26262A` ×6, `#2A2A28` ×4, `#3A3A38`, `#34343A` (LiveAlerts), `border-rose-300/40–50` (user-board), `border-red-900/30` (ErrorBoundary).

### 2.4 Teks [TOKEN] (`globals.css:71-77`)
`--text-primary #E8E6E0`, `--text-secondary #B0ACA3`, `--text-muted #A3A099`, `--text-heading #F5F0E0`, `--text-gold #D4AF37`, `--text-cyan #00E5FF`. Ghost: `#E1BEE7`, `#9575CD`, `#8A74B0`, `#B388FF`.

### 2.5 Hex terbanyak di TSX [HARDCODE]
Total 566 literal hex di TSX. Top: `#5C5A54` ×64 (OsirisMap 46, LiveAlerts 16), `#D4AF37` ×51, `#00E5FF` ×36, `#E8E6E0` ×33, `#FF9500` ×22, `#8A8880` ×19, `#E65100` ×18, `#FF3D3D` ×16, `#D32F2F` ×16, `#00E676` ×16, `#7E57C2` ×12, `#FF3D57` ×11, `#9B978E` ×9, `#B0BEC5` ×8, `#4285F4` ×8, `#FFD700` ×7, `#39FF14` ×6, `#EC407A` ×6, `#26C6DA` ×6, `#FF4081` ×5. Kelas arbitrer warna-hex Tailwind (`bg-[#…]`, `text-[#…]`, dst.): 213. Artinya nilai token (`#D4AF37`, `#00E5FF`, `#E8E6E0`) sering ditulis ulang sebagai literal sehingga **tidak ikut tema ghost/Style Studio**.

### 2.6 Palet Tailwind bawaan yang dipakai [HARDCODE]
`red-400/500`, `amber-400/500` (live feed, `monitoring-dashboard.tsx:1170-1172`), `rose-200/300` (user-board), `red-300` (hover hapus). Tidak dipetakan ke `--alert-*`.

## 3. Tipografi

### 3.1 Font family dan cara dimuat

| Font | Cara muat | Token | Dipakai |
|---|---|---|---|
| JetBrains Mono 300–700 | `@import url(fonts.googleapis.com…)` baris 1 `globals.css` (runtime, eksternal) + preconnect di `document-shell.tsx:15-16` | `--font-hud` (`:85`), Tailwind `font-mono` | HUD peta; `font-mono` muncul 249× |
| Inter 300–700 | sama | `--font-body` (`:86`), `font-sans`, `body` | default `html, body` (`:168`) |
| Archivo (axis `wdth`) | `next/font/google` self-hosted build-time (`auth-frame.tsx:8`) → `--font-auth` | `.auth-root` (`:2636`) | hanya 4 halaman auth; `font-stretch:125%`, `font-weight:800` (`.auth-wordmark`, `.auth-display`) |
| Inline `font-family:'JetBrains Mono'`/`monospace`/`Inter` | string HTML popup `OsirisMap.tsx` (3/4/1 kemunculan) | – | popup peta |

[INFERENSI] Komentar `auth-frame.tsx:7` menyebut font di-self-host agar jalan di jaringan tertutup, tetapi Inter/JetBrains Mono tetap diambil dari Google pada runtime → di jaringan tertutup HUD peta jatuh ke `'Courier New'`/`-apple-system`. Style Studio menawarkan font UI/mono alternatif (`style-tokens.ts:63-76`).

### 3.2 Ukuran — frekuensi

Arbitrer `text-[Npx]` (total ±365): `10px` 119, `9px` 103, `11px` 70, `12px` 20, `9.5px` 15, `8.5px` 15, `8px` 7, `7px` 4, `15px` 2, `12.5px` 2, `11.5px` 2, dan masing-masing 1× `7.5/10.5/13/14/17/22px`.

Skala Tailwind (total 126): `text-sm` 75, `text-xs` 38, `text-base` 5, `text-2xl` 3, `text-xl` 2, `text-lg` 2, `text-4xl` 1.

Inline (`style`/string HTML): `font-size:9px` 44, `10px` 10, `fontSize:'9px'` 8, `11px` 7, `12px` 6, `9.5px` 3, `8px` 3, `14px` 3, `13px` 2, lain 1×.

Kelas CSS dengan ukuran tetap: `.hud-label` **7px** (`globals.css:294`, 14 pemakaian), `.hud-value` 11px, `.mobile-nav-btn` **6px** → 5px pada ≤390 px dan landscape (`:453,513,523`), `.gotham-tag` 8px (`:1988`), `.instrument-chip` 9px, `.instrument-title` 11px, `.btn-tactical` 11px, `.maplibregl-popup` mobile 10px (`:497`).

Ukuran ≤9px di Tailwind per file: LiveAlerts 17, ArcGISPanel 15, monitoring-dashboard 14, SharePanel 10, AiOverview 10, CameraViewer 9, DirectionsBar 7, camera-feed-view 6.

[INFERENSI] Skala de-facto peta: 9 / 10 / 11 px mono; portal: `text-xs`(12) / `text-sm`(14) / `text-base`/`text-lg`; auth: 10–11 px label, 14–15 px field/tombol, judul `clamp(1.25rem, min(5.4vw,7vh), 2.5rem)` (`auth-frame.tsx:83`). Root font-size naik ke 18/20px di ≥2560/≥3440 px (`globals.css:542-551`), tetapi ukuran `px` arbitrer tidak ikut skala (hanya `rem`).

### 3.3 Weight & tracking
Kelas: `font-bold` 57, `font-semibold` 26, `font-medium` 12, `font-normal` 1; inline `font-weight:700` 15, `bold` 11, `600` 1. Tracking: `tracking-wider` 62, `tracking-widest` 45, arbitrer `[0.2em]` 19, `[0.15em]` 7, `[0.12em]` 7, `[0.18em]` 4, `[0.3em]` 3, `[0.25em]` 3, `[0.4em]`, `[0.5em]`, `[0.22em]`, `[0.1em]` → 10 nilai letter-spacing berbeda. Uppercase mono + tracking lebar adalah identitas HUD.

## 4. Spacing
- [TOKEN] hanya `--panel-gap` (12→8→6px) dan `--edge-pad` (20→12→8→4px) yang responsif (`globals.css:89-90, 477-515`).
- Skala Tailwind standar dominan: `px-3` 83, `gap-2` 79, `py-2` 70, `gap-1` 66, `px-2` 56, `gap-1.5` 56, `py-1` 44, `mt-1` 40, `gap-3` 32, `py-1.5` 29, `px-4` 27. Spacing arbitrer `p-[…]/gap-[…]` hanya 19.
- [INFERENSI] Peta memakai langkah setengah (`1.5`, `2.5`, `0.5`) untuk densitas tinggi; portal memakai `p-4`, `gap-3`, `space-y-6`. Posisi HUD banyak inline (`left: isMobile ? '24px' : '64px'`, `monitoring-dashboard.tsx:962`; `bottom-[75px] md:bottom-[100px]`).

## 5. Border radius
- CSS: `.glass-panel` 14px (12px mobile), `.glass-panel-sm` 10px, `.auth-panel` 10px, `.btn-tactical` 8px, `.mobile-drawer` 16px atas, `.instrument-chip/.sample` 4px, `.gotham-tag` 100px, scrollbar 10px.
- Tailwind: `rounded` 131, `rounded-full` 69, `rounded-md` 32, `rounded-lg` 29, `rounded-xl` 12, `rounded-sm` 8, `rounded-[6px]` 1.
- Inline: `border-radius` 4/5/6/10/12px di popup HTML.
- Style Studio punya knob `radius` (pengali, `style-tokens.ts:101`). Tidak ada token radius CSS.

## 6. Shadow & glow
- [TOKEN-kelas] `.glass-panel` (`0 4px 30px rgba(0,0,0,.5)` + inset gold 6%), `.osiris-glow` (gold 12%/6% + drop), `.osiris-glow-cyan` (0 pemakaian), `.auth-panel` (`0 0 32px -8px` cyan 45% + inset), `.ops-lift:hover`, `authButton` glow gold 60%.
- [HARDCODE] 10 `shadow-[…]` arbitrer berbeda (mis. `0_8px_32px_rgba(0,0,0,0.55)`, `0_10px_40px_rgba(0,0,0,0.6)`, `0_0_8px_rgba(255,215,0,0.5)` di logo header); `shadow-2xl` 5; `boxShadow` inline (`CameraViewer.tsx:51`, `FlightWatchPanel.tsx:187`, `CctvPreviews.tsx:212`).
- Range thumb glow memakai `rgba(212,175,55,…)` literal (`globals.css:2479,2483,2491`) — tidak ikut tema.
- `drop-shadow` di logo memakai `rgba(255,215,0,…)` (`#FFD700`), bukan gold token `#D4AF37`.

## 7. Ikon
`lucide-react ^1.14.0`, 27 file, ±81 ikon unik. Ukuran: `w-3 h-3` → `h-6 w-6`; `strokeWidth` default (2) kecuali `MapControls` (1.5). Ikon kustom: `public/icons/cctv.svg`, lambang `public/kodam/*.png` (22), `public/eye-of-horus.svg` (mask), path SVG inline di header peta. `aria-hidden="true"` konsisten di portal/auth, jarang di peta.

## 8. Varian tombol (ringkas; detail di 02 §2)
| Varian | Definisi | Status |
|---|---|---|
| Auth primary (gold gradient, `#1a1404`) | `authButton` | aktif, 4 form |
| Portal primary (gold solid, teks hitam) | literal di operator-board/user-board | aktif, 2 versi |
| Portal secondary (outline putih/gold) | literal | aktif |
| Danger (rose) | literal user-board | aktif |
| HUD icon round 32px | literal dashboard | aktif |
| Segmented (`ViewSegment`) | komponen | aktif |
| `.btn-tactical`, `.btn-tactical--cyan` | `globals.css:842-896` | **mati** |

## 9. Field / form
- `authField`: tinggi 48px (44 di `short`), border cyan 35%, bg `rgba(0,0,0,.35)`, 15px, fokus border cyan + ring 3px `rgba(cyan,.18)`.
- Portal: `min-h-11` (44px), `border-[var(--control-border)]`, bg `--bg-primary`/`--bg-secondary`/`black/40`, fokus global `.ops-scroll :is(input,select,textarea):focus { border-color: gold; box-shadow: 0 0 0 3px rgba(gold,.15) }` (`globals.css:2609`) + focus-visible outline gold di sebagian.
- HUD: `bg-black/60 border-white/10–20 text-[10–12px] font-mono outline-none focus:border-[cyan|gold]/50`.
- Checkbox: `accent-[var(--auth-accent)] [color-scheme:dark]` (login). Range: global gold.

## 10. Tabel
Hanya satu tabel (`operator-dashboard.tsx:346`): `border-collapse text-sm`, header `font-medium text-[var(--text-secondary)]`, sel `px-2 py-3 align-top`, pemisah `border-t --border-secondary`, hover `--hover-accent`, angka `tabular-nums`. Kelas `.data-grid-cell` (`globals.css:1009-1035`) tidak terpakai.

## 11. Card / panel
| Kelas | Definisi | Pemakaian |
|---|---|---|
| `.glass-panel` | `globals.css:244-259`: `--bg-panel`, `blur(24px) saturate(1.3)`, border `--border-primary`, radius 14 | 21 |
| `.glass-panel-sm` | `:261-267`, blur 16, radius 10 | 2 |
| `.glass-panel-interactive` | `:593-623` | 0 |
| `.instrument-grid/-corners/-title/-rule/-chip/-sample` | `:2511-2593` | DirectionsBar saja (1–3) |
| `.auth-panel` | `:2646-2654` + bracket sudut `::before/::after` | AuthFrame |
| `.gotham-card` | `:1737-1816` | 0 |
| Panel ad-hoc | `bg-black/85–90 backdrop-blur-xl` (CameraViewer, DrawingToolbar, GlobalStatusBar), `rounded-xl border-white/10 bg-white/[0.02–0.03]` (user-board, operator-board) | banyak |

Kelas CSS tak terpakai (0 referensi di TSX, terverifikasi grep): `btn-tactical`, `layer-toggle`, `layer-toggle-premium`, `glass-panel-interactive`, `osiris-glow-cyan`, `pulse-ring`, `scan-line`, `stat-value-glow`, `panel-slide-left/right`, `threat-badge-*`, `data-grid-cell`, `hud-tooltip`, `intel-progress`, `notification-pulse`, `particle-grid`, `splash-ring*`, `gotham-command-bar/card/stat/divider/pulse-ring/grid/sidebar/badge/enter`, `desktop-panel`, `corner-frame`, `map-focus-active`, `docs-root`, `privacy-root` (tidak ada halaman docs/privacy di `src/app`). [INFERENSI] ±40% dari `globals.css` (blok `:553-1436` dan `:1437-2440`) adalah CSS mati.

## 12. Breakpoint
- Tailwind default (640/768/1024/1280/1536) — pemakaian prefix: `md:` 49, `xl:` 12, `sm:` 10, `lg:` 10, `2xl:` 2; custom `short:` 15 (auth).
- Media query CSS: `max-width:1024px`, `768px`, `390px`, `639px` (auth); `max-height:500px and max-width:1024px` (landscape), `max-height:820px` (variant `short` + `:2679`), `max-height:520px` (`:2739`); `min-width:2560px`/`3440px` (ultrawide).
- JS: `useIsMobile()` `w<768 || (h<500 && w<1024)` (`dashboard-chrome.tsx:14`) memilih render mobile/desktop di dashboard — paralel dengan `.desktop-only` / `.mobile-nav` CSS.
- `@supports env(safe-area-inset-*)` untuk notch (`:531-538`).

## 13. Motion
- **framer-motion ^12.38**: 15 file; dashboard 47 pemakaian (splash ring berputar, HUD reveal `hudIn()`, drawer spring `damping 30 stiffness 300`, panel slide `x:20`, modal `scale 0.9`). `MotionConfig reducedMotion="user"` global (`motion-preference.tsx:7`).
- **CSS keyframes**: 48 `@keyframes` di `globals.css` (osiris-pulse, ticker, skeleton, splash-*, gotham-*, ops-rise/fade, auth-draw/fill/rise/unmask/spin/ping/scan/shake, dll.).
- **Transisi universal**: `* { transition: background-color, border-color, color, box-shadow 0.6s cubic-bezier(0.16,1,0.3,1) }` (`globals.css:96-101`) — berlaku untuk seluruh elemen, termasuk hover tombol (hover terasa lambat 600ms kecuali kelas menimpa).
- **prefers-reduced-motion**: 8 blok (`:219, 694, 726, 1376, 2415, 2437, 2613, 2741`) mematikan animasi kelas utama, transisi universal, ops (`animation-duration:1ms !important`), dan auth (scan, sheen, parallax). `AuthPointer` juga cek media query. Celah [INFERENSI]: `animate-spin`/`animate-pulse` Tailwind (13/13 pemakaian) tidak dimatikan; spinner tetap berputar.
- Easing berulang: `cubic-bezier(0.16,1,0.3,1)`, `(0.2,0.8,0.2,1)`, `(0.2,0.7,0.2,1)` — tanpa token durasi/easing.

## 14. Dark mode / tema
- **Tidak ada light mode.** `colorScheme: "dark"` (`site-metadata.ts:12`), tidak ada `prefers-color-scheme`.
- Tema: `core` (navy+gold+cyan) dan `ghost` (ungu) via `document.body.className = 'theme-ghost'` (`monitoring-dashboard.tsx:231`) — hanya di `/peta`, tidak dipersist; Style Studio (`style-tokens.ts`) menyimpan override di `localStorage` (`osiris:style-studio`) dan memuatnya di dashboard (`monitoring-dashboard.tsx:237-238`).
- Masalah: penulisan `body.className` menghapus `antialiased` dari `DocumentShell`; elemen dengan hex literal (header logo, ArcGISPanel, popup, LiveAlerts, range thumb) tidak berganti tema; preset `PHANTOM` (`style-tokens.ts:114`) memakai `textMuted #6a4c93` sedangkan CSS ghost `#8A74B0`.

## 15. Aksesibilitas

### 15.1 Fokus
- Konsisten di portal/auth: `focus-visible:outline-2 outline-offset-2 outline-[var(--gold-primary)|--auth-accent]` (operator-board 7, operator-dashboard 5, portal-menu 2, password-field 1, auth-frame 2).
- Peta: 12× `focus:outline-none`; 10 input/tombol `outline-none` tanpa `focus-visible`; tile CCTV hanya `translateY(-3px)` (`globals.css:680-686`); rail ikon `ring-1 ring-white/50`.
- Target sentuh: portal `min-h-11` (44px) konsisten; HUD `w-8 h-8` (32px) di desktop, `MapControls` 40px mobile.

### 15.2 Kontras (dihitung)
| Pasangan | Rasio | Catatan |
|---|---|---|
| `--text-muted #A3A099` / `--bg-tertiary #1D2437` | 5.92 | OK (sesuai komentar `:73`) |
| `--text-secondary #B0ACA3` / `#151A29` | 7.66 | OK |
| `--gold-primary #D4AF37` / `--bg-void` | 9.23 | OK |
| `--cyan-primary #00E5FF` / `--bg-void` | 12.62 | OK |
| `#1a1404` / gold (authButton) | 8.72 | OK |
| `--alert-red #FF3D3D` / `--bg-void` | 5.53 | OK |
| **`#5C5A54` / popup `#151A29`** | **2.51** | gagal AA (64 pemakaian, label popup & LiveAlerts) |
| **`#5C5A54` / `#0A0D16`** | **2.81** | gagal |
| `#8A8880` / `#151A29` | 4.88 | lulus tipis untuk teks normal; gagal efektif karena ukuran 8.5–9px |
| `#78909C` (link popup) / `#151A29` | 5.17 | OK |
| `text-white/40` di `#07070b` (≈`#6a6a6d`) | 3.73 | gagal untuk teks kecil (`user-board.tsx:246`, multiview) |
| `text-white/50` di `#07070b` | 5.32 | OK |
| placeholder `--text-muted/40` di `black/60` (≈`#41403d`) | 1.90 | gagal (`ArcGISPanel.tsx:385`) |
| `--control-border` 42% putih di void (≈`#717378`) | 4.09 | ≥3:1 non-text, OK |
| Ghost `--text-muted #8A74B0` / `#140033` | 4.83 | OK |
| Preset PHANTOM `#6a4c93`/`#140033` | 2.85 | gagal; TERMINAL `#2e6b52`/`#002d24` 2.39; ARCTIC 2.44; BLACKOUT 2.04; CRIMSON 2.04 |

### 15.3 Ukuran minimum
Teks terkecil: 5–6px (`.mobile-nav-btn`), 7px (`.hud-label`, `text-[7px]` ×4), 7.5px, 8px (`.gotham-tag`, `text-[8px]` ×7), 8.5px ×15. Total ±150 kemunculan teks <10px (Tailwind+inline+kelas).

### 15.4 Lain-lain
Hanya 2 `role="dialog"`; modal live feed/CameraViewer/KeyboardShortcuts tanpa semantik dialog; `aria-label` 69 untuk 138 `<button>`; `lang="en"` di peta padahal sebagian label Indonesia; link popup `target="_blank"` tanpa `rel`.

---

## 16. Konsisten dengan "ATLAS Premium Hybrid" (navy · cyan · gold)

1. Fondasi palet sudah tepat: `--bg-void #0A0D16` → `--bg-tertiary #1D2437` adalah navy gelap bertingkat; gold `#D4AF37` sebagai aksi, cyan `#00E5FF` sebagai sinyal (`globals.css:16-34`).
2. Halaman auth paling matang: semua warna lewat `--auth-*` yang diturunkan dari token inti, “void background, cyan signal, gold action” (komentar `:2623`), focus ring, `short:` variant, reduced-motion lengkap.
3. Portal `/operator` memakai token konsisten (`--bg-primary/secondary`, `--text-*`, `--border-secondary`, `--hover-accent`), target 44px, tabel semantik.
4. Token peta `--map-*` terpusat dan diuji sinkron dengan `map-palette.ts`.
5. `.glass-panel` (21 pemakaian) + `.instrument-*` memberi bahasa panel premium yang konsisten di HUD.
6. Kontras token teks inti didokumentasikan dan lulus AA (5.9–12.6:1).
7. Reduced-motion ditangani di CSS dan framer-motion.

## 17. Perlu ditingkatkan

1. **Hex hardcoded** 566 + 213 kelas `[#…]`: ganti dengan token agar tema/Style Studio berlaku (prioritas: header logo, `ArcGISPanel`, `LiveAlerts`, popup `OsirisMap`).
2. **Palet di luar identitas**: `#FF4081` (LiveAlerts), `#39FF14` (live feed), abu netral `#111111/#26262A/#5C5A54`, `rose-*`, `#07070b`/`#0b0b12` — tidak navy, tidak cyan/gold.
3. **Teks terlalu kecil**: ±150 kemunculan <10px; `.mobile-nav-btn` 5–6px; `.hud-label` 7px.
4. **Kontras gagal**: `#5C5A54` (2.5:1) di 64 tempat; placeholder 1.9:1; 5 preset Style Studio dengan `textMuted` <3:1.
5. **Fokus di peta**: 12 `focus:outline-none`, 10 input tanpa focus-visible, tile CCTV tanpa outline.
6. **Font eksternal** Google Fonts untuk Inter/JetBrains Mono, sementara Archivo self-hosted — tiga keluarga font, dua mekanisme muat.
7. **Tidak ada token tipografi/radius/shadow/motion**; 10 nilai tracking, 17 ukuran px, 10 shadow arbitrer.
8. **CSS mati ±40%** dan definisi `gotham-*` ganda dengan konvensi modifier berbeda.
9. **Transisi universal 600ms** pada `*` membuat hover/warna terasa lambat dan berbiaya performa [INFERENSI].
10. **Tema** hanya di `/peta`, menimpa `body.className`, tidak dipersist; `themeColor` `#D4AF37` vs manifest `#06060C`.
11. **Dua bahasa visual** (HUD mono kecil vs portal sans `text-sm`) tanpa jembatan komponen bersama selain `PortalMenu`.

*Tidak diperiksa*: render aktual di browser (tanpa build/screenshot), nilai komputasi setelah Style Studio diterapkan, kontras di atas basemap peta yang bervariasi.
