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

Steps 0–5 of Section 6's 9 steps (0–8) are done. Backend (Sections 1/3/4 of
the plan, all in `Desiconnect`) is **fully complete**. This repo has the
Contracts builder and the public signing page, both manually verified
end-to-end in a browser against a live backend. **Not started**: step 6
(deposit UI is actually already done — see below, this was pulled forward),
step 7 (pipeline kanban + stat tiles + Clients CRM + Leads CRUD), step 8
(contract-defaults Settings section).

## What Was Done

**Step 0** — forked from `jorna-website`, stripped the customer-facing
marketplace/booking pages, fixed the post-login redirect. No remote yet
(local-only, `git init`, no `origin` — user pushes when ready to link
Cloudflare Pages). Full detail on this step was in this file's previous
version; see `git log` if needed, not repeated here.

**Backend** (`Desiconnect`, branch `feature/vendor-contracts-data-model`,
committed, **not pushed, no PR**): all of plan Sections 1/3/4 —
- 5 additive migrations: `bookings.user_id` nullable + guest contact +
  `contract_token`; contract terms (deposit %, cancellation window,
  overtime/addon rates, `contract_terms` JSON) + signature fields; a second
  deposit-specific self-attestation pair; `Vendor.default_*` contract
  defaults; new `leads` table.
- Guard audit: fixed 2 real bugs (vendor could open a message thread or
  start a negotiation on their own guest booking, crashing on a null
  user_id) — see `docs/DECISIONS.md` #13 in that repo.
- New routers: `contracts.py`/`contract_service.py` (vendor-authed: create/
  edit contract, `GET /vendors/me/clients`, Lead CRUD) and
  `guest_bookings.py`/`guest_booking_service.py` (fully public: read by
  token, fill details, sign — emails a receipt — self-report paying).
- Authenticated deposit mark/confirm pair added to `stripe_service.py`/
  `payments.py` (works for both guest and real-account bookings on the
  vendor's confirm side).
- **Also fixed**: `_booking_dict` (the general `GET /bookings/vendor/{id}`
  list vendored by dashboard/my-bookings/pipeline) didn't expose any of the
  new fields at first — only `/contracts/{id}` and `/guest-bookings/{token}`
  did. Fixed and covered by a regression test.
- 926 backend tests passing throughout; full migration chain verified
  against a real local Postgres 16 (Homebrew, not Docker — not installed
  here), upgrade **and** downgrade.

**Frontend** (this repo, committed to `main` directly — no remote, no PR
concept yet):
- `lib/types.ts` / `lib/jorna.ts`: all new types + API functions for
  Contracts, Clients, Leads, and the public guest-booking-link calls.
- `app/contracts/new/page.tsx` — vendor picks a package, sets date/time/
  price/terms, gets back a copyable `/booking-link?t=...` link.
- `app/booking-link/page.tsx` — the public, zero-login page a client opens.
  Cloned `/rsvp/page.tsx`'s shape (that file was deleted in Step 0; if you
  need to re-reference it, `git show ff1f030:web/src/app/rsvp/page.tsx`).
  Handles unsigned (fill details + terms + sign) and signed (confirmation +
  self-report deposit/full payment paid) states.
- `app/my-bookings/page.tsx` — fixed to handle a guest booking correctly:
  was showing "A client" (no `client_name`, since there's no account) and a
  "Message" button that would 400 (messaging is guest-incompatible
  server-side). Added a `clientDisplayName()` helper (falls back to
  `guest_name`), hid the Message button for `is_guest_booking`, and added a
  deposit self-attestation block (mirrors the existing full-payment one)
  with a vendor-side "I received the deposit" button.
- Verified: typecheck/lint (0 errors, same 16 pre-existing warnings)/unit
  (55)/e2e (21) all green, production build succeeds (`/booking-link` and
  `/contracts/new` both export). **Also did a full manual browser
  walkthrough**: registered a vendor, added a package, created a contract,
  opened the link in an isolated (logged-out) browser context, filled
  details, signed, marked the deposit paid as the guest, then confirmed
  receiving it from the vendor's own `/my-bookings` — the whole loop works.

## Remaining Work

Per the plan's Section 6 (steps renumbered slightly since deposit UI landed
early, folded into the Contracts builder/booking-link/my-bookings work
above rather than being its own pass):

7. **Pipeline kanban + stat tiles + Clients CRM + Leads CRUD** (this repo,
   frontend only — all backend endpoints already exist and are tested).
   - New route `app/my-pipeline/page.tsx`: derive the 5 stages (Inquiry/
     Awaiting client/Confirmed/Deposit received/Done) client-side per the
     plan's Section 2 exact derivation logic — add a `pipelineStage()`
     function to `lib/vendorPlan.ts`, plus Vitest coverage for every branch
     (this is the single most important test to get right per the plan —
     more so than e2e, since it's the source of truth for both the kanban
     and the stat tiles).
   - New route `app/my-clients/page.tsx` backed by the already-built
     `getVendorClients()`.
   - Leads CRUD UI (list/create/edit/convert) — `createLead`/`listLeads`/
     `updateLead`/`deleteLead`/`convertLead` are already in `lib/jorna.ts`;
     needs a page, probably folded into the pipeline page's "Inquiry"
     column or its own `app/my-leads/page.tsx` — not yet decided, use
     judgment or ask the user.
   - Add "Clients"/"Pipeline" (or "Contracts") entries to `VendorNav.tsx`
     and `nav.tsx`'s `VENDOR_DESKTOP_TABS` once these routes exist — not
     done yet, so none of the new pages are reachable from nav yet (only by
     typing the URL, as this session did for testing).
8. **Contract-defaults Settings section** — new
   `components/VendorContractDefaultsFields.tsx` (same shared-component
   pattern as `VendorPaymentFields`), surfaced on `/vendor-profile`, backed
   by the `default_*` fields already on `VendorDetail`/`VendorUpdateInput`
   and already returned by `GET /vendors/me`. The Contracts builder already
   reads these for pre-fill (`getMyVendor()` in `contracts/new/page.tsx`) —
   just no UI yet to *set* them, so a vendor can't actually change their
   defaults without hitting the API by hand.

## Known follow-ups, not blocking, flagged so they aren't forgotten

- `lib/role.ts`/`nav.tsx`'s `CLIENT_TABS` — the host/vendor role split is
  still dead code for any client-role account (flagged since Step 0, still
  not cleaned up). Do this once a step touches nav anyway (adding the new
  tabs above is a natural point).
- `app/vendor/[id]`'s public listing page still has a stale "book this
  vendor" CTA pointing at the deleted booking flow (flagged since Step 0).
- Pre-existing, unrelated bug noticed while testing: `GET /bookings/vendor`
  (no vendor_id) in `Desiconnect`'s `app/routers/bookings.py` is shadowed by
  the earlier-registered `GET /bookings/{booking_id}` route (Starlette
  matches route-registration order) — "vendor" gets treated as a
  `booking_id` and 404s. Dead code in practice: `listVendorBookings()` in
  this repo always calls the vendor_id-qualified form
  (`/bookings/vendor/{id}`), never the bare one. Not fixed — out of scope,
  pre-existing, harmless since nothing calls the broken path.
- Backend branch (`feature/vendor-contracts-data-model` in `Desiconnect`)
  has **not been pushed or opened as a PR** — check with the user first,
  same pattern as the `ESCROW_ENABLED` work earlier. This repo has no
  remote at all yet.

## Notes for the Next Agent

- `cd server && venv/bin/python -m X` (not `venv/bin/X` directly) in
  `Desiconnect` — the venv's script shebangs are stale from before that
  repo moved into `~/Documents/GitHub/jorna/`.
- `cd web && npm install` (not `npm --prefix web install`) in this repo —
  an environment-specific `EALLOWSCRIPTS` quirk, unrelated to the product.
- For a manual end-to-end browser check, run the backend with
  `ESCROW_ENABLED=false` and a throwaway `DATABASE_URL=sqlite:///...`, and
  the frontend with matching `NEXT_PUBLIC_API_BASE_URL` (and
  `NEXT_PUBLIC_ESCROW_ENABLED=false` if you also want the Stripe UI hidden
  — this session forgot that flag once and saw the Stripe payment-method
  picker during registration; harmless, unrelated to Contracts, but easy to
  avoid).
