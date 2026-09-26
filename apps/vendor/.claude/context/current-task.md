# Current Task

> Temporary working memory for the task in progress. Overwrite when a new
> task starts.

## Goal

Package → contract → booking overhaul, from an audit done 2026-09-23.
Phases: 0 fixes · 1 packages · 2 contracts as proposals · 3 client page ·
4 marketplace requests become proposals. Work spans this repo and the
backend (`../Desiconnect`, GitHub `jornaevents/jorna-backend`).

## Status (paused 2026-09-25 at the user's request)

- **Phase 0 — shipped.** jorna-vendor #19, jorna-backend #68. Dead client
  links → book.jornaevents.com (`lib/clientApp.ts`); contract price bug;
  client details/venue/end date on contracts; Void; lead → contract;
  vendor notified on sign/mark-paid; emails branded Jorna.
- **Phase 1 — shipped.** jorna-vendor #20, jorna-backend #69 (migration
  0063). Package status (active/hidden "Private"/archived), included
  hours, inclusions, add-ons, per-package terms, sort order; years
  experience on the vendor. See docs/DECISIONS.md (both repos, backend #14).
- **Phase 2a — PRs open, not merged (2026-09-26).** jorna-backend #70
  (migration 0064), jorna-vendor PR on branch contracts-phase2a-lifecycle.
  Contract status draft/sent/viewed/signed/declined/voided ("expired"
  derived), 7-day tentative hold (Vendor.contract_hold_days), hard block on
  sign, resend, client decline, preview link. `booking_service.
  commits_vendor_date()` is the one "takes the date" rule. Backend DECISIONS
  #15. Merge backend first (vendor UI tolerates old backend, but decline/
  send 404 until it's live).
- **Phase 2b — next.** Line items, payment schedule, clause-versioned terms,
  step builder, per-contract timeline, emailing the link on send.

## Decisions already made by the user (don't re-ask)

1. Customers booking from jornaevents.com go to book.jornaevents.com.
2. A sent-but-unsigned contract gets a **tentative hold** on the date,
   expiring (~7 days suggested, vendor-configurable); hard block on signing.
3. Accepting a marketplace request should **create a proposal/contract**.
4. **Add-ons and multi-package proposals are in v1** (Phase 2).

Open: legal review of e-sign consent/terms before Phase 3 (unanswered);
For vendors page still says "you only pay when you get booked"; chatbot
persona still says "DesiConnect".

## Phase 2 plan (contracts as proposals) — 2a items done

Backend: contract status (draft/sent/viewed/signed/declined/voided/
expired) + sent_at/viewed_at/expires_at; line items (package(s) + add-ons
snapshotted, qty, discount); payment_schedule[] replacing single deposit,
each with marked-sent/confirmed timestamps; clause-versioned terms;
tentative hold on send with expiry, hard block on sign (today contracts are
created APPROVED and block immediately); account-synced templates;
resend. Frontend: step builder (Client → Event → Items → Schedule → Terms →
Preview → Send), edit/void from /contracts, per-contract timeline. Needs a
migration — backfill existing contracts' status.

## Ops notes

- Railway's "wait for CI" gate is inconsistent: 2026-09-23 a deploy sat
  ~3h unstarted until triggered by hand; 2026-09-25 one deployed before CI
  finished. After merging backend, watch `railway deployment list
  --service Desiconnect` and probe a new endpoint on
  https://desiconnect-production.up.railway.app. User hasn't yet checked
  the dashboard setting.
- Railway CLI is logged in locally. Test migrations against a throwaway
  local Postgres 16 (`initdb` + `pg_ctl -o "-p 55432 -c
  unix_socket_directories=''"`) — scratchpad socket paths are too long.
- `npm run build` and the Playwright dev server share `.next`; `rm -rf
  web/.next` if e2e starts timing out after a build.
- Backend commit trailer per its CLAUDE.md: `Co-Authored-By: Claude Opus
  4.8 <noreply@anthropic.com>`.
- Production ALLOWED_ORIGINS no longer includes localhost (2026-09-23).
