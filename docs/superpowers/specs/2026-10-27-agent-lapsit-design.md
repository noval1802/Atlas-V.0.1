# Konsep: Agent Penyusun Lapsit Otomatis

**Tanggal:** 27 Oktober 2026
**Status:** konsep untuk dikerjakan nanti. Belum disetujui untuk dibangun. Satu keputusan besar masih terbuka (bagian 8).
**Asal:** diskusi pemilik proyek dengan Claude, 27 Okt 2026.

Dokumen ini sengaja tidak memuat isi laporan asli. Contoh lapsit yang dipakai saat diskusi berklasifikasi *Rahasia*, jadi yang dicatat di sini hanya strukturnya.

---

## 1. Masalah dan tujuan

Setiap hari operator Pusdalops menerima laporan situasi dari Kodam, satgas, dan satuan lain. Laporan masuk lewat grup WhatsApp, yang dibuka di WhatsApp Web pada komputer kantor. Sebagian berupa teks pesan, sebagian berupa PDF. Operator lalu menyusun semuanya secara manual menjadi satu berkas **Lapsit (Laporan Situasi Operasi TNI dan Kejadian Menonjol)** untuk Panglima TNI.

**Tujuan:** pekerjaan menyalin dan menyusun itu dikerjakan agent. Operator tidak lagi mengetik. Tugasnya memeriksa draf, mengoreksi, menanggapi pertanyaan agent, dan menyetujui.

**Ukuran berhasil:**
- Draf lapsit harian sudah siap saat operator mulai memeriksa, dalam format yang sama dengan lapsit manual.
- Setiap kalimat di draf bisa ditelusuri ke pesan atau PDF sumbernya.
- Satuan yang belum melapor terlihat sebelum batas waktu.

## 2. Bukan tujuan

- Agent **tidak** mengirim lapsit ke pimpinan sendiri. Lapsit keluar hanya setelah disetujui manusia.
- Agent **tidak** menulis apa pun di grup WhatsApp laporan.
- Kesimpulan dan Saran **tidak** diputuskan agent. Agent hanya mengusulkan, lalu manusia memutuskan.

## 3. Hal yang membuat proyek ini gagal walau sistemnya jalan

- Bot membalas atau mengirim pesan di grup laporan Pangdam kepada Panglima.
- Isi laporan *Rahasia* terkirim ke layanan luar tanpa keputusan pimpinan (lihat bagian 8).
- Draf memuat angka atau kejadian karangan AI yang tidak ada di sumber, dan lolos karena tidak bisa ditelusuri.
- Nomor WhatsApp dinas diblokir dan tidak ada jalur cadangan, sehingga laporan hilang.

## 4. Bahan masuk

### 4.1 Laporan WhatsApp dari Kodam

Contoh yang dilihat adalah laporan sore Kodam IX/Udy. Pola umumnya:

- **Pembuka:** "Yth. Bapak Panglima TNI", daftar Cc, salam, nama satuan, hari dan tanggal, jam laporan dalam zona waktu setempat (misalnya 18.00 Wita).
- **Haljol (hal menonjol)** di bagian atas. Isinya sering "Nihil".
- **Bagian bernomor Romawi:** kegiatan Pangdam, link kegiatan (berita daring), per Korem, pengamanan objek vital, Ops DN (satgas, personel, Dpp, embarkasi), Ops LN (jumlah personel per misi), Operasi Pam VVIP, dan Operasi Penanggulangan Bencana Alam.
- **Angka terstruktur:** progres program (titik target, titik dikerjakan, persentase) dan jumlah personel.
- **Penutup:** "Demikian kami laporkan", lalu jabatan pelapor.

Catatan untuk pembacaan:
- "Nihil" adalah informasi, artinya tidak ada kejadian. Jangan dianggap data kosong.
- Susunan bagian kemungkinan berbeda antar-Kodam. Pembaca laporan tidak boleh bergantung pada template yang kaku. Contoh dari Kodam lain belum dilihat.
- Waktu memakai WIB, WITA, atau WIT sesuai satuan.

### 4.2 Laporan lain

Bagian "Dasar" pada lapsit menunjukkan sumber selain Kodam: laporan Danpuspenerbad, Padis Siaga Mabes TNI AL, Kapuskodalau (rencana penerbangan dan operasi unsur), dan surat Kapusinfomar TNI (pantauan maritim). Sebagian datang sebagai PDF. Contoh PDF-nya belum dilihat.

### 4.3 Data yang bisa ditarik langsung dari sumbernya

Lapsit memuat data yang bisa diambil langsung tanpa menunggu laporan. Ini sejalan dengan butir S11 di `docs/audit/AUDIT_MONITORING_SITUASI_NASIONAL.md`.
- Status gunung api dari MAGMA Indonesia (PVMBG).
- Gempa dari InaTEWS BMKG.
- Hotspot karhutla.

## 5. Hasil: struktur lapsit

Struktur diambil dari lapsit asli tanggal 26 Okt 2026 (21 halaman).

**Surat pengantar**
- Kop Mabes TNI, tempat dan tanggal, Nomor `R/ … /<bulan Romawi>/<tahun>/Lapsit`, klasifikasi, lampiran, perihal, dan kepada (Panglima TNI).
- Dasar (a, b, c, …): peraturan dan surat perintah yang hampir tetap, ditambah laporan-laporan harian yang masuk.
- Paragraf pengantar dengan periode **TMT tanggal 09.00 s.d. tanggal berikutnya 09.00**.
- Penanda tangan (Padis Siaga TNI) dan tembusan.
- **Kotak paraf:** Dantim Siaga, Kabiddalops, Pabut Siaga, dan Paban Siaga.

**Lampiran**
1. **Situasi Operasi**
   - a. Data Operasi Dalam Negeri: tabel jumlah personel dan satgas per wilayah (Kogabwilhan I–III, Koarmada RI, Kohanudnas, Pushidrosal, Koopsudnas, Mabes TNI, Kormar).
   - b. Pengerahan Alpalhankam DN per matra (standby dan mobile).
   - c. Data Operasi Luar Negeri: MPP per misi PBB dan non-MPP.
   - d. Pengerahan Alpalhankam LN.
2. **Kejadian Menonjol**
   - a. Dalam Negeri:
     - 1) Operasi TNI, per Kogabwilhan atau Kodam, dengan waktu dalam format DTG (misalnya `251915 WIT`).
     - 2) Bencana Alam: gunung berapi per Kotamaops terdampak, data gempa, dan karhutla.
     - 3) Situasi maritim.
     - 4) Situasi wilayah udara nasional.
     - 5) Lain-lain.
   - b. Luar Negeri: Sops TNI dan PMPP TNI per misi.
3. **Kesimpulan:** ringkasan butir 2, misalnya rekap jumlah gunung per level beserta Kodam-nya.
4. **Saran:** rekomendasi per kejadian.

Bagian 1 hampir tetap dari hari ke hari dan cukup diperbarui saat ada perubahan. Bagian 2 berubah setiap hari. Bagian 3 dan 4 adalah analisis.

## 6. Alur yang diusulkan

1. **Penerimaan.** Nomor WhatsApp dinas khusus ditautkan sebagai perangkat tertaut. Setiap pesan dan PDF dari grup yang terdaftar disimpan ke database ATLAS bersama pengirim, grup, dan jamnya, dalam bentuk aslinya tanpa diubah.
2. **Pembacaan.** Agent memecah setiap laporan menurut bagian (Haljol, kegiatan, Ops DN/LN, bencana, dan seterusnya) dan menandai satuan pengirimnya.
3. **Data otomatis.** MAGMA, BMKG, dan hotspot ditarik terjadwal.
4. **Draf.** Saat periode 09.00–09.00 ditutup, agent menyusun draf lapsit dengan struktur bagian 5.
5. **Pemeriksaan.** Operator melihat draf berdampingan dengan sumbernya. Setiap kalimat terhubung ke pesan atau PDF asal. Operator bisa mengoreksi, menyetujui per bagian, atau mengembalikan ke agent dengan catatan.
6. **Persetujuan.** Mengikuti kotak paraf: Dantim Siaga, Kabiddalops, Pabut/Paban Siaga, lalu Padis Siaga. *Ini dugaan, belum dikonfirmasi.*
7. **Keluaran.** PDF berformat dinas, dan ringkasannya tampil di dasbor monitoring. *Ini dugaan, belum dikonfirmasi.*
8. **Pemantauan kelengkapan.** Satuan yang belum mengirim laporan ditandai sebelum batas waktu, supaya operator bisa menagih. *Ini dugaan, belum dikonfirmasi.*

## 7. Arsitektur dan alat

Keputusan pemilik proyek:
- **Agent dibangun dengan Hermes Agent (Nous Research).**
- **Dipasang di server kantor**, yang terhubung ke internet karena web monitoring ditampilkan di beberapa tempat.

Usulan Claude, belum disetujui:
- **Penangkap pesan dipisah dari Hermes.** Gateway WhatsApp bawaan Hermes dibuat untuk bercakap: begitu grup diizinkan, ia membalas setiap pesan. Dokumentasinya tidak menyebut mode "dengar saja", dan `require_mention` justru membuat pesan lain tidak terbaca. Karena itu, penangkapan dikerjakan layanan kecil terpisah di server ATLAS. Layanan ini memakai Baileys **tanpa kemampuan mengirim** dan hanya menyimpan pesan.
- **Hermes sebagai penyusun.** Hermes membaca laporan tersimpan dari ATLAS, menyusun draf, lalu mengirimkannya ke ATLAS lewat API baru dengan kunci rahasia. Endpoint `/api/sdk/ingest` yang sudah ada khusus untuk entitas peta, jadi tidak cocok dipakai di sini. Notifikasi "draf siap" untuk operator tidak boleh memakai nomor dinas (lihat bagian 7a).
- **ATLAS** menyimpan laporan mentah, draf, revisi, dan persetujuan. ATLAS sudah punya login, peran (`OPERATOR_PUSDALOPS`, `OPERATOR_KODAM`, `ANALYST`, `PIMPINAN`, dan lain-lain), serta riwayat revisi (`SituationRevision`) yang bisa dijadikan pola.

Fakta dari dokumentasi Hermes (dicek 27 Okt 2026):
- WhatsApp lewat bridge Baileys bawaan, dipasangkan dengan `hermes whatsapp`. Tidak perlu akun Meta.
- Grup dibatasi dengan `whatsapp.group_policy: allowlist` dan `group_allow_from`, berisi ID grup `…@g.us`. Defaultnya tidak meneruskan apa pun dari grup.
- Mode yang disarankan adalah nomor bot terpisah (`WHATSAPP_MODE=bot`), karena risiko blokirnya lebih rendah.
- Penanganan PDF di grup tidak dijelaskan. Dokumentasi hanya menyebut file ikut terbawa bila pesannya dikutip.
- Model lokal didukung lewat *Custom Endpoint* (Ollama, vLLM, SGLang, atau API yang kompatibel dengan OpenAI). Konteks minimal 64.000 token.

Risiko WhatsApp:
- Baileys tidak resmi dan melanggar ketentuan WhatsApp, sehingga nomor bisa diblokir.
- Bridge bisa rusak saat WhatsApp memperbarui protokolnya.
- **Cadangan wajib:** operator bisa menempel pesan atau menyeret PDF ke ATLAS secara manual, lalu alur selanjutnya tetap sama.

## 7a. Keputusan pemilik proyek (27 Okt 2026)

**Penyimpanan laporan Rahasia.** Laporan mentah dan draf lapsit **tidak boleh** disimpan bebas di ATLAS seperti data monitoring lain. Laporan disimpan di database yang aksesnya dibatasi, dan hanya orang berwenang yang bisa membacanya.

Tafsiran Claude, perlu dikonfirmasi:
- Data laporan dipisah dari data monitoring umum.
- Hak baca diberikan per orang, bukan otomatis per peran. Layar monitoring publik di beberapa tempat tidak pernah menampilkan isi laporan.
- Setiap pembukaan laporan dicatat.
- Backup laporan diperlakukan dengan klasifikasi yang sama.
- Masih terbuka: apakah database ini cukup berupa skema terpisah di server yang sama dengan hak akses ketat, atau harus server atau database yang terpisah fisik.

**Nomor WhatsApp dinas sudah ada.** Aturannya, nomor ini **tidak boleh berinteraksi di grup**, karena grup berisi Panglima dan pimpinan lain. Akibatnya:
- Penangkap pesan harus benar-benar hanya membaca. Kemampuan mengirim, membalas, memberi reaksi, dan tanda "mengetik" dimatikan di kode, bukan sekadar di konfigurasi. Ini mengunci usulan bagian 7.
- Gateway WhatsApp Hermes tidak boleh ditautkan ke nomor dinas ini. Notifikasi "draf siap" untuk operator memakai jalur lain, yaitu notifikasi di ATLAS atau nomor terpisah.
- **Risiko:** kalau nomor dinas ini ditautkan ke bridge tidak resmi lalu diblokir, operator kehilangan jalur laporan utamanya. Perlu diputuskan apakah boleh memakai nomor dinas yang sama, atau perlu nomor dinas kedua yang ikut menjadi anggota grup.

## 8. Keputusan yang masih terbuka

**Keputusan utama: AI untuk data asli selama GPU belum ada.** Server kantor saat ini belum punya GPU.

| Pilihan | Akibat |
|---|---|
| CPU saja | Model kecil, lambat (bisa berjam-jam per draf), mutu rendah. Tidak disarankan. |
| Model cloud sementara | Mutu baik, bisa langsung dipakai, tetapi isi *Rahasia* keluar kantor. Butuh keputusan pimpinan atau pengamanan informasi, bukan keputusan teknis. |
| Tanpa AI dulu | Semua bagian lain dibangun. Hermes diuji dengan data samaran. Saat GPU tersedia, cukup ganti alamat model di konfigurasi. |

Usulan Claude: pilihan ketiga. Penangkap pesan, penyimpanan, layar pemeriksaan, alur paraf, ekspor PDF, data otomatis, dan tabel Situasi Operasi sudah bermanfaat tanpa AI.

Pertanyaan terbuka lainnya:
- **Bentuk tahap 4 tanpa AI.** Pilihan (a): operator menulis lapsit di ATLAS dengan editor yang menautkan isi ke sumber (besar). Pilihan (b): operator tetap mengetik di Word, ATLAS hanya mengumpulkan laporan, mengatur paraf, dan mengarsipkan (kecil). Tahap 5 harus mengikuti pilihan ini.
- **Paraf digital atau kertas.** Kalau digital, jabatan (Dantim Siaga, Kabiddalops, Pabut/Paban Siaga, Padis Siaga) perlu ditambahkan ke sistem, termasuk aturan piket, pengganti, dan penolakan. Kalau kertas, ATLAS cukup mencatat status.
- **Template resmi dan nomor surat.** Butuh salinan template yang disamarkan. Perlu juga dipastikan siapa yang memberi nomor `R/…/Lapsit`. Kalau dari buku agenda, ATLAS tidak membuat nomor sendiri.
- Nomor WhatsApp dinas yang sama atau nomor kedua untuk penangkap pesan (bagian 7a).
- Bentuk database Rahasia: skema terpisah dengan hak akses ketat, atau server terpisah (bagian 7a).
- Format keluaran: PDF saja, atau juga Word agar bisa disunting?
- Batas waktu lapor per satuan, dan zona waktu yang dipakai untuk batas itu.
- Contoh laporan dari Kodam lain dan contoh PDF dari satuan non-Kodam, disamarkan.
- Spesifikasi GPU yang akan diajukan. Tergantung model yang dipilih dan syarat 64.000 token.
- Berapa lama laporan mentah dan draf disimpan.

Pengaruh keputusan terbuka terhadap tahap di bagian 9 (dari pembacaan reviewer):
- Keputusan AI/GPU hanya menghambat pemakaian nyata tahap 5. Tahap 1–4 tidak terhambat.
- Alur paraf dan format keluaran menghambat tahap 4.
- Batas waktu lapor hanya menghambat pemantauan kelengkapan.
- Contoh laporan menghambat tahap 5. Tahap 1 terkena sebagian, yaitu soal OCR.
- Lama penyimpanan bisa ditentukan belakangan.

### Ketetapan Claude (bisa diubah pemilik proyek)

- **Daftar satuan pelapor disimpan sebagai data, bukan ditulis di kode.** Sumbernya tidak hanya Kotamaops: Puspenerbad, Padis Siaga AL, Puskodalau, dan Pusinfomar juga melapor. Daftar ini dikelola admin, lengkap dengan jumlah laporan per hari, batas waktu, dan zona waktunya.
- **Angka lampiran 1 (Situasi Operasi) disimpan di tabel sendiri**, karena dikelompokkan per Kogabwilhan atau Koarmada, bukan per Kotamaops seperti `Situation`. Angka yang tumpang tindih dengan `Situation` diberi tanda agar tidak berbeda diam-diam.
- **PDF tahap awal hanya PDF berteks.** PDF hasil pindaian atau foto tetap disimpan dan bisa dibuka, tetapi isinya belum bisa dicari sampai ada OCR lokal.
- **Penangkap WhatsApp dipisah dari Hermes** (bagian 7) dan dianggap disetujui untuk keperluan perencanaan, kecuali pemilik proyek menolak.

## 9. Langkah berikutnya bila disetujui

Urutan yang disarankan Claude. Setiap tahap bisa dipakai sebelum tahap berikutnya selesai.
1. **Penyimpanan laporan berakses terbatas (bagian 7a) dan input manual:** operator menempel pesan atau mengunggah PDF ke ATLAS. Ini sekaligus menjadi jalur cadangan.
2. **Penangkap WhatsApp yang hanya membaca**, mengisi penyimpanan yang sama.
3. **Data otomatis** MAGMA, BMKG, dan hotspot (butir S11 audit).
4. **Layar pemeriksaan, alur paraf, dan ekspor PDF** lapsit.
5. **Hermes sebagai penyusun draf.** Diuji dengan data samaran sampai keputusan bagian 8 diambil.

## Rujukan

- [Hermes Agent – WhatsApp](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp)
- [Hermes Agent – Providers](https://hermes-agent.nousresearch.com/docs/integrations/providers)
- [Hermes Agent – Local Ollama setup](https://hermes-agent.nousresearch.com/docs/guides/local-ollama-setup)
- Pola log kejadian dan papan *Significant Events* dari WebEOC, hanya sebagai inspirasi alur. Lihat diskusi referensi dasbor operator.
- `docs/audit/AUDIT_MONITORING_SITUASI_NASIONAL.md`: butir S2 (data tidak keluar) dan S11 (sumber data nasional).
