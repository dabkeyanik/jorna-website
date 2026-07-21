# Deploying jornaevents.com

The site (marketing page at `/` + the web app under `/app`) is a static export
in `public/`, hosted on **Cloudflare Pages** (project `jorna-events`).

> **Why Pages, not Workers.** It was on Workers Static Assets, whose many-file
> asset serving intermittently dropped every `/app` route (marketing page stayed
> up, app 404'd) even after a deploy verified green. Pages is built for
> many-file static exports and serves them reliably.

## Deploy

```bash
npm run deploy
```

This builds the app into `public/app`, runs `wrangler pages deploy public`, then
fetches every route and re-deploys until they all serve 200 (see
`scripts/deploy.mjs`). It verifies against `jorna-events.pages.dev`; once the
apex is on Pages you can verify the apex directly with
`DEPLOY_DOMAIN=https://jornaevents.com npm run deploy`.

`npm run deploy:once` is the raw single-shot.

## One-time: move the apex domain to Pages

Until this is done, `jornaevents.com` still serves from the old Worker
(`misty-water-0dbb`). The Pages deployment is live and verifiable at
`https://jorna-events.pages.dev`.

In the Cloudflare dashboard:

1. **Workers & Pages → `misty-water-0dbb` → Settings → Domains & Routes** —
   remove the `jornaevents.com` custom domain. (Frees the hostname.)
2. **Workers & Pages → `jorna-events` (Pages) → Custom domains → Set up a custom
   domain →** `jornaevents.com`. The zone is already on Cloudflare, so DNS + TLS
   provision automatically.
3. Once `https://jornaevents.com/app/` serves the app, set the deploy default:
   change `DEPLOY_DOMAIN` in `scripts/deploy.mjs` to `https://jornaevents.com`.
4. Retire the old Worker (`wrangler delete` or dashboard) so nothing else claims
   the domain.

Backend CORS already allows `https://jornaevents.com`, so no API change is
needed. (The `*.pages.dev` origin is **not** allowed, so API calls only work
once the app is on the real domain.)
