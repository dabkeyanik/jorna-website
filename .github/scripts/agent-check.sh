#!/usr/bin/env bash
# Runs one check in one workspace for the PR review agent:
#   agent-check.sh <client|vendor|shared> <lint|typecheck|test>
# Its tool allowlist matches commands by prefix, so it's allowed this script
# rather than arbitrary `cd … && npm …` chains.
set -euo pipefail

case "${1:-}" in
  client | vendor) dir="apps/$1/web" ;;
  shared) dir="packages/shared" ;;
  *) echo "usage: agent-check.sh <client|vendor|shared> <lint|typecheck|test>" >&2; exit 2 ;;
esac
case "${2:-}" in
  lint | typecheck | test) ;;
  *) echo "usage: agent-check.sh <client|vendor|shared> <lint|typecheck|test>" >&2; exit 2 ;;
esac

cd "$(dirname "$0")/../../$dir"
exec npm run "$2"
