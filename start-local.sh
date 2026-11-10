#!/usr/bin/env bash
# Start the user-owned Postgres (port 5433) and the Next.js dev server for LAN access.
D=/home/wizard/.local/share/atlas-pg
/usr/lib/postgresql/18/bin/pg_ctl -D "$D" status >/dev/null 2>&1 ||
  /usr/lib/postgresql/18/bin/pg_ctl -D "$D" -o "-p 5433 -k /tmp -c listen_addresses=127.0.0.1" -l "$D.log" -w start
cd /home/wizard/Atlas-V.0.1
export PATH=/home/wizard/.local/node22/bin:$PATH
exec npm run dev
