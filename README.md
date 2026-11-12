# ATLAS

**Advanced Tactical Location & Analytics System**: aplikasi Monitoring Situasi Nasional untuk Pusat Pengendalian Operasi (Pusdalops) TNI.

Sistem ini internal dan aksesnya terbatas bagi personel berwenang. Semua halaman operasi dan API memerlukan login.

## Fitur saat ini

| Bagian | Isi |
|---|---|
| **Peta situasi** (`/peta`) | Peta MapLibre berpusat di NKRI. Layer Kotamaops TNI AD/AL/AU, CCTV (Jasa Marga, TPT Jakarta, dan kamera publik), kapal, gempa, titik api, cuaca, dan peringatan langsung. |
| **SPACE / Multiviewer** (`/peta/multiview`) | CCTV pilihan operator ditampilkan dalam grid layar penuh dengan preset tata letak otomatis. |
| **Dasbor operator** (`/operator`) | Status situasi per Kotamaops (KONDUSIF / WASPADA / SIAGA), personel, kejadian, catatan, dan riwayat revisi. |
| **Manajemen pengguna** (`/pengguna`) | Persetujuan akun, peran, dan audit login. Khusus admin. |
| **Akun** | Masuk, daftar (menunggu persetujuan admin), lupa dan atur ulang sandi. |

Peran: `SUPER_ADMIN`, `ADMIN`, `OPERATOR_PUSDALOPS`, `OPERATOR_KODAM`, `ANALYST`, `PIMPINAN`. Rincian akses per endpoint ada di [`docs/akses-endpoint.md`](docs/akses-endpoint.md).

## Menjalankan untuk pengembangan

Butuh Node.js 22 dan PostgreSQL 16.

```bash
npm ci --legacy-peer-deps
cp .env.example .env              # isi DATABASE_URL, OPS_SESSION_SECRET (≥ 32 karakter), OPS_ADMIN_*
npm run db:migrate
npm run db:seed                   # membuat SUPER_ADMIN dan 22 Kotamaops contoh
npm run dev
```

Perintah lain:

| Perintah | Fungsi |
|---|---|
| `npm test` | Unit test (Vitest) |
| `npx tsc --noEmit` | Pemeriksaan tipe |
| `npm run lint` | ESLint |
| `npm run build` | Build produksi (`output: standalone`) |

> **Catatan:** angka personel dan status pada data seed adalah contoh, bukan data riil.

## Deploy

Lihat [`DOCKER.md`](DOCKER.md). Workflow `.github/workflows/docker-publish.yml` hanya berjalan bila dipicu manual.

## Dokumen

| Dokumen | Isi |
|---|---|
| [`docs/audit/AUDIT_MONITORING_SITUASI_NASIONAL.md`](docs/audit/AUDIT_MONITORING_SITUASI_NASIONAL.md) | Audit kesiapan dan rencana pengembangan per tahap |
| [`docs/security/SECURITY_FINDINGS.md`](docs/security/SECURITY_FINDINGS.md) | Temuan keamanan dan statusnya |
| [`docs/akses-endpoint.md`](docs/akses-endpoint.md) | Akses endpoint per peran |

## Asal-usul dan lisensi

ATLAS dikembangkan dari proyek open source [OSIRIS](https://github.com/simplifaisoul/osiris) (lisensi MIT). Modul-modul OSIRIS yang tidak relevan untuk Pusdalops dihapus bertahap; lihat tahap pengembangan di dokumen audit. Pemberitahuan hak cipta asli tetap berlaku sesuai [`LICENSE`](LICENSE).
