# Desain: Asisten ATLAS via Hermes + Pembaruan Lapsit Karhutla dari PDF

Tanggal: 30 Oktober 2026
Status: draf, menunggu persetujuan

## 1. Maksud dan alasan

Saat ini data karhutla di ATLAS diketik tangan ke dalam kode
(`src/lib/karhutla-lapsit.ts`, dari lapsit 5 Okt 2026 22.00). Lapsit baru
terbit rutin (contoh: "LAPSIT KARHUTLA 28 Oktober 2026", PDF 40 halaman),
tetapi dasbor dan peta tetap menampilkan angka lama sampai ada yang mengubah
kode dan men-deploy ulang.

Tujuannya: operator mengunggah PDF lapsit ke asisten ATLAS (tombol logo
yang bisa digeser di dasbor operator), agent membaca PDF, ATLAS menampilkan
tabel hasil bacaan, operator memeriksa dan mengoreksi, lalu setelah operator
menyetujui, data tersimpan dan dasbor serta peta langsung memakai lapsit
terbaru.

Agent dijalankan oleh **Hermes Agent** (Nous Research) yang berjalan sebagai
layanan terpisah. Hermes yang memilih dan memanggil model (ChatGPT, DeepSeek,
Claude, dll. lewat API), dan setiap model diberi tugasnya masing-masing.
Pengguna memilih Hermes karena ke depan akan ada pekerjaan berkelanjutan
24/7 (lihat Bagian 9), dan Hermes punya Jobs API untuk itu.

## 2. Ruang lingkup dokumen ini

Dokumen ini mencakup **proyek 1 dan 2**:

1. Lapsit PDF ke tabel, lalu persetujuan operator, lalu simpan (titik api per
   Kodam, Alpalhankam, OMC).
2. Integrasi ATLAS dengan Hermes: chat asisten dan pembagian tugas per model.

**Proyek 3** (pemantau berita 24/7 isu TNI dan bencana) **bukan** bagian
dokumen ini. Proyek itu akan dirancang tersendiri setelah proyek 1–2 jalan.

## 3. Sasaran

- Operator berperan pusat bisa mengunggah PDF lapsit karhutla dari panel
  asisten di dasbor operator.
- Hasil bacaan tampil sebagai tabel yang bisa dikoreksi sebelum disimpan.
  Tidak ada angka yang masuk ke data ATLAS tanpa klik Setuju.
- Data yang disimpan per lapsit:
  - Waktu lapsit (tanggal dan jam yang tertulis di dokumen).
  - Per Kodam: firespot awal (titik, Ha), padam (titik, Ha), proses pemadaman
    (titik, Ha), personel siaga, total Alpalhankam, dan rincian Alpalhankam
    (jenis alat + jumlah, mis. "Unit Damkar 23", "Heli TNI (Water Bombing) 1").
  - OMC: periode, wilayah, pesawat (jenis + jumlah), sortie, bahan semai
    (dry ice, NaCl, dalam ton), dan catatan hasil OMC bila ada.
- Setelah disetujui, dasbor operator, peta (popup KARHUTLA dan ikon api
  Kotamaops), dan semua pemakai `karhutla-lapsit` memakai lapsit terbaru
  yang disetujui.
- Lapsit lama tetap tersimpan sebagai riwayat, beserta siapa yang
  menyetujui dan kapan.
- Chat tanya-jawab biasa di panel asisten juga lewat Hermes.
- ATLAS tetap berjalan normal saat Hermes mati. Panel asisten menampilkan
  "Asisten sedang tidak tersedia".

## 4. Bukan sasaran

- Pemantau berita 24/7 (proyek 3).
- Membaca jenis dokumen lain selain lapsit karhutla (ringkasan berkas umum
  dan seterusnya menyusul).
- Menampilkan rincian Alpalhankam atau OMC di peta. Untuk tahap ini cukup
  disimpan dan terlihat di tabel persetujuan dan riwayat. Tampilan di
  dasbor menyusul.
- Mengatur pilihan model dari UI ATLAS. Model per tugas diatur di konfigurasi
  Hermes.

## 5. Anti-sasaran (gagal meskipun "jalan")

- Agent menyimpan data sendiri tanpa persetujuan operator.
- Browser operator berbicara langsung ke Hermes, sehingga melewati login dan
  peran ATLAS.
- Profil Hermes yang dipakai dari chat operator punya akses terminal atau
  file server. Isi chat atau isi PDF tidak boleh bisa "menyuruh" agent
  menjalankan perintah di server.
- Baris Kodam yang tidak dikenali ATLAS ikut tersimpan diam-diam atau hilang
  diam-diam.
- Hermes mati lalu dasbor operator ikut rusak.

## 6. Batasan

- **Satu server, dua folder terpisah** (keputusan pengguna). ATLAS tetap di
  `/home/wizard/Atlas-V.0.1`. Hermes dipasang di `/home/wizard/hermes`,
  dengan konfigurasi di `/home/wizard/.hermes/` (`chmod 700`, karena berisi
  API key). Tidak boleh ada berkas Hermes di dalam repo ATLAS. Keduanya proses
  terpisah yang di-restart sendiri-sendiri.
- **Penghubung hanya HTTP.** Hermes API Server (`API_SERVER_ENABLED=true`,
  `hermes gateway`) mendengarkan di `127.0.0.1:8642` dengan endpoint yang
  kompatibel dengan OpenAI (`/v1/chat/completions`). ATLAS hanya menyimpan
  `HERMES_URL` dan `HERMES_API_KEY` di `.env`. Hermes menolak API key yang
  lebih pendek dari 16 karakter.
- **API key model** (OpenAI/DeepSeek/Anthropic/OpenRouter) disimpan di
  konfigurasi Hermes, tidak di ATLAS.
- **Data boleh dikirim ke penyedia AI luar negeri** (keputusan pengguna:
  "boleh saja tidak masalah untuk data").
- Server: RAM 7 GB, tanpa GPU. Model dipanggil lewat API, tidak dijalankan
  lokal.
- Next.js di repo ini versi 16 dengan perubahan API. Baca
  `node_modules/next/dist/docs/` sebelum menulis route atau komponen.
  Route handler tidak boleh mengekspor nama selain method HTTP dan konfigurasi
  route.
- Instal paket npm memakai `--legacy-peer-deps` (bentrok peer `vitest` dengan
  `@types/node` yang sudah ada sebelumnya di repo).
- Berkas lapsit adalah dokumen TNI. Jangan menyalin isi lapsit asli (angka
  personel/alat) ke repo, termasuk ke fixture test. Fixture memakai angka
  rekaan dengan format yang sama.

## 7. Yang sudah diputuskan (oleh pengguna)

- Alur: tampilkan tabel dulu, simpan hanya setelah operator setuju.
- Alpalhankam dan OMC ikut disimpan.
- Beberapa model, masing-masing dengan tugasnya. Pengguna akan menentukan
  pembagiannya.
- Hermes diadopsi dan diintegrasikan ke web ATLAS.
- Hermes di server yang sama, folder terpisah.
- Data boleh dikirim ke penyedia AI.
- Builder sendiri yang memasang dan menjalankan Hermes di `/home/wizard/hermes`
  sebagai bagian implementasi.

### Keputusan builder/penulis (bisa ditolak pengguna)

- Draf lapsit hanya ada di panel pengunggah. Pengunggah adalah penyetuju.
  "Batal" tidak menyimpan apa pun. Tidak ada tabel draf di server.
- Waktu lapsit wajib berupa tanggal dan jam WIB yang valid sebelum Setuju
  aktif. Tebakan model ditampilkan dan bisa dikoreksi ("28 Okt 24.00" =
  29 Okt 00.00 WIB). Teks asli dari dokumen ikut disimpan.
- Lapsit dengan waktu yang sama boleh diunggah ulang. Versi baru menjadi yang
  berlaku untuk waktu itu, dan versi lama tetap ada di riwayat. Lapsit yang
  lebih lama dari lapsit aktif hanya masuk riwayat, dengan peringatan ke
  operator. Lapsit yang salah diperbaiki dengan mengunggah ulang, tanpa tombol
  tarik kembali.
- Chat (`atlas-chat`) belum membaca data ATLAS pada tahap ini.
- Riwayat lapsit berupa daftar sederhana di panel asisten (waktu lapsit,
  penyetuju, waktu setuju), dan bisa dilihat semua pengguna yang sudah login.

## 8. Rancangan

### 8.1 Arsitektur

```
Browser operator ──► ATLAS (Next.js, server) ──► Hermes gateway 127.0.0.1:8642 ──► model via API
                     login, peran, rate limit      profil per tugas
                     tabel & tombol Setuju
                     database (Prisma)  ◄── hanya ATLAS yang menulis
```

- Semua panggilan ke Hermes dilakukan dari route server ATLAS. Browser tidak
  pernah tahu `HERMES_URL` atau kuncinya.
- Hermes hanya mengembalikan usulan, berupa teks chat atau data lapsit
  terstruktur. ATLAS yang memvalidasi dan menyimpan.

### 8.2 Profil Hermes

Dua profil (di Hermes, nama profil = model ID di API):

| Profil | Dipakai untuk | Toolset |
|---|---|---|
| `atlas-chat` | chat tanya-jawab operator | tanpa terminal, tanpa file, tanpa web |
| `atlas-lapsit` | membaca lapsit PDF → JSON terstruktur | tanpa terminal, tanpa file, tanpa web |

Model untuk tiap profil dipilih pengguna di konfigurasi Hermes. Profil
`atlas-lapsit` diberi instruksi (skill/system prompt) yang meminta keluaran
JSON sesuai skema di 8.4 dan **tidak mengarang**: kolom yang tidak ada di
dokumen diisi `null`.

### 8.3 Membaca PDF

ATLAS mengambil teks PDF di server (PDF lapsit contoh berbasis teks, bukan
scan), lalu mengirim **teks** itu ke profil `atlas-lapsit`. PDF mentah tidak
dikirim. Halaman yang tidak menghasilkan teks dilaporkan ke operator, tidak
dilewati diam-diam. Batas unggah: 1 berkas PDF, maks 15 MB.

### 8.4 Bentuk data hasil bacaan (kontrak Hermes → ATLAS)

```
{
  "lapsitAt": "2026-10-28T24:00+07:00" | string asli dari dokumen,
  "kodam": [
    {
      "namaDiDokumen": "Kodam II/Sriwijaya (Sumsel)",
      "awalTitik": number|null, "awalHa": number|null,
      "padamTitik": number|null, "padamHa": number|null,
      "prosesTitik": number|null, "prosesHa": number|null,
      "personelSiaga": number|null,
      "alpalhankamTotal": number|null,
      "alpalhankam": [{ "jenis": string, "jumlah": number }]
    }
  ],
  "omc": [
    {
      "periode": string, "wilayah": string,
      "pesawat": [{ "jenis": string, "jumlah": number,
                    "sortieDryIce": number|null, "sortieNaCl": number|null,
                    "dryIceTon": number|null, "naclTon": number|null }],
      "hasil": string|null
    }
  ]
}
```

ATLAS memvalidasi bentuk ini di server, termasuk tipe, angka tidak negatif,
dan batas wajar. Keluaran yang gagal validasi ditampilkan sebagai error yang
bisa dibaca operator, bukan ditambal diam-diam.

### 8.5 Mencocokkan Kodam

Nama di dokumen ("Kodam VI/ Mulawarman (Kaltim & Kaltara)") dicocokkan ke
kode Kotamaops ATLAS ("VI/MLW") oleh ATLAS, bukan oleh model, dengan
pencocokan berdasarkan nomor romawi dan nama. Baris yang tidak cocok tampil
di tabel dengan tanda "tidak dikenali", dan operator memilih Kodam-nya dari
daftar atau membuang baris itu. Lapsit tidak bisa disetujui selama masih ada
baris yang belum diselesaikan.

### 8.6 Penyimpanan

Data karhutla pindah dari konstanta di kode ke database (migrasi Prisma
baru). Bentuknya diserahkan ke builder (lihat Bagian 10), dengan syarat:

- Satu lapsit = satu catatan, dengan waktu lapsit, nama berkas, pengunggah,
  penyetuju, dan waktu persetujuan.
- Baris per Kodam (terkait Kotamaops), rincian Alpalhankam, dan OMC terkait
  ke lapsit itu.
- "Lapsit aktif" = lapsit **disetujui** dengan waktu lapsit paling baru.
- Data 5 Okt yang sekarang ada di `karhutla-lapsit.ts` dimasukkan sebagai
  lapsit awal (seed/migrasi), supaya tampilan tidak kosong setelah migrasi.
- Pemakai saat ini harus ikut pindah ke data database:
  `src/lib/ops/operator-view.ts` (`karhutlaScope`),
  `src/lib/kotamaops-flame.ts` (`KOTAMAOPS_FLAME_CODES`, yang sekarang
  dihitung saat modul dimuat), dan `src/components/OsirisMap.tsx` (popup
  KARHUTLA, komponen klien, jadi butuh data dari server/API). Test yang ada
  (`karhutla-lapsit.test.ts`, `kotamaops-flame.test.ts`) disesuaikan.

### 8.7 Peran

- Unggah dan setujui lapsit: `SUPER_ADMIN`, `ADMIN`, `OPERATOR_PUSDALOPS`.
- `OPERATOR_KODAM`, `ANALYST`, `PIMPINAN`: boleh memakai chat, tidak boleh
  mengunggah atau menyetujui lapsit.
- Semua route asisten mewajibkan login (`currentUser`) dan dibatasi laju per
  pengguna (`isRateLimited`).
- Persetujuan lapsit dicatat (siapa, kapan) dan terlihat di riwayat.

### 8.8 UI (di panel asisten yang sudah ada)

- Komponen `src/components/ops/atlas-chat.tsx` (tombol logo yang bisa
  digeser, panel chat) tetap dipakai, ditambah tombol unggah PDF.
- Setelah unggah: status "Membaca lapsit…", lalu tabel yang bisa diedit.
  Tabel per Kodam (kolom 8.4) bisa dibuka untuk melihat rincian Alpalhankam,
  dan ada bagian OMC terpisah. Tabelnya lebar, jadi panel melebar atau
  dibuka sebagai dialog penuh.
- Tombol **Setuju & simpan** dan **Batal**. Setelah simpan, dasbor memuat
  ulang angka karhutla.
- Teks panel tidak boleh lagi mengatakan "asisten tidak membaca data"
  bila sudah tidak benar. Teks harus jujur bahwa isi chat dan teks lapsit
  dikirim ke penyedia AI.

### 8.9 Yang diganti dari pekerjaan sebelumnya (belum di-commit)

- `src/app/api/ai/chat/route.ts` dan `src/lib/ai-chat.ts` sekarang memanggil
  Claude langsung lewat `@anthropic-ai/sdk`. Ini diganti menjadi panggilan ke
  Hermes (`atlas-chat`), dengan validasi pesan, login, dan rate limit tetap.
- `@anthropic-ai/sdk` dihapus dari `package.json` bila tidak dipakai lagi.

### 8.10 Pemasangan Hermes

Builder memasang Hermes di `/home/wizard/hermes` dan menuliskan langkahnya
sebagai panduan singkat (mis. `docs/hermes-setup.md`) supaya bisa diulang di
server lain. Panduan itu mencakup: memasang Hermes di folder terpisah, mengaktifkan API Server di `127.0.0.1`, membuat
dua profil (8.2) tanpa toolset terminal/file/web, mengisi API key model, dan
menjalankannya sebagai layanan yang hidup lagi sendiri setelah restart. Detail
konfigurasi Hermes (nama variabel, cara mematikan toolset per profil, header
auth) harus diambil dari dokumentasi resmi Hermes, bukan ditebak:
https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server

## 9. Konteks ke depan (bukan untuk dibangun sekarang)

Proyek 3: pemantau berita 24/7, yaitu mencari kata kunci isu TNI dan bencana
dari internet (media Indonesia) dan menampilkannya di ATLAS. Kandidatnya
Hermes Jobs API (`/api/jobs`) dengan profil terpisah yang hanya punya akses
web. ATLAS sudah punya `/api/news` (Telegram OSINT + RSS internasional, kata
kunci bahasa Inggris), `/api/gdelt` (GDACS), dan `/api/gdelt-events`.
Rancangan proyek 1–2 tidak boleh menutup jalan ini. Misalnya, klien Hermes di
ATLAS dibuat sebagai satu modul yang bisa dipakai ulang.

## 10. Diserahkan ke builder

- Skema tabel Prisma yang tepat dan nama-namanya.
- Library ekstraksi teks PDF di server (dependency kecil yang sudah lazim).
- Cara mencocokkan nama Kodam ke kode (tabel alias atau aturan), selama
  baris yang tidak cocok selalu terlihat.
- Tata letak tabel persetujuan.
- Penanganan timeout panggilan ke Hermes (pembacaan PDF bisa butuh puluhan
  detik). Perlu ada umpan balik ke operator, dan tidak ada data setengah jadi
  yang tersimpan.
