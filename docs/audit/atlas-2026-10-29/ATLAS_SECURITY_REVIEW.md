# ATLAS — Security Review (defensif, berbasis kode)

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).

**Tanggal:** 29 Oktober 2026 · **Referensi:** OWASP ASVS / Top 10 · **Metode:** baca kode dan `npm audit --package-lock-only --omit=dev`. Tidak ada eksploitasi, pemindaian, atau request ke layanan luar. Nilai rahasia tidak dicetak; untuk `.env` hanya diperiksa polanya.

## 1. Ringkasan

Fondasi keamanannya **baik**:
- Semua API wajib sesi kecuali 7 route publik yang memang perlu publik.
- Pembatasan akses Kodam berlaku saat baca dan tulis.
- Sesi ditandatangani dan diverifikasi ulang ke DB.
- Hash scrypt.
- Token reset kuat.
- Tidak ada SQL injection maupun open redirect.
- Proxy dilindungi dari SSRF.
- 0 kerentanan pada dependensi runtime.

Celah utamanya:
- Kredensial admin dan DB lemah. — 🟡 Sebagian (S-04)
- Tidak ada MFA. — ⏳ Terbuka
- CSP longgar. — ⏳ Terbuka
- Kebocoran ke pihak ketiga yang tidak cocok untuk jaringan tertutup. — ⏳ Terbuka
- `stealthFetch` memalsukan IP. — ⏳ Terbuka
- Backup tidak terenkripsi. — ⏳ Terbuka

## 2. Yang sudah benar (terverifikasi di kode)

| Area | Bukti |
|---|---|
| Gerbang sesi untuk semua `/api/*`; 7 route publik dicocokkan persis (health, ready, login, logout, register, forgot, reset) | `src/proxy.ts:14-24`, `lib/ops/gate.ts:6-14` |
| API admin ditolak di proxy dan dicek ulang di handler | `gate.ts`, `users/route.ts` |
| Pembatasan Kodam: baca lewat `situationWhere`, tulis lewat `situationWriteLookup`; `kotamaopsId` tidak bisa di-PATCH | `lib/ops/access.ts:91`, `situations/[id]/route.ts:14` |
| Sesi HMAC-SHA256, compare constant-time, secret ≥32 karakter, 8 jam (14 hari bila "ingat saya"), HttpOnly + SameSite=Lax + Secure di produksi; peran dan `sessionVersion` dicek ke DB setiap request | `lib/ops/session.ts:23-85` |
| scrypt + salt 16 byte + dummy hash untuk akun tak dikenal | `lib/ops/password.ts` |
| Token reset 256 bit, disimpan sebagai SHA-256, 30 menit, sekali pakai; origin link dari `OPS_PUBLIC_URL` | `reset-token.ts`, `mail.ts:16-19` |
| Pendaftaran dipaksa ANALYST, PENDING, nonaktif; tidak membocorkan keberadaan akun | `register/route.ts:26-37` |
| SQL: satu-satunya raw query adalah `` $queryRaw`SELECT 1` `` yang ditandai | `health/ready/route.ts:19` |
| Open redirect dicegah dengan allowlist path | `access.ts:124-138` |
| SSRF: `safeFetch` mem-pin IP; proxy CCTV memakai allowlist host dan cek ulang setiap redirect | `cctv/proxy/route.ts:15-146` |
| Tidak ada server WebSocket; tidak ada upload berkas; tidak ada token di localStorage | grep |
| Tidak ada panggilan AI eksternal (⚠️ tidak lagi berlaku penuh: chat AI dari 355a0e0 memanggil API eksternal bila dikonfigurasi) | `ai/overview/route.ts:1-10`; `ai/chat/route.ts` |
| `.env` mode 0600, ada di `.gitignore`, tidak ada di riwayat git | `ls -l`, `git log` |
| Dependensi runtime: 0 kerentanan | `npm audit --omit=dev` |

## 3. Temuan

| ID | Sev | Temuan | Bukti | Perbaikan | Status |
|---|---|---|---|---|---|
| S-04 | **P0** | Kata sandi bootstrap SUPER_ADMIN dan DB lemah/mudah ditebak. Minimum panjang kata sandi hanya 10. | `.env` (pola saja); `access.ts:154` | Ganti keduanya (`openssl rand`), minimum ≥12, cek terhadap daftar kata sandi umum | 🟡 Sebagian (547f807, 17cd4f2) — kebijakan sandi min. 12 + tolak pola umum sudah ada; rotasi kredensial di server belum terverifikasi |
| S-01 | P1 | Tidak ada MFA | `schema.prisma`, `login/route.ts` | TOTP/WebAuthn wajib untuk ADMIN, SUPER_ADMIN, dan operator; batasi masa sesi admin | ⏳ Terbuka |
| S-06 | P1 | `stealthFetch` memalsukan `X-Forwarded-For`/`X-Real-IP` dari kumpulan IP ISP rumahan dan merotasi User-Agent. Dipakai di 27 berkas. Ini melanggar ToS penyedia, berisiko diblokir, dan berdampak reputasi bagi sistem TNI. | `src/lib/stealthFetch.ts:8,59,78-79` | Hapus header palsu, pakai UA jujur, API key, dan cache | ⏳ Terbuka |
| S-03 | P2 | CSP `script-src 'unsafe-inline'` dan `default-src https: wss:` — XSS yang lolos bisa mengirim data ke host mana saja. Popup peta dibangun dari HTML manual. | `next.config.ts:75-76`; `OsirisMap.tsx:849` | Nonce CSP, `connect-src` allowlist | ⏳ Terbuka |
| S-02 | P2 | Rate limit login per username bisa dipakai pihak lain untuk mengunci akun (contoh: "admin") tanpa batas waktu | `login/route.ts:27-31` | Penundaan progresif atau CAPTCHA, bukan blok keras | ✅ Selesai (working tree, belum di-commit) |
| S-05 | P2 | Google Fonts dimuat saat runtime: IP klien terkirim ke Google, dan gagal di jaringan tertutup | `globals.css:1`; `document-shell.tsx:15-16` | Self-host font | ⏳ Terbuka |
| S-07 | P2 | Data operator ke pihak ketiga: teks pencarian (Nominatim/Photon), koordinat klik (Wikipedia), rute (OSRM/Valhalla), entitas (Wikidata, ip-api lewat intel) | `nominatim.ts`, `region-dossier/route.ts:32-56,213-232`, `directions/route.ts:20-22`, `intel/server.js:483-581` | Self-host untuk penggunaan rahasia; daftar data yang boleh keluar | ⏳ Terbuka |
| S-08 | P2 | Backup `pg_dump` tidak terenkripsi, tanpa `umask`, di host yang sama. Isinya hash kata sandi, email, dan IP audit. | `ops/backup/backup.sh:19` | Enkripsi (age/gpg), `umask 077`, salinan di luar host | ⏳ Terbuka |
| S-21 | P2 | Proxy video HLS dan TPT mengikuti redirect tanpa cek ulang; token TPT bisa ikut terkirim ke tujuan redirect | `cctv/hls/route.ts`, `cctv/tpt/media/route.ts:39-40` | `safeFetch` / `redirect: 'manual'` | ✅ Selesai (c0838be, 355a0e0) |
| S-22 | P2 | Tidak ada pembatasan akses per kamera atau per satuan | `src/proxy.ts`; `SECURITY_FINDINGS.md` F-005 | Petakan sumber kamera ke peran/Kotamaops bila kebijakan menuntut | ⏳ Terbuka |
| S-11 | P3 | Proxy gambar CCTV mematikan verifikasi TLS | `cctv/proxy/route.ts:137-139` | Verifikasi TLS secara default | ⏳ Terbuka |
| S-13 | P3 | Proxy tile nginx tanpa sesi; cache 10 GB bisa diisi pihak lain | `nginx.conf` (location tile) | `auth_request` + `limit_req` | ⏳ Terbuka |
| S-14 | P3 | ADMIN bisa mereset kata sandi atau mengubah ADMIN lain | `users/[id]/route.ts:27` | Hanya SUPER_ADMIN yang boleh mengubah ADMIN; autentikasi ulang | ⏳ Terbuka |
| S-15 | P3 | Token reset bisa dipakai dua kali bila dua request balapan | `reset/route.ts:31-45` | `updateMany({id, usedAt:null})` di dalam transaksi | ⏳ Terbuka |
| S-16 | P3 | Biaya scrypt default (N=16384) | `password.ts:12` | N=2^17, simpan parameter di hash, hash ulang saat login | ⏳ Terbuka |
| S-17 | P3 | Penolakan 401/403 dan perubahan token CCTV tidak masuk audit DB | `proxy.ts`; `cctv/tokens/route.ts:37` | Tulis baris `AuthAudit` | 🟡 Sebagian (355a0e0) — perubahan token CCTV sudah diaudit; penolakan 401/403 belum |
| S-10 | P3 | Cek CSRF mempercayai `X-Forwarded-Host` | `gate.ts:44` | Bandingkan dengan `OPS_PUBLIC_URL`; nginx mengosongkan header ini | ⏳ Terbuka |
| S-18 | P3 | Header `X-Powered-By` masih dikirim; nginx tanpa `server_tokens off` dan `limit_req` | `next.config.ts`; `nginx.conf` | `poweredByHeader:false`, hardening nginx | ⏳ Terbuka |
| S-19 | P3 | Nilai severity di popup cuaca tidak di-escape (sumber sudah dinormalisasi; ini lapisan pertahanan tambahan) | `OsirisMap.tsx:1265` | Bungkus dengan `htmlEsc` | ⏳ Terbuka |
| S-20 | P3 | Rate limit di memori per proses (reset saat restart, tidak dibagi antar replika) | `lib/ops/rate-limit.ts:3` | Pindah ke DB/Redis bila scale-out | ⏳ Terbuka |
| S-09 | P3 (hipotesis) | Data at-rest tidak terenkripsi (volume Postgres biasa) | `docker-compose.yml` | Enkripsi disk host (LUKS) | ⏳ Terbuka |

## 4. Status temuan audit sebelumnya

| ID lama | Status sekarang |
|---|---|
| F-001 gerbang sesi tidak ter-commit | ✅ Selesai |
| F-002 rate limit bisa digeser dengan XFF palsu | ✅ Selesai; efek lockout juga sudah ditutup (S-02, working tree) |
| F-003 link reset mengikuti Host | ✅ Selesai |
| F-004 kredensial di working tree | 🟡 Sebagian — dikeluarkan dari working tree; rotasi nilai lemah belum terverifikasi (S-04) |
| F-005 peran viewer membaca semua situasi | 🟡 Sebagian — menunggu keputusan produk |
| F-006 enumerasi pendaftaran | ✅ Selesai |
| Pentest F-01 lockout | ✅ Selesai (S-02, working tree) |
| Pentest F-02 CSRF via X-Forwarded-Host | ⏳ Terbuka (S-10) |
| Pentest F-03/F-04 route osint dan sdk/ingest | ➖ Tidak berlaku (route dihapus, 7e62735) |
| Pentest F-05 dependensi | ✅ Selesai (runtime) |
| Pentest F-06 header versi | ⏳ Terbuka (S-18) |
| Pentest F-07 penolakan tidak diaudit | 🟡 Sebagian (S-17) |
| Pentest F-08 MFA | ⏳ Terbuka (S-01) |
| Pentest F-09 rate limit per proses | ⏳ Terbuka (S-20) |

## 5. Keterbatasan

- XSS tidak disisir baris per baris di setiap popup; hanya disampel.
- Isi container `intel/` belum ditinjau mendalam.
- Advisory untuk dependensi dev tidak diperiksa.
- Konfigurasi TLS tidak bisa diuji karena `nginx/certs/` tidak ada di checkout ini.
