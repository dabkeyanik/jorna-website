# Deploying jorna-vendor

The site (the web app, serving both `/` and `/app`, plus a small static
`/help` page) is a static export in `public/`, hosted on **Cloudflare Pages**
(project `jorna-vendor` — see `wrangler.jsonc`). This repo was forked from
`jorna-website` (project `jorna-events`, which stays untouched and serves
jornaevents.com) — the two must never share a Cloudflare project name, or
one repo's CI would overwrite the other's production site.

No custom domain is attached yet; the site is reachable at
`https://jorna-vendor.pages.dev` until one is added (Cloudflare dashboard →
Workers & Pages → jorna-vendor → Custom domains).

## Deploy

**Automatic:** merging a PR into `main` deploys. `.github/workflows/ci.yml`'s
`deploy` job runs `npm run deploy` once `build` and `e2e` both pass, using a
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secret pair (Pages:Edit
scope) instead of a local `wrangler login` session. `main` is a protected
branch (GitHub branch protection, PR required), so this is the only path a
change reaches production through.

**Manual** (hotfix, or deploying from a machine when CI itself is down):
```bash
npm run deploy
```

Installs `web/`'s dependencies fresh from the lockfile (`npm ci`, not
whatever a developer's local `node_modules` happens to hold), builds the app
into `public/app`, runs `wrangler pages deploy public`, then fetches every
route and re-deploys until they all serve 200 for three consecutive sweeps
(see `scripts/deploy.mjs`). `npm run deploy:once` is the raw single-shot and
skips the `npm ci` step.

`scripts/deploy.mjs` verifies against `https://jorna-vendor.pages.dev` by
default (`DEPLOY_DOMAIN` env var overrides this) — once a custom domain is
attached, see jorna-website's own `DEPLOY.md` for why a custom domain's
bot/WAF protection can force verification back onto the `*.pages.dev` URL
specifically for CI runner IPs.

## One-time setup for a fresh Cloudflare Pages project

1. In the Cloudflare dashboard: Workers & Pages → Create → Pages → **Connect
   to Git** is *not* what this repo uses (that's Cloudflare's own build
   pipeline, bypassing this repo's CI gates) — instead, create the project
   with **no** Git connection so this repo's own GitHub Actions `deploy` job
   is the only thing that pushes to it. Easiest way: run
   `npx wrangler pages project create jorna-vendor` once, locally, with
   `wrangler login` authenticated to the right Cloudflare account.
2. Create a Cloudflare API token (My Profile → API Tokens → Create Token →
   "Edit Cloudflare Workers" template, or a custom token scoped to
   `Account.Cloudflare Pages: Edit`) and note the Account ID (right sidebar
   of any zone/dashboard page).
3. Add both as GitHub repo secrets:
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN --repo jornaevents/jorna-vendor
   gh secret set CLOUDFLARE_ACCOUNT_ID --repo jornaevents/jorna-vendor
   ```
   (`gh secret set` prompts for the value interactively — nothing is echoed
   or logged.)
4. Push to `main` (or merge a PR into it) — the `deploy` job now has what it
   needs.

## Per-PR staging previews

Every PR gets its own live preview, deployed by the `preview` job in
`.github/workflows/ci.yml`: `wrangler pages deploy public --branch
pr-<PR number>` — a non-production `--branch` value makes Cloudflare Pages
create a **preview** deployment instead of promoting to production, at
`https://pr-<n>.jorna-vendor.pages.dev`. It does not touch the production
`jorna-vendor.pages.dev` URL, which only the `deploy` job (on merge to
`main`) owns. The job posts (and updates, on new pushes) a sticky PR comment
with the link.

**Not a fully isolated staging environment**: previews call the same
backend and database as production — there's no separate staging API or DB
(see this repo's own `CLAUDE.md`/`docs/DECISIONS.md`). A preview that walks
through a booking or contract-signing flow is still writing real data.
Verify CORS is wired for a preview URL with:

```bash
curl -i -X OPTIONS -H "Origin: https://pr-999.jorna-vendor.pages.dev" \
    -H "Access-Control-Request-Method: POST" $API/auth/login
# expect: access-control-allow-origin: https://pr-999.jorna-vendor.pages.dev
```

If that doesn't come back, the backend's `ALLOWED_ORIGIN_REGEX` (Railway env
var on `Desiconnect`) needs a pattern covering
`pr-<n>.jorna-vendor.pages.dev`, alongside the one already covering
jorna-website's previews.
