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

**All 9 steps (0–8) of Section 6 are done.** Backend (`Desiconnect`,
Sections 1/3/4) and frontend (this repo, Sections 0/2/5) are both complete
and manually verified end-to-end in a browser, including the full pipeline/
Clients/Leads/Settings surface added in this session. Nothing in the plan
is left unbuilt. Remaining items are all "check with the user before doing
X" (pushing branches, opening PRs, committing this session's uncommitted
work) — see "Remaining Work" below.

## What Was Done

**Steps 0–6** (fork, backend data model/endpoints/guard-audit, Contracts
builder, public signing page, deposit-attestation UI) — see `git log` for
detail; summarized in this file's previous version if needed.

**Step 7 — Pipeline kanban + stat tiles + Clients CRM + Leads CRUD** (this
session):
- `lib/vendorPlan.ts`: added `pipelineStage(b): PipelineStage` (5 stages:
  inquiry/awaiting_client/confirmed/deposit_received/done, derived from
  already-fetched booking fields — no new stored field) and
  `pipelineStats(bookings): PipelineStats` (4 stat-tile reducers). 13 new
  Vitest cases in `vendorPlan.test.ts` covering every branch, including
  ordinary (non-contract) marketplace-style bookings alongside guest/
  contract ones, and the "no date-based auto-advance to Done" decision.
- `app/my-pipeline/page.tsx` (new): kanban with the 5 stages, leads shown
  read-only in the Inquiry column, 4 stat tiles.
- `app/my-clients/page.tsx` (new): CRM list backed by `GET /vendors/me/clients`.
- `app/my-leads/page.tsx` (new): Lead CRUD (create/status-change/delete/
  convert-to-contract link).

**Step 8 — Contract-defaults Settings**:
- `components/VendorProfileFields.tsx`: added `VendorContractDefaultsFields`
  + `contractDefaultsToStrings()` helper.
- `app/vendor-profile/page.tsx`: new "Contract defaults" card, wired to
  `updateMyVendor()`.

**Nav wiring** (this session, last piece of the plan):
- `components/nav.tsx`: added Pipeline/Clients/Leads to
  `VENDOR_DESKTOP_TABS` (new icons: `I.pipeline`/`I.clients`/`I.leads`), and
  to `VENDOR_TABS`'s Dashboard-tab `match` array (mobile hamburger keeps one
  compact Dashboard entry, not one per page).
- `components/VendorNav.tsx`: added Pipeline/Clients/Leads to the mobile
  pill-row `TABS` array.
- **Also did the flagged "clean up once nav is touched anyway" item**:
  `CLIENT_TABS` (renamed `NO_VENDOR_TABS`) was pointing a signed-in,
  not-yet-a-vendor user at `/plan`, `/marketplace`, `/bundles` — all deleted
  in this repo's Step 0 fork. Replaced with `/home` + a "Get started" link
  to `/vendor-onboarding`. Updated `e2e/vendor-onboarding.spec.ts` (asserted
  the old "Builder" label) to match.
- **Did not** touch `app/vendor/[id]`'s (`app/vendor/page.tsx`) stale "Book
  this"/`/plan`/`/marketplace` links — bigger than a nav-adjacent fix (touches
  the `AskVendor` request/negotiation flow too); still flagged below.

**Bug found + fixed via manual browser testing this session**: the new
Contract-defaults settings UI reported "Saved" but values never came back on
reload. Root cause was in `Desiconnect` (backend), not here — see that
repo's `current-task.md` for detail (three independent layers all missing
`Vendor.default_*`: request schema, service-layer write allowlist, response
dict). Fixed there; re-verified here that `/vendor-profile` → save → reload
→ `/contracts/new` pre-fill all round-trip correctly now.

**Verification** (after all of the above): typecheck/lint (0 errors, same
pre-existing `set-state-in-effect` warnings)/unit (68 passed)/e2e (21
passed)/production build all green. Full manual browser walkthrough of the
new surface: created a contract, signed it as a guest (isolated logged-out
context), marked+confirmed the deposit, watched it move
Awaiting-client → Deposit-received on `/my-pipeline`, appeared correctly on
`/my-clients` (grouped as "Direct"/guest), created and viewed a Lead on
`/my-leads` and in the Pipeline's Inquiry column, and set+confirmed Contract
defaults on `/vendor-profile`.

## Remaining Work

Nothing left in the plan's scope. Only user-gated follow-ups:
- This repo has **no remote yet** — user creates it and links Cloudflare
  Pages themselves (per their own explicit instruction earlier in the
  project).
- `Desiconnect`'s `feature/vendor-contracts-data-model` branch is
  **uncommitted** (the `default_*` bug fix) on top of **not pushed, no PR**
  — check with the user before either.
- This repo's own nav-wiring + `NO_VENDOR_TABS` cleanup commit(s) from this
  session are also **not yet committed** — check with the user first.

## Known follow-ups, not blocking, flagged so they aren't forgotten

- `app/vendor/[id]`'s (`app/vendor/page.tsx`) public listing page still has
  a stale "Book this" CTA → `/book?service=`, plus "Back to marketplace" /
  "Build my bundle" links → `/marketplace` / `/plan`, all deleted in Step 0.
  Bigger than a nav fix: also touches the `AskVendor` inbound-request/
  negotiation flow, which may or may not still make sense to keep in a
  vendor-only, contract-first app. Needs a real decision, not a quick patch.
- Pre-existing, unrelated bug noticed while testing: `GET /bookings/vendor`
  (no vendor_id) in `Desiconnect`'s `app/routers/bookings.py` is shadowed by
  the earlier-registered `GET /bookings/{booking_id}` route (Starlette
  matches route-registration order) — "vendor" gets treated as a
  `booking_id` and 404s. Dead code in practice: `listVendorBookings()` in
  this repo always calls the vendor_id-qualified form
  (`/bookings/vendor/{id}`), never the bare one. Not fixed — out of scope,
  pre-existing, harmless since nothing calls the broken path.

## Notes for the Next Agent

- `cd server && venv/bin/python -m X` (not `venv/bin/X` directly) in
  `Desiconnect` — the venv's script shebangs are stale from before that
  repo moved into `~/Documents/GitHub/jorna/`.
- `cd web && npm install` (not `npm --prefix web install`) in this repo —
  an environment-specific `EALLOWSCRIPTS` quirk, unrelated to the product.
- For a manual end-to-end browser check: run the backend with
  `ESCROW_ENABLED=false`, a throwaway `DATABASE_URL=sqlite:////tmp/....db`
  (sqlite triggers `Base.metadata.create_all` in `main.py` on boot — no
  Alembic needed for a throwaway DB; Alembic itself doesn't support SQLite's
  ALTER-constraint migrations anyway), and
  `ALLOWED_ORIGINS=http://localhost:<port>` (CORS blocks the browser
  otherwise — the default is empty). Run the frontend with matching
  `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_ESCROW_ENABLED=false`. **Use
  the same hostname (`localhost` or `127.0.0.1`, not a mix)** for the
  frontend dev server, the browser URL, and `ALLOWED_ORIGINS` — Next dev's
  `allowedDevOrigins` cross-origin guard silently blocks JS chunk requests
  otherwise, which hangs every page on "Loading…" with no useful error
  (this cost real time this session — mismatched `127.0.0.1` vs `localhost`
  across the three). To get a session without going through the real
  registration form (which needs a resolved city autocomplete pick), `curl
  POST /auth/register` + `/auth/login` directly, then
  `localStorage.setItem("jorna_access"/"jorna_refresh", ...)` in the browser
  — mirrors `e2e/support/fixtures.ts`'s `loginAs()`.
