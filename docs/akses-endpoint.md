# Akses endpoint ATLAS

Ringkasan kebijakan yang sedang berjalan. Dokumen ini tidak mengubah akses. Klasifikasi data untuk peta, CCTV, OSINT, pemindai, dan AI masih menunggu keputusan.

Peran pelaku selalu dibaca dari sesi yang ditandatangani dan akun aktif. Peran atau unit yang dikirim browser tidak menggantikan sesi.

## Hanya sesi

Semua peran aktif boleh memanggil endpoint ini: `SUPER_ADMIN`, `ADMIN`, `OPERATOR_PUSDALOPS`, `OPERATOR_KODAM`, `ANALYST`, dan `PIMPINAN`. Tanpa sesi, jawaban 401.

Peta dan monitoring, semuanya `GET` kecuali disebut lain:

- `/api/flights`, `/api/aircraft`, `/api/flight-route`, `/api/maritime`, `/api/satellites`, `/api/satellites/orbit`
- `/api/earthquakes`, `/api/fires`, `/api/weather`, `/api/air-quality`, `/api/space-weather`
- `/api/news`, `/api/live-news`, `/api/gdelt`, `/api/gdelt-events`, `/api/conflicts`, `/api/frontlines`
- `/api/infrastructure`, `/api/radar`, `/api/country-risk`, `/api/region-dossier`, `/api/stats`
- `/api/markets`, `/api/markets/history`, `/api/crypto`, `/api/directions`
- `/api/geo`, `/api/geo/reverse`, `/api/geosearch`, `/api/proxy-tiles`
- `/api/malware`, `/api/malware/stream`, `/api/cyber-attacks`, `/api/cyber-threats`
- `/api/cloudflare-radar`, `/api/sentinel`, `/api/chain/daily`, `/api/entity/expand`, `/api/scm-suppliers`, `/api/arcgis`

CCTV dan media, `GET`:

- `/api/cctv`, `/api/cctv/proxy`, `/api/cctv/resolve`, `/api/cctv/stream-status`
- `/api/cctv/tpt/media`, `/api/cctv/texas/snapshot`

Berita dan OSINT, `GET`:

- `/api/osint/bgp`, `/api/osint/certs`, `/api/osint/crypto`, `/api/osint/cve`, `/api/osint/dns`
- `/api/osint/fingerprint`, `/api/osint/github`, `/api/osint/hudsonrock`, `/api/osint/ip`
- `/api/osint/leaks`, `/api/osint/mac`, `/api/osint/phone`, `/api/osint/sanctions`
- `/api/osint/shodan`, `/api/osint/sweep`, `/api/osint/threats`, `/api/osint/username`, `/api/osint/whois`

AI, `POST`, dengan batas laju di handler:

- `/api/ai/analyze`, `/api/ai/briefing`, `/api/ai/overview`

Pemindai, `GET`:

- `/api/scanner`

Situasi, baca:

- `GET /api/ops/situations` mengembalikan semua unit untuk setiap peran di atas, kecuali `OPERATOR_KODAM` yang hanya menerima `kotamaopsId` pada akunnya.

SDK, baca:

- `GET /api/sdk/ingest`, `GET /api/sdk/stream`

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
- `GET /api/health`
- `POST /api/github-webhook` memakai tanda tangan HMAC. Tanpa rahasia, jawaban 503.
- `POST /api/sdk/ingest` memakai kunci ingest. Tanpa kunci, jawaban 503.

## Masih menunggu keputusan

Endpoint pada bagian "Hanya sesi" belum dipisah menurut klasifikasi data. Viewer dan Monitoring dapat membuka OSINT, pemindai, AI, CCTV, dan daftar SDK. Jangan ditutup sebelum ada keputusan.
