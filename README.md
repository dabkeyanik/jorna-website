# Jorna web

Both of Jorna's web apps, in one repo. They talk to the same FastAPI backend
(the `Desiconnect` repo, on Railway), which is the source of truth for how
anything behaves.

| App | Folder | Serves | Cloudflare Pages project |
| --- | --- | --- | --- |
| Client | [`apps/client`](apps/client) | [book.jornaevents.com](https://book.jornaevents.com) — hosts plan and book | `jorna-events` |
| Vendor | [`apps/vendor`](apps/vendor) | [jornaevents.com](https://jornaevents.com) — vendors, and the no-login contract signing page | `jorna-vendor` |

Each app is self-contained — its own `web/` (Next.js), `public/`, deploy
script, docs and README — and builds and deploys on its own. Run an app's
commands from its folder:

```bash
cd apps/client            # or apps/vendor
npm run install:app       # first time
npm --prefix web run dev  # http://localhost:3000/app
```

At the root: `npm install` once, to set up the pre-commit hook (lint and
typecheck for whichever app's files are staged).

## Deploying

**Merging to `main` is deploying.** CI (`.github/workflows/ci.yml`) works
out which apps a change touches and runs lint, typecheck, unit tests, build
and end-to-end tests for each, publishes a PR preview per app, and on
`main` deploys each changed app to its Cloudflare Pages project. A change
outside `apps/` counts as touching both. See each app's `DEPLOY.md`.

The two apps grew up as separate repos (`jorna-vendor` started as a copy of
this one), so they still carry duplicate copies of shared code — the API
client, auth, types, UI kit, styles. Moving those into one shared package is
the next step.
