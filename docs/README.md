# Dokumentasi ATLAS

Indeks semua dokumen, diurutkan menurut tahap pengembangan. Riwayat lengkap tiap tahap
ada di [CATATAN_PENGEMBANGAN.md](CATATAN_PENGEMBANGAN.md).

**Jenis dokumen**
- **Hidup**: selalu disesuaikan dengan kode terkini.
- **Snapshot**: potret pada tanggalnya. Isinya tidak ditulis ulang; perubahan sesudahnya dicatat di bagian atas dokumen.

**Tanda status** yang dipakai di dokumen temuan dan roadmap:
✅ selesai · 🟡 sebagian · ⏳ terbuka/belum · ➖ tidak berlaku (fiturnya sudah dihapus)

## Dokumen hidup

| Dokumen | Isi |
|---|---|
| [CATATAN_PENGEMBANGAN.md](CATATAN_PENGEMBANGAN.md) | Timeline per tahap dan status semua temuan audit |
| [../README.md](../README.md) | Gambaran aplikasi dan cara menjalankan |
| [../PRODUCT.md](../PRODUCT.md) | Tujuan produk dan pengguna |
| [../DOCKER.md](../DOCKER.md) | Deploy stack compose (HTTPS, migrasi, backup) |
| [akses-endpoint.md](akses-endpoint.md) | Daftar endpoint API dan hak aksesnya |
| [ops/ROTASI_SUPER_ADMIN.md](ops/ROTASI_SUPER_ADMIN.md) | Prosedur rotasi dan pemulihan SUPER_ADMIN |
| [../SECURITY.md](../SECURITY.md) | Kebijakan keamanan |

## Per tahap pengembangan

### Tahap 0 — Basis OSIRIS (Mei–Sep 2026)
Riwayatnya ada di git, dari `b83294c` sampai `d972d9a`.

| Dokumen | Jenis |
|---|---|
| [terrain-local-review.md](terrain-local-review.md) | Review terrain lokal (snapshot) |

### Tahap 1 — ATLAS dan fondasi operasional (17–24 Okt 2026)
| Dokumen | Jenis |
|---|---|
| [security/SECURITY_FINDINGS.md](security/SECURITY_FINDINGS.md) | Temuan keamanan + status |
| [security/SECURITY_BASELINE.md](security/SECURITY_BASELINE.md) | Baseline keamanan + status |
| [security/SECURITY_CHECKLIST.md](security/SECURITY_CHECKLIST.md) | Checklist keamanan + status |
| [security/FEATURE_SECURITY_REVIEW.md](security/FEATURE_SECURITY_REVIEW.md) | Review keamanan per fitur + status |
| [audit/AUDIT_MONITORING_SITUASI_NASIONAL.md](audit/AUDIT_MONITORING_SITUASI_NASIONAL.md) | Audit kesiapan monitoring nasional + status |

### Tahap 2 — Penyempitan cakupan dan deploy internal (27–28 Okt 2026)
| Dokumen | Jenis |
|---|---|
| [superpowers/specs/2026-10-27-agent-lapsit-design.md](superpowers/specs/2026-10-27-agent-lapsit-design.md) | Konsep agen penyusun lapsit (snapshot) |

### Tahap 3 — Audit teknis 29 Okt dan perbaikan P0 (29–30 Okt 2026)
| Dokumen | Jenis |
|---|---|
| [audit/atlas-2026-10-29/ATLAS_AUDIT_REPORT.md](audit/atlas-2026-10-29/ATLAS_AUDIT_REPORT.md) | Laporan audit + status |
| [audit/atlas-2026-10-29/ATLAS_SECURITY_REVIEW.md](audit/atlas-2026-10-29/ATLAS_SECURITY_REVIEW.md) | Review keamanan + status |
| [audit/atlas-2026-10-29/ATLAS_IMPROVEMENT_ROADMAP.md](audit/atlas-2026-10-29/ATLAS_IMPROVEMENT_ROADMAP.md) | Roadmap + status |
| [audit/atlas-2026-10-29/ATLAS_FEATURE_GAP_ANALYSIS.md](audit/atlas-2026-10-29/ATLAS_FEATURE_GAP_ANALYSIS.md) | Gap fitur + status |
| [audit/atlas-2026-10-29/ATLAS_ARCHITECTURE_AS_IS.md](audit/atlas-2026-10-29/ATLAS_ARCHITECTURE_AS_IS.md) | Arsitektur saat itu (snapshot) |
| [audit/atlas-2026-10-29/ATLAS_ARCHITECTURE_TO_BE.md](audit/atlas-2026-10-29/ATLAS_ARCHITECTURE_TO_BE.md) | Arsitektur sasaran |
| [ui-discovery/](ui-discovery/) (00–08) | Discovery UI untuk redesign Premium Hybrid (snapshot) |
| [ui-redesign/pengguna/](ui-redesign/pengguna/) | Tangkapan layar manajemen pengguna V2 |
| [superpowers/specs/2026-10-30-atlas-hermes-lapsit-design.md](superpowers/specs/2026-10-30-atlas-hermes-lapsit-design.md) | Desain lapsit Hermes (snapshot) |

### Tahap 4 — CCTV Indonesia (5–10 Nov 2026)
Dicatat di [CATATAN_PENGEMBANGAN.md](CATATAN_PENGEMBANGAN.md#tahap-4--cctv-indonesia-510-nov-2026).

### Tahap 5 — Audit ulang dan stabilisasi (11–12 Nov 2026)
Temuan audit ulang dan statusnya ada di
[CATATAN_PENGEMBANGAN.md](CATATAN_PENGEMBANGAN.md#status-temuan-audit-ulang-11-nov-2026).

## Aturan menulis dokumen

Repo ini **publik**. Jangan menulis kata sandi, ciri-ciri kata sandi (panjang, kata yang dipakai),
kunci API, hostname atau IP server produksi, maupun langkah eksploitasi. Laporan pentest
(`docs/security/pentest-*.md`) sudah di-gitignore dan tetap disimpan lokal.
