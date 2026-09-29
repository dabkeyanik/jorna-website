# Jorna web

Both of Jorna's web apps, in one repo. They talk to the same FastAPI backend
(the `Desiconnect` repo, on Railway), which is the source of truth for how
anything behaves.

| App | Folder | Serves | Cloudflare Pages project |
| --- | --- | --- | --- |
| Client | [`apps/client`](apps/client) | [book.jornaevents.com](https://book.jornaevents.com) — hosts plan and book | `jorna-events` |
| Vendor | [`apps/vendor`](apps/vendor) | [jornaevents.com](https://jornaevents.com) — vendors, and the no-login contract signing page | `jorna-vendor` |

Code both apps use — the API client, UI kit, styles and the helpers that are
identical on both sides — lives once in [`packages/shared`](packages/shared)
(`@jorna/shared`). Everything else is the app's own: its `web/` (Next.js),
`public/`, deploy script, docs and README. Each app builds and deploys on its
own.

The repo is one npm workspace, so dependencies install once, at the root:

```bash
npm install                            # at the root: every app, the shared package, the pre-commit hook
cd apps/client && npm --prefix web run dev   # or apps/vendor · http://localhost:3000/app
```

## Deploying

**Merging to `main` is deploying.** CI (`.github/workflows/ci.yml`) works
out which apps a change touches and runs lint, typecheck, unit tests, build
and end-to-end tests for each, publishes a PR preview per app, and on
`main` deploys each changed app to its Cloudflare Pages project. A change
outside `apps/` counts as touching both. See each app's `DEPLOY.md`.

The two apps grew up as separate repos (`jorna-vendor` started as a copy of
this one). What was identical is now in `packages/shared`; what had drifted
apart — the typed API layer (`lib/jorna.ts`), most of `lib/types.ts`, auth,
and the components built on them — is still copied in both apps until it's
reconciled.
