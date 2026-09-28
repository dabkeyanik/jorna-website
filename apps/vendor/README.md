# jornaevents.com

The vendor side of **Jorna** — where vendors list their packages, answer
requests and run their bookings — plus the no-login page where any client
signs a contract. A Next.js app exported to static files and served by
Cloudflare Pages (project `jorna-vendor`), with a small hand-written help
page at `/help`.

Hosts plan and book on the client app, [book.jornaevents.com](https://book.jornaevents.com)
(`jorna-website` repo). Both talk to the same FastAPI backend
(`Desiconnect` repo, on Railway), which is the source of truth for how
anything behaves.

```
web/                 the app (Next.js, output: "export", basePath "/app")
public/app/          the app's static export — GENERATED, gitignored
public/help/         static help page (hand-written, no build step)
public/_redirects    rewrites "/" to "/app/"
scripts/             build + deploy tooling
docs/                architecture, module map, booking flow, decisions
wrangler.jsonc       Cloudflare Pages config (serves ./public)
```

## What's in it

- **Marketing pages for vendors** at the site root (`/` renders the app's
  Home), plus `/for-vendors`, `/for-clients`, `/how-it-works`.
- **Vendor dashboard**, behind a sidebar: requests and bookings, contracts,
  clients and leads, calendar, earnings, messages, and the vendor's own
  listing and packages. New vendors go through a three-step onboarding.
- **Contracts** — a step-by-step builder (client, event, items, payments,
  terms, review) for proposals with several packages, add-ons, a discount, a
  payment plan and clauses; templates saved to the account; one page per
  contract with its payments and timeline. Accepting a marketplace request
  opens the same builder, or sends a contract built from the vendor's usual
  terms.
- **`/booking-link?t=…`** — the client's side of a contract: read it, fill in
  their details, sign by typing their name, decline, and mark each payment
  sent. No account needed; the token in the link is the whole credential.
  Signed-in clients from book.jornaevents.com sign here too.

Jorna doesn't handle money for now: clients pay vendors directly
(Venmo/Zelle). Stripe escrow UI is still in the code behind
`NEXT_PUBLIC_ESCROW_ENABLED`, which production builds set to `false`.

`docs/MODULE_MAP.md` says which files own what; `docs/BOOKING_FLOW.md` walks
the booking lifecycle; `docs/DECISIONS.md` explains the why.

## Developing

```bash
npm run install:app         # first time: install the app's dependencies
npm --prefix web run dev    # http://localhost:3000/app
```

Settings come from `web/.env.local` (see `web/.env.example`; nothing in it is
secret). **The production API doesn't accept requests from localhost**, so
run the backend locally (see the `Desiconnect` README) and point the app at
it:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_ESCROW_ENABLED=false        # as production is built
NEXT_PUBLIC_CLIENT_APP_URL=http://localhost:3200   # if you run jorna-website too
```

and add `http://localhost:3000` to the backend's `ALLOWED_ORIGINS`.

API calls all go through `web/src/lib/jorna.ts` (typed) → `web/src/lib/api.ts`
(transport, including the shared token refresh); auth is
`web/src/lib/auth.tsx`. Email/password signs in against the backend, which
issues Jorna's own tokens; Google sign-in uses Supabase as an identity
provider only.

## Tests

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test       # Vitest — pure logic in web/src/lib
npm run test:e2e                # Playwright — every backend call mocked
```

The end-to-end tests run against `next dev` with the backend replaced by
per-test mocks, so they never reach production. A pre-commit hook runs lint
and typecheck on staged files.

## Deploying

**Merging to `main` is deploying.** `main` is protected: open a PR, and CI
builds it, runs the unit and end-to-end tests, and publishes a preview.
When it merges, CI deploys to Cloudflare Pages.

`npm run deploy` builds and deploys from your machine and then checks every
route serves (see `DEPLOY.md`) — for emergencies, not the normal path.
Because `public/app/` is generated, never run a bare `wrangler pages deploy`:
it ships whatever old build happens to be on disk.

## Design notes

- Brand tokens (maroon/gold/cream, light and dark) are Tailwind v4 `@theme`
  variables in `web/src/app/globals.css`.
- Fonts are system stacks (Didot/Palatino for headings, Avenir Next/Segoe UI
  for body) — nothing is fetched over the network.
- `public/help/index.html` is hand-written; edit it directly.
