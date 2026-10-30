# 05 — Deep dive AS-IS: Manajemen Pengguna (`/pengguna`)

Tanggal analisis: 2026-10-30. Cakupan: halaman `/pengguna`, API `/api/ops/users`, `/api/ops/users/[id]`, `/api/ops/audit`, pustaka `src/lib/ops/*` terkait, skema Prisma, dan tes yang ada.
Metode: baca kode saja (read-only). Tidak ada login, tidak ada query DB, tidak ada build.

Penanda bukti:
- **tested**: dijaga tes otomatis (file tes disebut).
- **code-only**: terlihat jelas di kode, tidak ada tes yang menjaganya.
- **UNVERIFIED**: perilaku visual/runtime yang perlu dilihat langsung dengan login.

Singkatan path:
- `PAGE` = `src/app/(id)/pengguna/page.tsx`
- `BOARD` = `src/app/(id)/pengguna/user-board.tsx`
- `USERS` = `src/app/api/ops/users/route.ts`
- `USER_ID` = `src/app/api/ops/users/[id]/route.ts`
- `AUDIT_API` = `src/app/api/ops/audit/route.ts`
- `ACCESS` = `src/lib/ops/access.ts`
- `PWD` = `prisma/password-policy.mjs`

---

## 1. Ringkasan & akses

Halaman ini adalah satu layar (tanpa sub-route) untuk: menyetujui/menolak akun hasil registrasi publik, membuat akun, mengubah nama/peran/Kotamaops/status/kata sandi, dan membaca 80 jejak autentikasi terbaru.

Siapa yang bisa masuk:
- Hanya `SUPER_ADMIN` dan `ADMIN` (`canManageUsers`, `ACCESS:23-25`). **tested** (`src/lib/ops/rbac.integration.test.ts:108-124`, `:126-135`).
- Tiga lapis penjaga:
  1. Proxy halaman: tanpa sesi → redirect `/masuk?next=/pengguna` (`src/proxy.ts:29-38`); sesi non-admin → redirect ke `homeForRole` lewat `deniedPage` (`ACCESS:85-90`, `src/proxy.ts:40-45`).
  2. Server component: `currentUser()` null → `redirect("/masuk?next=/pengguna")` (`PAGE:33`); non-admin → `redirect(homeForRole(role))` (`PAGE:34`).
  3. API: proxy menolak non-admin di `/api/ops/users*` dan `/api/ops/audit*` dengan 403 `"Peran ini tidak memiliki izin."` (`src/lib/ops/gate.ts:22-30`, `src/proxy.ts:20-22`); route mengulang cek dengan pesan `"Peran ini tidak mengatur pengguna."` (`USERS:13,24`, `USER_ID:22`) atau `"Peran ini tidak membaca jejak autentikasi."` (`AUDIT_API:11`). Tulis lintas situs ditolak 403 `"Permintaan lintas situs ditolak."` (`src/proxy.ts:14-16`, `gate.ts crossSiteWrite`).
- Peran lain tidak melihat apa pun dari halaman ini: mereka dialihkan ke `/operator` (operator) atau `/peta` (ANALYST/PIMPINAN) (`ACCESS:66-70`).
- Admin mendarat di `/pengguna` setelah login (`homeForRole`, `ACCESS:67`).

Navigasi ke `/pengguna`:
- `portalLinks` menambah `{ href: "/pengguna", label: "Manajemen pengguna" }` hanya untuk admin (`ACCESS:75-82`); ikon `Users` di `src/components/ops/portal-menu.tsx:9`. Menu ini dirender oleh `OpsShell` (`src/components/ops/ops-shell.tsx:24-25`).
- Dasbor operator hanya memberi tautan (`label: "Pengguna"`) bila `canManage` (`src/components/ops/operator-dashboard.tsx:156`). **Halaman pengguna tidak di-embed di dasbor operator**; ia berdiri sendiri di dalam `OpsShell`.

## 2. Struktur layout halaman (urutan render)

Kerangka: `OpsShell` → header (eyebrow "ATLAS OPERASIONAL", `h1` judul, subjudul, `PortalMenu`) lalu `<main className="mx-auto max-w-6xl px-4 py-6">` (`ops-shell.tsx:16-33`). Warna dasar hard-code `bg-[#07070b]` (`ops-shell.tsx:16`).

Urutan konten (`PAGE:59-99`, `BOARD:132-213`):

| # | Elemen | Lokasi | Catatan |
|---|---|---|---|
| 1 | Header shell: "Manajemen pengguna" / "Persetujuan, peran, dan jejak autentikasi." | `PAGE:60` | `h1` di `ops-shell.tsx:21` |
| 2 | Grid `UserBoard` 2 kolom (`lg:grid-cols-[minmax(0,1fr)_340px]`) | `BOARD:133` | 1 kolom di bawah `lg` |
| 2a | Live region tersembunyi `role=status` (info) & `role=alert` (error) | `BOARD:134-135` | `sr-only` |
| 2b | Banner pesan terlihat (error merah / info emas), `key` berubah untuk memicu animasi | `BOARD:137-141` | di atas kolom kiri |
| 2c | Seksi "Menunggu persetujuan (n)" + empty state "Tidak ada akun yang menunggu." | `BOARD:142-150` | kartu selalu terbuka |
| 2d | Seksi "Akun terdaftar (n)" — akordeon kartu | `BOARD:151-168` | satu kartu terbuka sekaligus |
| 2e | `<aside>` form "Pengguna baru", `lg:sticky lg:top-6` | `BOARD:170-210` | di mobile muncul **setelah** semua daftar |
| 3 | Seksi "Jejak autentikasi (n terbaru)" — tabel audit | `PAGE:62-98` | di luar grid, lebar penuh |

Responsif (code-only; tampilan aktual **UNVERIFIED**):
- `< lg` (1024px): satu kolom; urutan DOM = pesan → menunggu → terdaftar → form baru → audit. Form tambah pengguna bisa jauh di bawah jika daftar panjang.
- Form edit dalam kartu: 1 kolom, `sm:grid-cols-2` (`BOARD:262`); bar tombol `sm:col-span-2` (`BOARD:291`).
- Header kartu `flex-wrap` sehingga badge turun baris di layar sempit (`BOARD:237`); meta `break-words` (`BOARD:240`).
- Tabel audit: `min-w-[640px]` dalam kontainer `max-h-[28rem] overflow-auto` → scroll horizontal + vertikal di mobile; `thead` sticky dengan bg hard-code `#0d0d12` (`PAGE:68-70`).
- Animasi `ops-rise` (stagger `--i` maks 10) dan `ops-fade` (`BOARD:236`, `globals.css:2595-2615`), dimatikan pada `prefers-reduced-motion` (`globals.css:2613`).

## 3. Komponen

### 3.1 `UserBoard` (`BOARD:58-213`)
- Props: `actorRole: string`, `initialUsers: UserRow[]`, `kotamaops: {id,code,name}[]` (`BOARD:62-66`).
- State: `users`, `error`, `info`, `openId` (`BOARD:67-70`). **Tidak ada** state `busy`/loading.
- Data awal disiapkan server: user diurutkan `username asc` (`PAGE:36`), Kotamaops `code asc` (`PAGE:37`), audit `createdAt desc take 80` (`PAGE:38-42`). UI **tidak** memanggil `GET /api/ops/users` maupun `GET /api/ops/audit` (grep: hanya `fetch` POST/PATCH di `BOARD:78,111`).

### 3.2 Pemisahan daftar
- `waiting = users.filter(accountStatus === "PENDING")`, `rest = selain PENDING` (`BOARD:129-130`). Urutan mengikuti array (username asc dari server; setelah create di-sort ulang `localeCompare` di `BOARD:94`; setelah save posisi tetap `BOARD:121`).
- Akun yang disetujui/ditolak pindah otomatis dari "Menunggu" ke "Akun terdaftar" karena filter dihitung ulang dari `accountStatus` respons (code-only).
- Pencarian, filter, sortir, paginasi: **tidak ada**.

### 3.3 `UserCard` (`BOARD:215-332`)
- Props: `index` (stagger), `actorRole`, `row`, `kotamaops`, `open`, `onToggle`, `onChange(id, patch)`, `onSave(row, password, decision?, confirmPassword?)` (`BOARD:224-233`).
- Header kartu adalah satu `<button aria-expanded>` (`BOARD:237`) berisi: nama, `@username · email · organisasi · jabatan`, "Dibuat … WIB · masuk terakhir … WIB" (`BOARD:238-249`), badge peran (+ kode Kotamaops) dan badge status (`BOARD:250-256`).
- Buka/tutup: kartu PENDING `open` selalu `true` dan `onToggle={() => {}}` (`BOARD:148`) — tombol header tetap fokusable dengan `aria-expanded=true` tetapi klik tidak berbuat apa-apa. Kartu lain: akordeon via `openId` (`BOARD:162-163`).
- `lockSuperAdmin = row.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN"` (`BOARD:234`): ADMIN yang membuka kartu super admin hanya melihat teks "Hanya super admin yang dapat mengubah akun super admin." (`BOARD:258-260`). `disabled={lockSuperAdmin}` pada select peran (`BOARD:264`) adalah kode mati karena form hanya dirender saat `!lockSuperAdmin`.

### 3.4 Form tambah pengguna (`BOARD:171-209`)
| Field | `name` | Wajib (HTML) | Catatan |
|---|---|---|---|
| Nama | `name` | `required` | `BOARD:175` |
| Nama pengguna | `username` | `required` | placeholder `nama.pengguna` `BOARD:179` |
| Kata sandi | `password` | `required`, `type=password`, `autocomplete=new-password` | placeholder "Minimal 12 karakter", **tanpa** konfirmasi, tanpa `minLength` `BOARD:183` |
| Peran | `role` | default `OPERATOR_KODAM` | opsi = `roleChoices(actorRole)` `BOARD:187-193` |
| Kotamaops | `kotamaopsId` | — | opsi "Tanpa Kotamaops" + `code · name`; **selalu aktif** walau peran bukan OPERATOR_KODAM `BOARD:197-204` |
- Tombol "Buat pengguna" (submit) `BOARD:206-208`.
- `roleChoices` (`BOARD:52-56`): SUPER_ADMIN → semua 6 peran; ADMIN → 5 peran tanpa SUPER_ADMIN (cabang `current === "SUPER_ADMIN"` hanya relevan di kartu edit). **code-only** di klien; server menjaga dengan `superAdminRoleChangeError` (**tested** `src/app/api/ops/users/route.test.ts:198`).
- Jika peran bukan OPERATOR_KODAM, Kotamaops yang dipilih dibuang diam-diam oleh server (`ACCESS:253`; **tested** `src/lib/ops/access.test.ts:83`).
- Akun yang dibuat admin langsung `active: true, accountStatus: "ACTIVE"` (`USERS:42-43`).

### 3.5 Form edit di kartu (`BOARD:262-328`)
| Kontrol | Ikatan | Label | Baris |
|---|---|---|---|
| Nama (text, controlled) | `row.name` via `onChange` | `aria-label="Nama {username}"`, tanpa label terlihat | `BOARD:263` |
| Peran (select) | `row.role` | `aria-label="Peran {username}"` | `BOARD:264-270` |
| Kotamaops (select) | `row.kotamaopsId`, `disabled` bila peran ≠ OPERATOR_KODAM, opsi kosong "Pilih Kotamaops", hanya `code` | `aria-label="Kotamaops {username}"` | `BOARD:271-284` |
| Aktif (checkbox) | `row.active` | label terlihat "Aktif" | `BOARD:285-288` |
| Kata sandi baru | **uncontrolled**, `id="password-${row.id}"` | `aria-label`, placeholder "Kata sandi baru, kosongkan jika tetap" | `BOARD:289` |
| Ulangi kata sandi | **uncontrolled**, `id="password-confirm-${row.id}"` | `aria-label`, placeholder "Ulangi kata sandi baru" | `BOARD:290` |
- Perubahan nama/peran/Kotamaops/aktif hanya mengubah state lokal (`change`, `BOARD:125-127`) sampai sebuah tombol aksi ditekan. Edit yang belum disimpan tetap ada saat kartu ditutup/dibuka (state di `users`) dan **ikut terkirim** oleh tombol Setujui/Tolak/Nonaktifkan/Aktifkan (lihat §4).
- Field kata sandi tampil juga untuk kartu PENDING tetapi tidak pernah dibaca di sana (Setujui/Tolak mengirim `password: ""`, `BOARD:294,297`).

### 3.6 Peta label
- `roleOptions`/`roleLabel` (`BOARD:5-12,28`): SUPER_ADMIN "Admin bootstrap (SUPER_ADMIN)", ADMIN "Admin", OPERATOR_PUSDALOPS "Operator pusat", OPERATOR_KODAM "Operator Kotamaops", ANALYST "Viewer", PIMPINAN "Monitoring".
- `statusLabel` (`BOARD:14-19`): PENDING "Menunggu", ACTIVE "Aktif", REJECTED "Ditolak", DISABLED "Nonaktif".
- `statusTone` (`BOARD:21-26`): amber / emerald / rose / putih-60. Status selalu punya teks, jadi tidak bergantung warna saja.

### 3.7 Tabel jejak autentikasi (`PAGE:62-98`)
- Server-rendered, `take: 80`, `orderBy createdAt desc` (`PAGE:38-42`). Judul menampilkan jumlah baris (`PAGE:64`), empty state "Belum ada catatan." (`PAGE:66`).
- Kolom: Waktu (WIB) — `toLocaleString("id-ID", Asia/Jakarta, medium/short)` (`PAGE:27-29,82`); Aksi — `auditLabel[action] ?? action` (`PAGE:10-25,83`); Hasil — `row.result` mentah (mis. `ok`, tidak diterjemahkan) (`PAGE:84`); Pelaku → target — username atau "—" (`PAGE:85-88`); IP / detail — `[ip, detail].filter(Boolean).join(" · ") || "—"` (`PAGE:89-91`).
- `detail` sudah disensor (`scrypt$…`, `bearer …`, cookie sesi) dan dipotong 300 karakter saat ditulis (`src/lib/ops/audit.ts:3-7`). IP dari `x-real-ip` / hop kanan `x-forwarded-for`, divalidasi pola IP (`audit.ts:9-17`).
- Tabel **tidak diperbarui** setelah aksi di board (data statis dari render server; perlu reload). Tidak ada filter/paginasi/ekspor.
- `GET /api/ops/audit` (`AUDIT_API`) mengembalikan bentuk datar `{audits:[{id,action,result,actor,target,ip,detail,createdAt}]}` dengan `take: 80` yang sama, tetapi halaman tidak memakainya.

## 4. State akun

Enum `AccountStatus { PENDING, ACTIVE, REJECTED, DISABLED }` (`prisma/schema.prisma:33-38`); `User.active Boolean @default(true)`, `accountStatus @default(ACTIVE)`, `sessionVersion Int @default(0)` (`schema.prisma:47,51-52`). Registrasi publik membuat `active:false, accountStatus:"PENDING"`, peran `ANALYST` (`src/app/api/ops/register/route.ts:35-36`, `ACCESS:143-145`).

`nextAccountState(existing, patch)` (`ACCESS:172-187`) — **tested** (`access.test.ts:221-234`):
- `patch.accountStatus` ada → status itu; `active = (status === "ACTIVE")`. Prioritas di atas `active`.
- hanya `patch.active === true` → `ACTIVE`.
- hanya `patch.active === false` → `REJECTED` tetap `REJECTED`, selain itu `DISABLED`.
- tidak ada keduanya → tidak berubah.

Klien mengirim **salah satu**: `accountStatus` (tombol keputusan) atau `active` (tombol Simpan) (`BOARD:109-110`).

Tombol per status (`BOARD:292-326`):

| Status | Tombol yang muncul | Body status | Hasil |
|---|---|---|---|
| PENDING | Setujui, Tolak | `accountStatus: ACTIVE` / `REJECTED` | ACTIVE+active / REJECTED |
| ACTIVE | Simpan pengguna, Nonaktifkan | `active: row.active` / `accountStatus: DISABLED` | Simpan dgn centang dilepas → DISABLED |
| DISABLED | Simpan pengguna, Aktifkan | `active: row.active` / `accountStatus: ACTIVE` | Simpan dgn centang dicentang → ACTIVE |
| REJECTED | Simpan pengguna, Aktifkan | sama | centang dilepas tetap REJECTED |

Jadi ada **dua jalur** untuk menonaktifkan/mengaktifkan: checkbox "Aktif" + Simpan, atau tombol Nonaktifkan/Aktifkan. Keduanya harus tetap konsisten.

`sessionVersion` (`USER_ID:54,64`): naik 1 bila (a) kata sandi baru diset, atau (b) status berpindah dari ACTIVE ke non-ACTIVE. Sesi lama gagal di `sessionMatchesUser` (`ACCESS:147-153`) → pengguna target ter-logout pada request berikutnya. **tested** untuk reset sandi (`route.test.ts:258-263`) dan sesi disabled/mismatch (`rbac.integration.test.ts:181`). Perubahan **peran** tidak menaikkan `sessionVersion` (peran dibaca ulang dari DB per request, `gate.ts sessionAccount`).

## 5. Validasi, error, loading, konfirmasi, aksesibilitas

### 5.1 Validasi klien (code-only)
- Hanya atribut HTML `required` pada nama, username, password di form tambah (`BOARD:175,179,183`). Tidak ada validasi klien untuk form edit, tidak ada `minLength`, `pattern`, atau cek konfirmasi sandi di klien.
- Kotamaops edit `disabled` bila peran ≠ OPERATOR_KODAM (`BOARD:273`); klien mengirim `kotamaopsId: null` untuk peran lain (`BOARD:105`).

### 5.2 Validasi server — pesan persis
POST `/api/ops/users` (`parseNewUser`, `ACCESS:236-254`) dan PATCH (`parseUserPatch`, `ACCESS:265-300`):

| Aturan | Pesan | Sumber | Bukti |
|---|---|---|---|
| Body bukan objek | "Data pengguna tidak lengkap." | `ACCESS:237,266` | code-only |
| Nama 2–120 (trim) | "Nama 2–120 karakter." | `ACCESS:240,271` | code-only |
| Username `^[a-z0-9][a-z0-9._-]{2,31}$` (trim+lowercase, POST saja) | "Nama pengguna 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip." | `ACCESS:21,160-165,241-243` | code-only |
| Sandi < 12 | "Kata sandi minimal 12 karakter." | `PWD:19` | tested `password-policy.test.ts:11` |
| Sandi > 200 | "Kata sandi terlalu panjang." | `PWD:20` | tested `:30` |
| Satu karakter diulang | "Kata sandi tidak boleh berupa satu karakter yang diulang." | `PWD:22` | tested `:26` |
| Memuat username (≥3 char, case-insensitive) | "Kata sandi tidak boleh memuat nama pengguna." | `PWD:24`; PATCH memeriksa terhadap username target di `USER_ID:33-34` | tested `:16`, `route.test.ts:265` |
| Memuat atlas/osiris/pusdalops/admin/operator/password/katasandi/qwerty/123456 | "Kata sandi tidak boleh memuat kata yang mudah ditebak, seperti nama aplikasi atau peran." | `PWD:11,25-26` | tested `:20` |
| Peran tidak di `OPS_ROLES` | "Peran tidak dikenal." | `ACCESS:247,275` | code-only |
| OPERATOR_KODAM tanpa Kotamaops | "Operator Kodam wajib diikat ke satu Kotamaops." | `ACCESS:250-252`, `USER_ID:40-42` | tested `access.test.ts:61` |
| `active` bukan boolean | "Status aktif harus ya atau tidak." | `ACCESS:279` | code-only |
| `accountStatus` tak dikenal | "Status akun tidak dikenal." | `ACCESS:283-285` | code-only |
| Sandi diisi tapi `confirmPassword` beda/kosong (PATCH) | "Konfirmasi kata sandi tidak sama." | `ACCESS:296` | tested `route.test.ts:273` |
| Sandi `""` di PATCH diabaikan | — | `ACCESS:291` | tested `access.test.ts:94` |
| Kotamaops id tidak ada | "Kotamaops tidak ditemukan." | `USERS:31`, `USER_ID:45` | code-only |
| Username sudah dipakai (409) | "Nama pengguna sudah dipakai." | `USERS:34` | code-only |
| Grant/cabut SUPER_ADMIN oleh non-super (403) | "Hanya super admin yang dapat mengubah peran super admin." | `ACCESS:32-42` | tested `access.test.ts:210`, `route.test.ts:186,198,208` |
| ADMIN mengubah apa pun pada akun SUPER_ADMIN (403) | "Hanya super admin yang dapat mengubah akun super admin." | `USER_ID:27-29` | tested `route.test.ts:244` |
| Menurunkan/menonaktifkan super admin aktif terakhir (400) | "Super admin aktif terakhir tidak dapat diturunkan." | `USER_ID:47-53` | tested `route.test.ts:175,285` |
| Target tidak ada (404) | "Pengguna tidak ditemukan." | `USER_ID:25` | code-only |
| Tanpa sesi (401) | "Masuk diperlukan." | `src/proxy.ts:19`, `USERS:12,23` | tested (rbac) |

Catatan: form tambah tidak meminta konfirmasi sandi dan server POST tidak memerlukannya (`ACCESS:236-254`) — berbeda dari PATCH dan registrasi publik (`ACCESS:335-337`).

### 5.3 Penanganan error di klien
- `create`: gagal → `setError(data.error ?? "Pengguna gagal dibuat.")` (`BOARD:91`); sukses → sisip+sort, `form.reset()`, info "`{username}` dibuat." (`BOARD:94-96`).
- `save`: gagal → `setError(data.error ?? "Perubahan gagal disimpan.")` (`BOARD:118`); sukses → ganti baris dengan respons, info "`{username}` disimpan." (`BOARD:121-122`).
- Pesan ditampilkan sekali di banner atas kolom kiri (`BOARD:137-141`) **dan** di live region `role=alert`/`role=status` (`BOARD:134-135`). Setiap aksi mengosongkan kedua pesan dulu (`BOARD:75-76,100-101`).
- Error jaringan (fetch reject) **tidak** ditangkap: `await fetch` tanpa try/catch → promise ditolak, tanpa pesan ke pengguna (`BOARD:78,111`; `void onSave` di tombol). code-only.
- Saat gagal, edit lokal (nama/peran/centang) tidak dikembalikan; kartu menampilkan nilai yang belum tersimpan (code-only).

### 5.4 Loading
Tidak ada flag `busy`, tombol tidak di-`disabled` selama request, tidak ada spinner (`BOARD:67-70`). Klik ganda = request ganda (create kedua akan 409; aksi status kedua idempoten tetapi menulis ulang).

### 5.5 Konfirmasi tindakan
**Tidak ada** dialog konfirmasi untuk Tolak, Nonaktifkan, perubahan peran, maupun ganti sandi (`BOARD:294-326`). Satu-satunya "konfirmasi" adalah field ulangi kata sandi yang diwajibkan server (`ACCESS:295-296`).

### 5.6 Aksesibilitas (code-only; perilaku pembaca layar UNVERIFIED)
- Positif: label membungkus input di form tambah (`BOARD:173-205`); `aria-label` per pengguna di form edit (`BOARD:263-290`); `aria-expanded` pada header kartu (`BOARD:237`); live region status/alert (`BOARD:134-135`); status selalu berteks.
- Kurang: form edit tanpa label terlihat (nama, peran, Kotamaops, sandi hanya placeholder/aria); kartu PENDING punya tombol `aria-expanded` yang tidak berfungsi (`BOARD:148`); tidak ada `aria-controls`; tidak ada pengelolaan fokus setelah simpan/gagal; tidak ada gaya `focus-visible` khusus di halaman ini (dasbor operator memakainya, `operator-dashboard.tsx:174-175`); tombol aksi `py-2 text-xs` < 44px (dasbor memakai `min-h-11`); field sandi edit di luar `<form>`, Enter tidak mengirim.

## 6. Matriks aksi UI → API → peran → hasil

Semua PATCH mengirim `name, role, kotamaopsId, password, confirmPassword` + (`accountStatus` | `active`) (`BOARD:102-110`).

| Aksi UI | Method & path | Field body | Peran aktor | Sukses | Gagal (kode) | Audit ditulis | Efek sesi target |
|---|---|---|---|---|---|---|---|
| Buat pengguna | POST `/api/ops/users` | name, username, password, role, kotamaopsId | SUPER_ADMIN: semua peran; ADMIN: tanpa SUPER_ADMIN (403) | 201 + `UserRow`, ACTIVE | 400 validasi/Kotamaops, 403 super-admin, 409 username | `account_create` detail=peran (`USERS:47-54`) — tested `route.test.ts:217,235` | — |
| Setujui (PENDING) | PATCH `/api/ops/users/{id}` | + `accountStatus:"ACTIVE"` | Admin & super | 200, ACTIVE/active | 400/403/404 | `account_approve` (+`role_change` bila peran diedit) — tested `route.test.ts:217` | — |
| Tolak (PENDING) | PATCH | + `accountStatus:"REJECTED"` | sama | 200, REJECTED | sama | `account_reject` (`USER_ID:13`) | tidak ada (dari PENDING) |
| Simpan pengguna | PATCH | + `active` | sama; ADMIN tidak bisa sentuh akun SUPER_ADMIN | 200 | 400 sandi/konfirmasi/Kotamaops, 403, 400 super admin terakhir | `role_change` bila peran berubah (detail `A -> B`), status-action bila status berubah, `password_change` bila sandi diisi (`USER_ID:69-91`) | +1 `sessionVersion` bila sandi baru atau ACTIVE→non-ACTIVE |
| Nonaktifkan (ACTIVE) | PATCH | + `accountStatus:"DISABLED"` | sama | 200, DISABLED | 400 super admin terakhir (tested `:285`) | `account_disable` | +1 `sessionVersion` → logout |
| Aktifkan (DISABLED/REJECTED) | PATCH | + `accountStatus:"ACTIVE"` | sama | 200, ACTIVE | — | `account_enable` | — |
| Buka/tutup kartu | — (lokal) | — | — | — | — | — | — |
| Lihat jejak | render server (bukan API) | — | admin | 80 baris | — | — | — |

Perlindungan super admin (server, **tested**):
- ADMIN tidak bisa memberi/mencabut SUPER_ADMIN, termasuk promosi diri (`route.test.ts:186`).
- ADMIN tidak bisa mengubah nama, sandi, atau status akun SUPER_ADMIN (`USER_ID:27-29`; `route.test.ts:244`).
- Super admin aktif terakhir tidak bisa diturunkan/dinonaktifkan, juga oleh dirinya sendiri (`USER_ID:47-53`; `route.test.ts:175,285`).
- Tidak ada larangan admin mengubah/menonaktifkan **akunnya sendiri** selain aturan super admin terakhir (code-only): ADMIN bisa menurunkan perannya atau menonaktifkan dirinya.
- ADMIN boleh mengubah ADMIN lain, termasuk reset sandi (code-only; tidak ada aturan khusus).

Urutan cek PATCH (`USER_ID:19-93`): sesi → peran admin → target ada → kunci super admin → parse body → sandi vs username target → aturan peran super admin → status baru → Kotamaops wajib/valid → super admin terakhir → update → audit. Audit gagal tidak menggagalkan respons (`audit.ts:38-40`).

## 7. Ketergantungan backend & kontrak data

`UserRow` (`BOARD:32-46`) = keluaran `presentUser` (`src/lib/ops/current-user.ts:21-37`) dan dibangun manual identik di `PAGE:44-58`:

```
id, name, username, email|null, organization, position, role, active,
accountStatus, kotamaopsId|null, kotamaops {id,code,name}|null,
lastLoginAt ISO|null, createdAt ISO
```

UI bergantung pada:
- `id` (key, URL PATCH, id elemen sandi), `username` (sort, pesan info, aria-label), `name`, `email/organization/position` (meta, boleh string kosong), `role` (badge, select, Kotamaops enable), `active` (checkbox), `accountStatus` (pemisahan daftar, tombol, badge), `kotamaopsId` (select), `kotamaops.code` (badge), `createdAt/lastLoginAt` (stempel WIB).
- `passwordHash` dan `sessionVersion` **tidak** pernah dikirim ke klien.
- Respons error selalu `{ error: string }`; klien hanya membaca `data.error` bila string.
- Duplikasi pemetaan di `PAGE:44-58` vs `presentUser`: bila salah satu berubah, yang lain harus ikut (risiko drift).

## 8. Boleh diubah vs wajib dipertahankan

### Boleh diubah secara visual
- Warna (`#07070b`, `#0d0d12`, `white/xx`, `--gold-primary`) → token Premium Hybrid (navy, cyan, emas).
- Tata letak grid 2 kolom, posisi form tambah (mis. dipindah ke atas di mobile atau jadi panel/drawer), sticky aside.
- Bentuk kartu (kartu ↔ tabel/list), badge, ikon, tipografi, animasi `ops-rise/ops-fade` (tetap hormati reduced-motion).
- Label tampilan peran/status (asal nilai enum yang dikirim tetap sama) dan teks heading.
- Penyajian tabel audit (lebar, sticky header, zebra), format tanggal (tetap WIB).
- Menambah label terlihat, dialog konfirmasi, state loading, fokus — perbaikan, bukan pelanggaran.

### Wajib dipertahankan perilakunya
1. Gerbang akses: hanya SUPER_ADMIN/ADMIN; redirect `PAGE:33-34`; jangan bocorkan data user ke peran lain.
2. Nama field POST: `name, username, password, role, kotamaopsId`; PATCH: `name, role, kotamaopsId, password, confirmPassword, active | accountStatus` (tepat satu dari dua terakhir).
3. `kotamaopsId` dikirim `null` bila peran ≠ OPERATOR_KODAM (`BOARD:105`); select Kotamaops di edit hanya aktif untuk OPERATOR_KODAM.
4. Aturan `roleChoices`: ADMIN tidak pernah ditawari SUPER_ADMIN; ADMIN melihat kartu SUPER_ADMIN dalam keadaan terkunci (pesan `BOARD:259`).
5. Ganti sandi wajib dua kali ketik dan nilai `confirmPassword` dikirim bersama `password`. **Kopling:** handler Simpan membaca input via `document.getElementById("password-${id}")` dan `("password-confirm-${id}")` lalu mengosongkannya (`BOARD:306-310`). Jika id/elemen diganti (mis. dijadikan controlled atau dipindah ke modal), handler harus ikut diubah, kalau tidak sandi diam-diam terkirim kosong (= tidak diganti) tanpa error.
6. Sandi tidak boleh dipertahankan di state/DOM setelah dikirim; `autocomplete="new-password"`.
7. Pemisahan PENDING vs lainnya, dan set tombol per status sesuai tabel §4 (Setujui/Tolak hanya PENDING; Nonaktifkan hanya ACTIVE; Aktifkan untuk DISABLED/REJECTED; Simpan untuk non-PENDING).
8. Dua jalur aktif/nonaktif (checkbox+Simpan vs tombol) dan semantik `nextAccountState` (REJECTED tidak berubah jadi DISABLED saat centang dilepas).
9. Permukaan pesan: `data.error` server ditampilkan apa adanya; fallback "Pengguna gagal dibuat." / "Perubahan gagal disimpan."; info "`x` dibuat." / "`x` disimpan."; live region `role=alert` dan `role=status`.
10. Respons sukses menggantikan baris lokal (jangan pakai state optimistis yang tidak dikoreksi).
11. Tabel audit: 80 terbaru, kolom waktu WIB, aksi berlabel, hasil, pelaku → target, IP · detail; jangan tampilkan detail mentah tanpa sensor server.
12. Tidak ada field `email/organization/position` yang bisa diedit di sini (API PATCH tidak menerimanya).

## 9. Masalah UX yang ditemukan

| ID | Prio | Masalah | Bukti |
|---|---|---|---|
| U1 | **P0** | Tolak, Nonaktifkan, turunkan peran, dan reset sandi dieksekusi satu klik tanpa konfirmasi; Nonaktifkan dan reset sandi langsung me-logout target (`sessionVersion`). Tombol Tolak bersebelahan dengan Setujui. | `BOARD:294-326`, `USER_ID:54` (code-only) |
| U2 | **P0** | Tombol status mengirim juga edit lokal yang belum disimpan (nama/peran/Kotamaops) — mis. ubah peran lalu klik Nonaktifkan = perubahan peran ikut tersimpan tanpa niat "Simpan". | `BOARD:102-110` (code-only) |
| U3 | P1 | Tidak ada state loading/disabled; klik ganda memicu request ganda; error jaringan tidak ditampilkan sama sekali. | `BOARD:67-70,78,111` |
| U4 | P1 | Field sandi dikosongkan segera setelah klik, sebelum respons; bila server menolak (sandi lemah/konfirmasi beda) admin harus mengetik ulang keduanya. | `BOARD:306-310` |
| U5 | P1 | Form tambah default peran OPERATOR_KODAM + Kotamaops "Tanpa Kotamaops" → submit pertama tanpa mengubah apa pun pasti gagal "Operator Kodam wajib…". Kotamaops selalu aktif untuk peran lain dan nilainya dibuang diam-diam. | `BOARD:187,197-199`, `ACCESS:250-253` |
| U6 | P1 | Di mobile, form tambah berada di bawah seluruh daftar, sedangkan banner error/info ada di atas daftar → pesan hasil tidak terlihat dari posisi form. (tampilan UNVERIFIED) | `BOARD:133,137,170` |
| U7 | P2 | Tanpa pencarian/filter/paginasi; semua akun dirender sekaligus. | `BOARD:129-168` |
| U8 | P2 | Tabel audit tidak ter-refresh setelah aksi; kolom Hasil mentah (`ok`) tidak diterjemahkan. | `PAGE:38-42,84` |
| U9 | P2 | Form edit tanpa label terlihat; Kotamaops edit hanya kode (tanpa nama) sedangkan form tambah menampilkan `code · name`. | `BOARD:263-290,280-282,201-203` |
| U10 | P2 | Field sandi tampil di kartu PENDING tetapi diabaikan; checkbox "Aktif" di kartu PENDING juga tidak berpengaruh (tak ada Simpan). | `BOARD:285-290,292-301` |
| U11 | P2 | Gagal simpan tidak me-rollback edit lokal → kartu menampilkan nilai yang tidak ada di DB. | `BOARD:117-120,125-127` |
| U12 | P2 | Target sentuh tombol < 44px, tidak ada `focus-visible` khusus (beda dari dasbor operator). | `BOARD:294-324`; `operator-dashboard.tsx:174-175` |
| U13 | P3 | Tombol header kartu PENDING punya `aria-expanded` tetapi no-op; `disabled={lockSuperAdmin}` kode mati. | `BOARD:148,264` |
| U14 | P3 | Form tambah tidak meminta ulangi sandi (inkonsisten dengan edit & registrasi). | `BOARD:183`, `ACCESS:236-254` |
| U15 | P3 | Pemetaan `UserRow` diduplikasi di `PAGE:44-58` dan `presentUser`. | — |

Bukan bug (catatan desain): admin dapat menonaktifkan/menurunkan diri sendiri (hanya super admin terakhir yang dilindungi) — perlu keputusan produk, bukan sekadar UI.

## 10. Tes regresi wajib saat redesign

Jalankan (tanpa perubahan):
- `src/app/api/ops/users/route.test.ts` — aturan super admin, super admin terakhir, konfirmasi sandi, sandi memuat username, audit tanpa sandi, operator ditolak.
- `src/lib/ops/access.test.ts` — `parseNewUser/parseUserPatch`, `superAdminRoleChangeError`, `nextAccountState`, `portalLinks`.
- `src/lib/ops/password-policy.test.ts` — aturan sandi.
- `src/lib/ops/rbac.integration.test.ts` — gerbang halaman & API per peran, sesi pending/disabled/mismatch.
- `src/lib/ops/gate.test.ts` — `isAdminApi`, `crossSiteWrite`.

Celah (tidak ada tes UI untuk `BOARD`/`PAGE` sama sekali):
1. Komponen `UserBoard`: tombol per status (§4), pemisahan PENDING, `roleChoices` per peran aktor.
2. Simpan dengan sandi: body berisi `password` dan `confirmPassword` yang benar (menjaga kopling `getElementById` atau penggantinya).
3. `kotamaopsId: null` terkirim untuk peran non-Kodam; select Kotamaops disabled.
4. Kartu SUPER_ADMIN terkunci untuk ADMIN.
5. Pesan error server tampil di region `role=alert`; info di `role=status`.
6. Rute: tes PATCH untuk `account_reject`, `account_enable`, `active:false` pada REJECTED, 409 username ganda, Kotamaops tidak ditemukan — saat ini code-only.
7. Bila ditambahkan dialog konfirmasi/loading: tes bahwa request tidak terkirim sebelum konfirmasi dan tombol disabled selama request.
8. Smoke visual (login SUPER_ADMIN dan ADMIN di data uji, viewport 375px & 1280px) — UNVERIFIED sampai dijalankan.
