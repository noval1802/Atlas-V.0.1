#!/bin/sh
# Restore an ATLAS dump into a database. DESTRUCTIVE for the target: existing
# objects are dropped first (--clean). Restore into a scratch database first
# when checking a backup.
#
#   ops/backup/restore.sh <file.dump> <target-database-url>
#
# From the compose stack (the dump volume is mounted at /backups):
#   docker compose run --rm osiris-backup /ops/restore.sh /backups/atlas-<stamp>.dump \
#     "postgresql://osiris:$OSIRIS_POSTGRES_PASSWORD@osiris-postgres:5432/osiris_ops"
set -eu

if [ $# -ne 2 ]; then
  echo "usage: $0 <file.dump> <target-database-url>" >&2
  exit 2
fi
dump="$1"
target="$2"
[ -f "$dump" ] || { echo "no such dump: $dump" >&2; exit 2; }

pg_restore --list "$dump" >/dev/null   # refuse a truncated or foreign file before touching the target
pg_restore --clean --if-exists --no-owner --exit-on-error --dbname="$target" "$dump"
echo "[restore] $(date -u +%FT%TZ) restored $dump"
