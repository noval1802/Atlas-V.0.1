# Feature Security Review

**Status diperbarui:** 12 November 2026 (dicek terhadap kode terkini).

Salin template ini ke catatan perubahan saat sebuah fitur, perbaikan, refactor, API, database, atau deployment disentuh. Ini catatan tinjauan manual, bukan sertifikasi.

Perbarui `SECURITY_CHECKLIST.md` dan `SECURITY_FINDINGS.md` hanya untuk item yang bukti barunya diperiksa. Jangan menandai `PASS` karena build hijau. Jangan commit, push, migrasi, atau deploy dari template ini.

## Identitas

- Fitur:
- Tujuan:
- Tanggal:
- Pembuat tinjauan:
- Commit atau working tree yang ditinjau:

## Sebelum implementasi

- File, endpoint, komponen, tabel, dan integrasi yang berubah:
- Kategori checklist yang terdampak:
- Trust boundary:
- Peran yang berhak dan yang tidak berhak:
- Input tidak tepercaya:
- Data sensitif:
- Perubahan schema, konfigurasi, dependensi, atau izin:
- Risiko sebelum perubahan:
- Tes keamanan yang dibutuhkan:
- Apakah desain masih belum jelas atau berisiko kritis? Jika ya, berhenti dan minta keputusan.

## Saat implementasi

- Kontrol yang diterapkan:
- Kontrol lama yang tetap hidup:
- Tes positif, negatif, dan otorisasi yang ditambah:
- Scope yang tidak berubah:

## Sesudah implementasi

- Perintah tes yang dijalankan, dengan hasil:
- Tes yang tidak dijalankan:
- Verifikasi peran berhak dan tidak berhak:
- Diff diperiksa terhadap rahasia dan perubahan tak terkait:
- Item checklist yang diubah, dengan status baru:
- Risiko residual:

## Laporan singkat

**Ringkasan**

- Fitur dan tujuan:
- File yang diubah:
- Kategori yang terdampak:

**Review keamanan**

- Risiko sebelum perubahan:
- Kontrol yang diterapkan:
- Tes dan bukti:
- Status checklist:
- Risiko residual:

**Kontrol perubahan**

- Perubahan tak terkait tetap ada:
- Tidak ada rahasia baru:
- Pekerjaan yang masih menunggu persetujuan:
