#!/usr/bin/env bash
# Start the ATLAS dev server on 0.0.0.0:3005 with the user-local Node 22.
set -euo pipefail

cd /home/wizard/Atlas-V.0.1
export PATH="$HOME/.local/node22/bin:$PATH"
export NODE_ENV=development

pkill -f 'next/dist/bin/next dev' 2>/dev/null || true
pkill -f 'next-server' 2>/dev/null || true
sleep 1

: > /tmp/atlas-dev.log
setsid nohup npm run dev -- --hostname 0.0.0.0 --port 3005 </dev/null >>/tmp/atlas-dev.log 2>&1 &
sleep 8

echo "--- node: $(node -v)"
tail -20 /tmp/atlas-dev.log
