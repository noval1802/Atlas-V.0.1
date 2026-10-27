# Deploy ATLAS dengan Docker

ATLAS dibangun sebagai Next.js `standalone` di atas `node:22-alpine`. Proses berjalan sebagai user non-root `nextjs` di port 3000.

> **Penting:** jangan memakai image `ghcr.io/simplifaisoul/osiris`. Itu image proyek asal OSIRIS, bukan ATLAS. Selalu bangun dari repo ini.

## Layanan di `docker-compose.yml`

| Layanan | Port host | Fungsi |
|---|---|---|
| `osiris-cache` | **`8443`** (HTTPS), `8080` | nginx: pintu masuk pengguna. 8080 hanya mengalihkan ke 8443. Juga cache tile peta. |
| `osiris` | `127.0.0.1:3000` | Aplikasi ATLAS. Tidak dibuka ke jaringan; akses lewat nginx. |
| `osiris-migrate` | – | Sekali jalan setiap start: migrasi database lalu seed baris yang belum ada. Aplikasi menunggu sampai selesai. |
| `osiris-postgres` | `127.0.0.1:5433` | Database operasi (PostgreSQL 16) |
| `osiris-backup` | – | `pg_dump` harian ke `BACKUP_PATH` (default `./backups`), simpan 14 hari |
| `osiris-intel` | `127.0.0.1:4000` | Layanan entitas internal |

Nama kontainer masih `osiris-*` agar volume dan konfigurasi lama tetap jalan. Semua log Docker dibatasi 5 × 10 MB per layanan.

## Pemasangan pertama

```bash
# 1. Konfigurasi
cp .env.example .env
#    isi: OSIRIS_POSTGRES_PASSWORD, OPS_SESSION_SECRET, OPS_ADMIN_USERNAME,
#    OPS_ADMIN_PASSWORD, OPS_PUBLIC_URL (lihat tabel di bawah)

# 2. Sertifikat HTTPS sementara (self-signed), sampai CA satuan menerbitkan yang resmi
ops/tls/self-signed.sh <nama-host> [alamat-ip]
#    contoh: ops/tls/self-signed.sh atlas.pusdalops.local 10.10.1.20

# 3. Jalankan
docker compose up -d --build
docker compose ps        # osiris dan osiris-cache harus "healthy"
```

Buka `https://<nama-host>:8443`. Selama memakai sertifikat self-signed, browser akan menampilkan peringatan. Pasang sertifikat CA satuan untuk menghilangkannya (lihat di bawah).

Urutan start diatur otomatis: Postgres sehat → `osiris-migrate` selesai → aplikasi sehat → nginx. Kalau `osiris-migrate` gagal (misalnya `OPS_ADMIN_PASSWORD` kurang dari 10 karakter), aplikasi tidak dijalankan. Cek dengan `docker compose logs osiris-migrate`.

## Variabel wajib di `.env`

| Variabel | Keterangan |
|---|---|
| `OSIRIS_POSTGRES_PASSWORD` | Wajib, compose menolak jalan tanpanya. Gunakan nilai aman-URL: `openssl rand -hex 24`. |
| `OPS_SESSION_SECRET` | Minimal 32 karakter (`openssl rand -hex 32`). Kurang dari itu, login ditolak. |
| `OPS_ADMIN_USERNAME`, `OPS_ADMIN_PASSWORD` | Akun SUPER_ADMIN awal, dibuat oleh seed bila belum ada. Gunakan sandi yang kuat. |
| `OPS_PUBLIC_URL` | `https://<nama-host>:8443`. Wajib agar email reset sandi terkirim. |
| `TILE_PROXY_PATH` | `/proxy/tiles`, supaya tile peta dilayani dari cache nginx. |

`DATABASE_URL` di `.env` hanya untuk alat di host (`npm run dev`, Prisma). Di dalam stack, compose memakai `osiris-postgres:5432` secara otomatis.

## Sertifikat resmi

Ganti dua file dengan nama yang sama, lalu muat ulang nginx:

```bash
cp sertifikat-dari-CA.crt nginx/certs/atlas.crt
cp kunci-privat.key       nginx/certs/atlas.key
chmod 600 nginx/certs/atlas.key
docker compose exec osiris-cache nginx -s reload
```

`nginx/certs/` tidak pernah masuk git.

## Backup dan restore

- **Jadwal:** `osiris-backup` membuat satu dump per hari: `backups/atlas-<waktu UTC>.dump` (format `pg_dump -Fc`). Dump yang lebih tua dari `BACKUP_RETENTION_DAYS` dihapus otomatis.
- **Salin ke mesin lain.** Backup di disk yang sama tidak selamat kalau disk itu rusak.
- **Backup manual sekarang:**
  ```bash
  docker compose run --rm -e BACKUP_ONCE=1 osiris-backup
  ```
- **Restore** (menghapus isi database tujuan). Uji dulu ke database percobaan:
  ```bash
  docker compose run --rm --entrypoint sh osiris-backup /ops/restore.sh \
    /backups/atlas-<waktu>.dump \
    "postgresql://osiris:<password>@osiris-postgres:5432/osiris_ops"
  ```

## Perintah harian

```bash
docker compose ps
docker compose logs -f osiris
docker compose up -d --build   # setelah menarik kode baru; migrasi berjalan otomatis
docker compose down
```

## Yang belum dikerjakan

Daftar lengkap ada di `docs/audit/AUDIT_MONITORING_SITUASI_NASIONAL.md`.

- Peta dasar, font, dan terrain masih diambil dari layanan luar (CARTO, Google Fonts, AWS). Itu Tahap 2.
- Belum ada replika database maupun pemantauan (metrics/alert).

Workflow `.github/workflows/docker-publish.yml` hanya berjalan bila dipicu manual dari tab Actions.
