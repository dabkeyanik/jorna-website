#!/usr/bin/env bash
# Add an API origin to the Content-Security-Policy's connect-src in a Pages
# _headers file, in place. The committed policy only allows the production
# API; builds that talk to another backend (staging, PR previews) run this on
# their CI copy before deploying, so the committed file never changes.
#
# Usage: csp-allow-api.sh <path/to/_headers> <https://api.example>
set -euo pipefail

file=${1:?_headers path required}
origin=${2:?API origin required}
origin=${origin%/}
case "$origin" in
  https://*) ;;
  *) echo "::error::API origin must be https://… (got '$origin')"; exit 1 ;;
esac
host=${origin#https://}

grep -q "connect-src 'self'" "$file" || { echo "::error::no connect-src 'self' in $file"; exit 1; }
# | as the sed delimiter: origins contain / but never |.
sed -i.bak "s|connect-src 'self'|connect-src 'self' $origin wss://$host|" "$file"
rm -f "$file.bak"
grep -q "connect-src 'self' $origin " "$file"
echo "CSP connect-src now allows $origin"
