# Runbook: rotasi sandi SUPER_ADMIN (lingkungan lokal)

Berlaku untuk ATLAS lokal di WSL: PostgreSQL 18 pada `127.0.0.1:5433` (klaster `~/.local/share/atlas-pg`), aplikasi `next dev`. Jangan jalankan langkah apa pun di sini sebelum disetujui.

## Fakta yang menentukan prosedur

- Saat ini hanya ada **satu akun**, dan akun itu satu-satunya SUPER_ADMIN.
- SMTP belum dikonfigurasi, jadi "Lupa sandi" tidak bisa dipakai.
- Seed **tidak** merotasi akun yang sudah ada. Mengubah `OPS_ADMIN_PASSWORD` di `.env` tidak berpengaruh pada akun itu.
- Mengganti sandi menaikkan `sessionVersion`, sehingga semua sesi akun itu, **termasuk sesi Anda sendiri**, langsung berakhir.
- Jalan pemulihan: `npm run ops:recover-admin -- --username <nama>`.
  - Butuh akses sah ke basis data (`DATABASE_URL`).
  - Sandi diminta lewat prompt tersembunyi, dua kali. Tidak menerima sandi lewat argumen dan tidak mencetaknya.
  - Hanya untuk akun SUPER_ADMIN yang sudah ada. Tidak membuat akun dan tidak mengubah peran atau status.
  - Mencabut semua sesi lama dan menulis audit `password_recovery_local`.

## 1. Backup basis data sebelum rotasi

Simpan backup di luar folder repo, dengan hak akses hanya untuk Anda. Isinya hash sandi, jadi perlakukan sebagai rahasia.

```bash
umask 077
mkdir -p ~/atlas-backups
STAMP=$(date +%Y%m%d-%H%M)
/usr/lib/postgresql/18/bin/pg_dump -h 127.0.0.1 -p 5433 -U osiris -Fc \
  -f ~/atlas-backups/osiris_ops-$STAMP.dump osiris_ops
# Verifikasi: arsip terbaca dan memuat tabel User
/usr/lib/postgresql/18/bin/pg_restore --list ~/atlas-backups/osiris_ops-$STAMP.dump | grep -c 'TABLE DATA public User '
ls -l ~/atlas-backups/   # harus -rw------- (600)
```

Perintah di atas tidak membutuhkan sandi selama `pg_hba.conf` masih `trust`. Setelah hardening ke `scram-sha-256`, `pg_dump` akan meminta sandi lewat prompt.

## 2. Salinan sandi lama yang perlu ditangani setelah rotasi

Daftar ini disusun dari path dan metadata saja; isi berkas tidak dibuka.

| Lokasi | Keterangan | Tindakan setelah rotasi |
|---|---|---|
| `.env` → `OPS_ADMIN_PASSWORD` | Terisi | Kosongkan. Seed tidak lagi membutuhkannya selama SUPER_ADMIN aktif ada. |
| `.next/standalone/.env` | Salinan identik `.env` (checksum sama), dibuat oleh `npm run build` | Hapus folder `.next/standalone`, atau build ulang setelah `.env` dibersihkan |
| `docs/security/pentest-atlas-local-2026-10-24.md` | Mode 644, untracked, menurut catatan sebelumnya memuat sandi admin | Sensor atau pindahkan keluar repo (butuh persetujuan) |
| `~/.bash_history` | Ada (mode 600). Isinya tidak diperiksa | Periksa sendiri bila sandi pernah diketik di perintah |
| Backup `~/atlas-backups/*.dump` | Memuat **hash** sandi, bukan sandi | Simpan mode 600; hapus sesuai kebijakan retensi |

Setelah rotasi, sandi lama di lokasi-lokasi ini tidak lagi bisa dipakai untuk masuk, tetapi tetap sebaiknya dibersihkan.

## 3. Checklist rotasi

Persiapan:
- [ ] Backup langkah 1 selesai dan `pg_restore --list` menemukan tabel `User`.
- [ ] Sandi baru dibuat di password manager: minimal 12 karakter, tidak memuat nama pengguna, nama aplikasi, atau nama peran.
- [ ] Uji coba jalur pemulihan **tanpa mengubah apa pun**: `npm run ops:recover-admin` tanpa argumen harus menolak dan menampilkan cara pakai.
- [ ] Terminal WSL di folder repo sudah terbuka sebagai cadangan.

Rotasi, lewat aplikasi:
1. Masuk sebagai SUPER_ADMIN, buka **Pengguna**, lalu buka akun Anda sendiri.
2. Isi **Kata sandi baru** dan **Ulangi kata sandi baru**, lalu pilih **Simpan pengguna**.
3. Sesi Anda akan berakhir. Masuk ulang dengan sandi baru.

Bila langkah 3 gagal, pulihkan dari terminal:
```bash
cd ~/Atlas-V.0.1
npm run ops:recover-admin -- --username <nama-admin>
# ketik sandi baru dua kali; tidak ada yang tampil di layar
```
Jangan pernah memakai `echo ... | npm run ops:recover-admin`, karena sandi akan tertinggal di riwayat shell.

## 4. Verifikasi setelah rotasi

- [ ] Masuk dengan sandi baru berhasil.
- [ ] Masuk dengan sandi lama ditolak.
- [ ] Sesi di browser atau tab lain sudah keluar (ter-redirect ke `/masuk`).
- [ ] `OPS_ADMIN_PASSWORD` di `.env` dikosongkan, lalu seed tetap berjalan: `npx prisma db seed` mencetak "Admin sudah ada, tidak diubah."
- [ ] `.next/standalone` dihapus atau dibuat ulang setelah `.env` dibersihkan.
- [ ] Audit tercatat: lewat aplikasi, aksi `password_change`; lewat pemulihan, `password_recovery_local`.

## 5. Rollback

- **Lupa atau salah ketik sandi baru:** jalankan `npm run ops:recover-admin -- --username <nama-admin>` dan setel sandi lain.
- **Akun rusak atau basis data bermasalah:** pulihkan dari backup langkah 1. Ini menimpa seluruh `osiris_ops` ke kondisi saat backup, termasuk situasi yang dilaporkan sesudahnya. Hentikan aplikasi dulu.
  ```bash
  /usr/lib/postgresql/18/bin/pg_restore -h 127.0.0.1 -p 5433 -U osiris -d osiris_ops --clean --if-exists ~/atlas-backups/osiris_ops-<STAMP>.dump
  ```
- Sandi lama **tidak** bisa dikembalikan, kecuali lewat restore backup.
