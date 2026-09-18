# Current Task

> Temporary working memory for the task in progress. This file describes
> *current* work, not permanent architecture — that belongs in `docs/`. It's
> expected to be overwritten/reset when a task finishes; don't treat it as a
> log.

## Goal

Rebuild this repo as a vendor-only dashboard product (kanban pipeline,
"Contracts" with vendor-set deposit %/cancellation window/overtime rate and
a no-login client e-signature, a "Clients" CRM), inspired by a Figma mockup.
Full plan: `/Users/yd/.claude/plans/delightful-leaping-starlight.md` (also
readable from this repo's working tree if that path doesn't resolve from a
future session — ask the user for it if missing).

## Current Status

**Step 0 done** (of Section 6's 9 steps, 0–8): this repo now exists as a
fork of `jorna-website` with the customer-facing marketplace/booking-request
pages removed. Steps 1–8 (all backend + the new Contracts/Clients/pipeline
frontend work) are **not started**.

## What Was Done (Step 0)

- Created via `git archive HEAD | tar -x` from `jorna-website`'s `main` tip
  into `~/Documents/GitHub/jorna/jorna-vendor` — fresh git history, no
  shared branch with `jorna-website`. `jorna-website` itself was **not
  touched** and stays live/dormant as a fallback.
- **No remote yet** — this is a local-only repo (`git init`, no
  `git remote add origin`). The user will create the GitHub repo and push
  this history + link Cloudflare Pages themselves when ready.
- Deleted `web/src/app/{marketplace,plan,bundle,bundles,book,event,events,guests,rsvp,check-in}/`
  and their e2e specs (`booking.spec.ts`, `marketplace.spec.ts`) — this app
  no longer has a self-service client booking-request flow.
- Fixed the post-login default redirect (`login/page.tsx`'s `safeNext()`,
  `lib/supabase.ts`'s `takeOAuthNext()`): was `/plan` (now deleted), now
  `/my-dashboard`. Updated `auth.spec.ts`'s matching assertion.
- Added an `allowScripts` block to `web/package.json` (was missing there,
  only on the root one) — needed for `npm install` to succeed in this
  environment's npm-scripts sandboxing. Unrelated to the product work, just
  a local tooling fix.
- **Deliberately not done** (flagged in the plan as later cleanup, not part
  of Step 0): the "host" vs "vendor" role distinction (`lib/role.ts`'s
  `loadIsVendor()`, `nav.tsx`'s `CLIENT_TABS`) is now dead/broken for any
  client-role account (every link in `CLIENT_TABS` past Home/Needs-you/
  Messages/Profile 404s, since marketplace/plan/bundle/bundles are gone) —
  unexercised by any current test, but do this cleanup properly once a
  later step touches nav/auth rather than patching it piecemeal.
- **Also flagged, not yet done**: `web/src/app/vendor/[id]`'s public listing
  page still has a "book this vendor" CTA pointing at the now-deleted
  booking flow — needs to change (contact info / Instagram link only) as
  part of whichever step first touches that page.

## Verification (Step 0)

All green in `~/Documents/GitHub/jorna/jorna-vendor`:
- `cd web && npm run typecheck` — clean.
- `cd web && npm run lint` — 0 errors, 16 pre-existing warnings (same
  `react-hooks/set-state-in-effect` class as `jorna-website`, none new).
- `cd web && npm run test` — 55/55 passed.
- `cd web && npm run test:e2e` — 21/21 passed (after the redirect-assertion
  fix above).
- `npm run build` (repo root) — production build + static export succeeded,
  27 routes (down from `jorna-website`'s ~38, matching the deletions).
- Committed as two commits: `Fork jorna-website as the starting point for
  the vendor-only rebuild` then `Strip customer-facing marketplace/
  booking-request pages`.

**Note for a fresh session**: `npm --prefix web install` fails in this
environment with an `EALLOWSCRIPTS` error even with the `allowScripts` field
present — `cd web && npm install` directly works. Plain `npm run <script>`
commands (lint/typecheck/test/build, and the husky pre-commit hook) work
fine via `--prefix web` or from root; it's specifically the dependency
*install* step that needs the `cd web` workaround.

## Remaining Work

Sections 1–8 of the plan (`/Users/yd/.claude/plans/delightful-leaping-starlight.md`),
in order:
1. Backend data model — 5 Alembic migrations in `Desiconnect/server`
   (guest fields on `Booking`, contract/signature fields, deposit
   attestation timestamps, `Vendor` contract defaults, new `Lead` table).
2. Guard audit (must land with migration `0058`, before step 3 is exposed)
   — every code path assuming a joinable client `User` needs a clean
   400/404 for a `user_id IS NULL` booking instead of crashing.
3. Guest-booking backend endpoints (vendor-authed contract creation +
   public token-authed read/fill-details/sign/payment-attestation).
4. Contracts builder UI (this repo).
5. Public signing page (this repo, clone `/rsvp/page.tsx`'s no-login shape
   — note `/rsvp` itself was deleted in Step 0, so read it from
   `jorna-website` instead, or from this repo's git history at the Step-0
   fork commit, before it was removed).
6. Deposit/final-payment self-attestation UI.
7. Pipeline kanban + stat tiles + Clients CRM + Leads CRUD (this repo).
8. Contract-defaults Settings section (this repo) — build alongside step 4.

## Notes for the Next Agent

- The backend work (steps 1–3) happens in `Desiconnect`
  (`~/Documents/GitHub/jorna/Desiconnect`), **not** in this repo — same
  backend, shared with (dormant) `jorna-website`. No staging DB there;
  every migration needs a local `alembic upgrade head` + `downgrade -1`
  round-trip before it's pushed.
- The plan's Section 3 abuse-surface discussion (public signing endpoints)
  is the single highest-uncertainty part of this whole feature — reread it
  before building those endpoints, not just before shipping them.
