#!/bin/sh
# Temporary self-signed certificate for the nginx HTTPS listener, until the
# unit's own CA issues one. Browsers warn on it; replace both files with the
# issued certificate and key under the same names, then reload nginx.
#
#   ops/tls/self-signed.sh <hostname> [ip-address]
#   e.g. ops/tls/self-signed.sh atlas.pusdalops.local 10.10.1.20
set -eu

name="${1:?usage: $0 <hostname> [ip-address]}"
ip="${2:-}"
dir="$(dirname "$0")/../../nginx/certs"
mkdir -p "$dir"

san="DNS:$name,DNS:localhost,IP:127.0.0.1"
[ -n "$ip" ] && san="$san,IP:$ip"

umask 077   # the private key must not be world-readable
openssl req -x509 -newkey rsa:3072 -sha256 -days 397 -nodes \
  -keyout "$dir/atlas.key" -out "$dir/atlas.crt" \
  -subj "/CN=$name/O=Pusdalops TNI/OU=ATLAS" \
  -addext "subjectAltName=$san" \
  -addext "extendedKeyUsage=serverAuth" 2>/dev/null
chmod 644 "$dir/atlas.crt"
echo "Wrote $dir/atlas.crt and $dir/atlas.key ($san, valid 397 days)."
