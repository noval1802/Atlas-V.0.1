# Akses endpoint ATLAS

Ringkasan kebijakan yang sedang berjalan. Dokumen ini tidak mengubah akses. Klasifikasi data untuk peta, CCTV, dan AI masih menunggu keputusan.

Peran pelaku selalu dibaca dari sesi yang ditandatangani dan akun aktif. Peran atau unit yang dikirim browser tidak menggantikan sesi.

## Hanya sesi

Semua peran aktif boleh memanggil endpoint ini: `SUPER_ADMIN`, `ADMIN`, `OPERATOR_PUSDALOPS`, `OPERATOR_KODAM`, `ANALYST`, dan `PIMPINAN`. Tanpa sesi, jawaban 401.

Peta dan monitoring, semuanya `GET` kecuali disebut lain:

- `/api/flights`, `/api/aircraft`, `/api/flight-route`, `/api/maritime`, `/api/satellites`, `/api/satellites/orbit`
- `/api/earthquakes`, `/api/fires`, `/api/weather`, `/api/air-quality`
- `/api/news`, `/api/live-news`, `/api/gdelt`, `/api/gdelt-events`
- `/api/region-dossier`, `/api/stats`, `/api/directions`
- `/api/geo`, `/api/geo/reverse`, `/api/geosearch`, `/api/proxy-tiles`
- `/api/sentinel`, `/api/entity/expand`, `/api/arcgis`

CCTV dan media, `GET`:

- `/api/cctv`, `/api/cctv/proxy`, `/api/cctv/resolve`, `/api/cctv/stream-status`
- `/api/cctv/tpt/media`, `/api/cctv/texas/snapshot`

## Juga semua peran

AI, `POST`, dengan batas laju di handler. Ringkasan dibuat di server ini tanpa model eksternal:

- `/api/ai/overview`

Situasi, baca:

- `GET /api/ops/situations` mengembalikan semua unit untuk setiap peran di atas, kecuali `OPERATOR_KODAM` yang hanya menerima `kotamaopsId` pada akunnya.

Halaman dengan sesi:

- `/peta` untuk semua peran.
- `/operator` untuk semua peran. Formulir simpan dimatikan bila peran tidak boleh menulis.
- `/` mengarah ke beranda peran bila sesi hidup, dan ke `/masuk` bila tidak.

## Peran tertentu

Admin (`SUPER_ADMIN` dan `ADMIN`):

- `GET` dan `POST /api/ops/users`
- `PATCH /api/ops/users/[id]`
- `GET /api/ops/audit`
- `GET` dan `POST /api/cctv/tokens` (status token saja; nilai token tidak dikembalikan)
- Halaman `/pengguna`

Peran lain menerima 403. `POST` dan `PATCH` pengguna menolak pemberian atau pencabutan `SUPER_ADMIN` bila pelaku bukan `SUPER_ADMIN`.

Penulis situasi (`SUPER_ADMIN`, `ADMIN`, `OPERATOR_PUSDALOPS`, `OPERATOR_KODAM`):

- `PATCH /api/ops/situations/[id]`
- `OPERATOR_KODAM` hanya menulis unitnya. ID yang tidak ada dan ID unit lain sama-sama 404.
- `ANALYST` dan `PIMPINAN` menerima 403 sebelum baris dibaca.

## Autentikasi khusus

Tanpa sesi operator:

- `POST /api/ops/login`, `POST /api/ops/logout`, `POST /api/ops/register`
- `POST /api/ops/password/forgot`, `POST /api/ops/password/reset`
- `GET /api/health`, `GET /api/health/ready`

## Dihapus 27 Okt 2026

Alat OSINT dan pemindai (`/api/osint/*`, `/api/scanner`), lapisan siber (`/api/malware`, `/api/cyber-attacks`, `/api/cyber-threats`, `/api/cloudflare-radar`, `/api/radar`), SDK (`/api/sdk/*`), dan `/api/github-webhook`.

## Masih menunggu keputusan

Endpoint pada bagian "Hanya sesi" belum dipisah menurut klasifikasi data. Semua peran dapat membuka AI dan CCTV. Jangan ditutup sebelum ada keputusan.
