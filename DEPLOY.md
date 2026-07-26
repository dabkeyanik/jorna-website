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

Builds the app into `public/app`, runs `wrangler pages deploy public`, then
fetches every route and re-deploys until they all serve 200 (see
`scripts/deploy.mjs`). `npm run deploy:once` is the raw single-shot.

It verifies against `jorna-events.pages.dev` and then warns if
`jornaevents.com` is serving a different build — which it currently is, see
below. **A green deploy does not mean the change is live for users** until the
cutover is finished.

## ⚠️ Unfinished: the apex is still on the retired Worker

`jornaevents.com` is **attached to the Pages project already**
(`wrangler pages project list` lists it under Project Domains), but the retired
Worker `misty-water-0dbb` still holds the live binding for that hostname. The
Worker wins, so the apex serves **an older build** while Pages serves the
current one.

That collision is also why `wrangler deploy --config wrangler.worker.jsonc`
now fails with a `domains/records` API error: two things claim one hostname.
Deploying to the Worker can no longer succeed, so `npm run deploy` ships to
Pages only (`DEPLOY_TARGET=pages` is the default).

**The one remaining action** — Cloudflare dashboard, **Workers & Pages →
`misty-water-0dbb` → Settings → Domains & Routes → remove `jornaevents.com`.**
Freeing the hostname lets the Pages custom domain activate, and the apex starts
serving whatever was last deployed.

Then, in this order:

1. Confirm `https://jornaevents.com/app/login/` matches
   `https://jorna-events.pages.dev/app/login/` (compare the bytes, not just a
   200 — that is exactly how the stale apex went unnoticed).
2. In `scripts/deploy.mjs`: set `DOMAIN` back to `https://jornaevents.com` and
   delete the `apexMatches()` check and its call — both exist only for this
   transition.
3. Delete `wrangler.worker.jsonc` and drop the `"both"` branch of
   `DEPLOY_TARGET`.
4. Retire the Worker itself (`wrangler delete --name misty-water-0dbb`, or the
   dashboard) so nothing can reclaim the domain.

## Why pages.dev is not a usable staging URL

Backend CORS allows `https://jornaevents.com` and **rejects**
`https://jorna-events.pages.dev` — verified by preflight:

```
$ curl -i -X OPTIONS -H "Origin: https://jornaevents.com" \
    -H "Access-Control-Request-Method: POST" $API/auth/login
HTTP/1.1 200 OK
access-control-allow-origin: https://jornaevents.com

$ curl -i -X OPTIONS -H "Origin: https://jorna-events.pages.dev" ... 
HTTP/1.1 400 Bad Request
```

So the pages.dev deployment **renders but cannot talk to the API** — every
sign-in, booking, and listing call fails CORS. It proves the build ships; it
cannot prove the build works. Until the apex moves, the only place the app is
genuinely exercisable is `jornaevents.com`, which is serving the old build.

To use pages.dev as a real staging environment, add it to `ALLOWED_ORIGINS` on
Railway (the backend reads that env var; it is not in the repo).
