#!/usr/bin/env bash
# Signs the PR review agent's two staging accounts in and writes a Playwright
# storage state with each session on its own app's PR preview: the client
# account on pr-<n>.jorna-events.pages.dev, the vendor account on
# pr-<n>.jorna-vendor.pages.dev. The agent's browser starts signed in, so the
# password (a GitHub secret) never reaches the agent. The accounts come from
# jorna-backend's scripts/seed_staging.py.
#
# Env: STAGING_API, E2E_AGENT_PASSWORD, PR (number), OUT (file to write).
set -euo pipefail

: "${STAGING_API:?STAGING_API_BASE_URL Actions variable is not set}"
: "${E2E_AGENT_PASSWORD:?E2E_AGENT_PASSWORD secret is not set}"
: "${PR:?}" "${OUT:?}"

login() {
  jq -nc --arg i "e2e-agent-$1@example.test" --arg p "$E2E_AGENT_PASSWORD" '{identifier: $i, password: $p}' |
    curl -sS --fail-with-body "$STAGING_API/auth/login" -H 'Content-Type: application/json' --data @-
}

# The same localStorage keys both apps' auth layer reads (web/src/lib/auth.tsx).
session() {
  jq -c --arg o "$1" '{origin: $o, localStorage: [
    {name: "jorna_access", value: .access_token},
    {name: "jorna_refresh", value: .refresh_token}]}'
}

client=$(login client | session "https://pr-$PR.jorna-events.pages.dev")
vendor=$(login vendor | session "https://pr-$PR.jorna-vendor.pages.dev")
jq -n --argjson c "$client" --argjson v "$vendor" '{cookies: [], origins: [$c, $v]}' > "$OUT"
echo "Signed in e2e-agent-client and e2e-agent-vendor for PR #$PR's previews."
