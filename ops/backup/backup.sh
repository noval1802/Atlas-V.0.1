#!/bin/sh
# Daily pg_dump of the ATLAS operations database, run by the osiris-backup service.
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE  connection (set by docker-compose.yml)
#   BACKUP_DIR              where dumps go (default /backups, a volume)
#   BACKUP_RETENTION_DAYS   dumps older than this are deleted (default 14)
#   BACKUP_INTERVAL_SECONDS time between runs (default 86400)
#   BACKUP_ONCE=1           take one dump and exit (for manual runs and tests)
set -eu

dir="${BACKUP_DIR:-/backups}"
keep="${BACKUP_RETENTION_DAYS:-14}"
interval="${BACKUP_INTERVAL_SECONDS:-86400}"
mkdir -p "$dir"

take_dump() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  out="$dir/atlas-$stamp.dump"
  # Written to .tmp first: a dump cut short by a crash or a full disk never looks complete.
  if pg_dump --format=custom --no-owner --file="$out.tmp"; then
    mv "$out.tmp" "$out"
    echo "[backup] $(date -u +%FT%TZ) ok $out ($(du -h "$out" | cut -f1))"
  else
    rm -f "$out.tmp"
    echo "[backup] $(date -u +%FT%TZ) FAILED" >&2
    return 1
  fi
  find "$dir" -name 'atlas-*.dump' -type f -mtime +"$keep" -print -delete | sed 's/^/[backup] removed /'
}

if [ "${BACKUP_ONCE:-0}" = "1" ]; then
  take_dump
  exit $?
fi

while true; do
  # A failed run is logged and retried next interval rather than stopping the service.
  take_dump || true
  sleep "$interval"
done
