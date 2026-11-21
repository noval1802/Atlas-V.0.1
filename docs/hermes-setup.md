# Hermes untuk chat ATLAS

Chat operator (`/api/ai/chat`) berjalan lewat [Hermes Agent](https://hermes-agent.nousresearch.com) (Nous Research). ATLAS hanya mengirim pesan ke Hermes di `127.0.0.1`, lalu Hermes memanggil model lewat API. Tidak ada model yang berjalan di server ini.

Dicoba dengan Hermes v0.23.2.

## Tata letak

| Apa | Di mana |
|---|---|
| Kode Hermes | `/home/wizard/hermes` |
| Perintah `hermes` | `~/.local/bin/hermes` |
| Instance khusus ATLAS (config, key, log) | `~/.hermes-atlas` (`chmod 700`) |

ATLAS memakai `HERMES_HOME` sendiri, `~/.hermes-atlas`, bukan profil di `~/.hermes`. Sejak v0.23 satu gateway melayani semua profil di `~/.hermes`, termasuk profil default yang punya terminal. Instance terpisah memastikan gateway yang dipakai ATLAS tidak memegang tool apa pun.

## Pasang

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh -o install.sh   # baca dulu isinya
bash install.sh --dir /home/wizard/hermes --non-interactive --skip-browser --skip-computer-use
mkdir -m 700 ~/.hermes-atlas
```

## `~/.hermes-atlas/config.yaml`

```yaml
model:
  default: nousresearch/hermes-4-405b
  provider: auto
  base_url: https://openrouter.ai/api/v1
_config_version: 53

platform_toolsets:
  api_server: []          # daftar kosong = tanpa tool dan tanpa MCP

agent:
  disabled_toolsets: [terminal, file, code_execution, coding, web, search, x_search, browser, computer_use, memory, session_search, skills, delegation, cronjob, kanban, image_gen, video_gen, vision, tts, messaging, discord, discord_admin, connections, project, catalog, debugging, desktop_ui, feishu_doc, feishu_drive, todo, clarify]

auth:
  adopt_external_logins: false   # jangan pinjam login Claude Code/Codex milik developer
```

Isi chat dan teks dokumen tidak boleh bisa "menyuruh" Hermes menjalankan perintah di server. Kedua kunci di atas yang menjaminnya, jadi jangan dihapus.

## `~/.hermes-atlas/.env`

```bash
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=<openssl rand -hex 32>
OPENROUTER_API_KEY=<key model>
```

Isi `OPENROUTER_API_KEY` sendiri dengan editor di server, jangan lewat chat atau riwayat shell.

Di `.env` ATLAS:

```bash
HERMES_URL=http://127.0.0.1:8642
HERMES_API_KEY=<sama dengan API_SERVER_KEY>
```

## Jalankan

```bash
HERMES_HOME=~/.hermes-atlas hermes gateway run
```

Gateway belum dipasang sebagai layanan yang hidup sendiri setelah reboot. Itu dikerjakan saat menyiapkan server produksi.

## Cek

```bash
K=$(grep ^API_SERVER_KEY= ~/.hermes-atlas/.env | cut -d= -f2)
curl -s http://127.0.0.1:8642/health                                        # {"status": "ok", ...}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8642/v1/models     # 401 tanpa key
curl -s -H "Authorization: Bearer $K" http://127.0.0.1:8642/v1/toolsets     # tidak ada yang "enabled": true
ss -ltn | grep 8642                                                          # hanya 127.0.0.1
```

Kalau Hermes mati, chat menjawab "Asisten sedang tidak tersedia", sedangkan bagian ATLAS lainnya tetap berjalan.
