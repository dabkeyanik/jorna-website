# Barebones HoneyBook parity — plan

Goal: close the gap between what jorna-vendor's seller side already does and
HoneyBook's core loop (**Inquiry → Pipeline → Proposal/Contract → Invoice/
Payment → Scheduling → Client Portal**), scoped to a *barebones* version —
not HoneyBook's AI features, workflow-automation engine, or reporting suite.

Work top to bottom within a phase; phases are ordered by (a) how load-bearing
the gap is to the loop and (b) whether it's blocked on backend work. Tick a
box only when it's built, verified against the real API, and deployed — same
convention as `WEB_PARITY_PLAN.md`.

**This repo is frontend-only** (see `CLAUDE.md`) — every claim below about
what the backend does or doesn't support is checked against the *frontend's*
typed API surface (`web/src/lib/jorna.ts`, `types.ts`), not backend source,
since `Desiconnect/server` isn't checked out here. Verify against the actual
backend before starting a phase marked **needs backend**.

---

## What HoneyBook actually is, barebones

Per HoneyBook's own product/help pages: lead-capture forms feed a
customizable **Pipeline**; a **Proposal** (service selection + pricing) and
**Contract** (e-sign) are often merged into one client-facing document; an
**Invoice** attaches a **payment schedule** (deposit + installments, by date
or milestone, sometimes client-selectable) with online payment; a
**Scheduling** link lets a client book a call against the vendor's synced
calendar; a **Client Portal** is the one no-login page a client returns to
for all of the above; thin **automations** trigger emails/reminders off form
submissions or pipeline-stage changes.

Sources: [HoneyBook proposal software](https://www.honeybook.com/product/proposal-software) ·
[Lead capture](https://www.honeybook.com/blog/honeybook-lead-capture) ·
[Automations](https://www.honeybook.com/blog/honeybook-automations) ·
[Payment plans](https://help.honeybook.com/en/articles/9247019-let-your-client-pick-their-own-payment-plan) ·
[Software Advice overview](https://www.softwareadvice.com/crm/honeybook-profile/)

---

## Already barebones-HoneyBook, verified against the code

No work needed here — listed so the phases below don't re-solve it.

- **Pipeline** — `/my-dashboard`'s kanban (`lib/vendorPlan.ts`'s
  `pipelineStage`/`pipelineStats`). Stronger than HoneyBook's own in one way:
  stage is *derived* from booking state, never a stored field a vendor has to
  drag or that can silently drift from reality.
- **Proposal + Contract, merged into one document** — `/contracts/new`
  (`createContract`, `web/src/app/(vendor)/contracts/new/page.tsx`): a
  vendor picks a package, sets price/date/terms, and gets a shareable,
  token-only link (`/booking-link?t=…`) — this **is** HoneyBook's "smart
  file" pattern, just single-package rather than multi-option.
- **Invoice-lite / deposit tracking** — `deposit_percent`,
  `deposit_amount_cents`, `deposit_marked_paid_at`,
  `deposit_confirmed_received_at` on `VendorBooking`; a self-attested
  Venmo/Zelle "I sent it" / "I received it" exchange on both `/booking-link`
  (guest side, `guestMarkDepositPaid`/`guestMarkFullPaid`) and
  `/my-bookings` (vendor side, `confirmDepositReceived`/
  `confirmPaymentReceived`).
- **Contract defaults** — `VendorContractDefaultsFields`
  (`components/VendorProfileFields.tsx`): deposit %, cancellation window,
  overtime rate, equipment/travel text, guest-count mode. One reusable
  default per vendor, seeded into every new contract.

---

## Phase 1 — frontend-only, no backend change

### 1.1 Named contract templates (local)

**Built** (2026-09-22, not yet merged): `web/src/lib/contractTemplates.ts`,
wired into `(vendor)/contracts/new/` (load/save) and `(vendor)/vendor-profile/`
(list/delete). Verified against lint/typecheck/vitest/e2e — see
`web/e2e/vendor-contract-templates.spec.ts`. Treat what follows as the
rationale for what was built, not a to-do list.

**The gap:** `default_*` on `VendorDetail` is exactly *one* reusable preset.
A vendor selling three different service types (say, a DJ set vs. a full
sangeet package) currently re-types deposit/cancellation/overtime terms for
whichever one doesn't match their single stored default.

**The barebones cut:** store multiple *named* templates
(`{ name, depositPercent, cancellationWindowHours, overtimeRate,
equipmentPower, travel, guestCountMode }`) in `localStorage`, not synced to
the account. This is a real, disclosed limitation vs. HoneyBook (templates
don't follow the vendor to another device) — worth it because it needs zero
backend work and covers the common case (one vendor, one browser, one
laptop they always quote from).

- Add a template picker to `/contracts/new`, above the package select:
  "Load template →" populates the deposit/cancellation/overtime/equipment/
  travel fields from a saved template; "Save as template" stores the
  current values under a name.
- Manage (rename/delete) templates from `/vendor-profile`'s existing
  "Contract defaults" card — the vendor's current single default becomes,
  in effect, template zero / the one auto-applied on a new contract.

### 1.2 Public availability on the vendor's listing — dropped, not viable yet

**Correction after reading the actual data flow** (this section originally
proposed a read-only calendar widget on `/vendor` — struck out below rather
than deleted, so the reasoning stays on record):

`getVendorAvailability(vendorId, start, end)` is public, but
`lib/availability.ts`'s own comment says the backend currently returns it
**empty for every vendor** (`{ baseline_hours_map: {}, internal_busy_times:
[], google_busy_times: [] }`) — the shape is even inferred, not observed,
because the backend's OpenAPI schema for it is untyped. And `/my-calendar`'s
real day-by-day status (`calendarMonth`/`dayStatus`) is derived from the
vendor's own `bookings` (`listVendorBookings`) — private data (client
names), not from this public endpoint at all; `getVendorAvailability` only
feeds the Google-busy overlay there. There is no public endpoint for a
vendor's *baseline weekly hours* either — `getMyAvailability()` is
`/vendors/me/availability`, owner-only.

Net: there is currently no real signal to show a client. Building this now
would render an empty widget on every vendor's profile — exactly the
"invented number" `VENDOR_DASHBOARD_BRIEF.md` says not to design for.
**Moved to the backend-asks section as a prerequisite**, not built in Phase
1. See 2.2 below, which already depended on real availability data anyway.

---

## Phase 2 — backend asks that unlock the rest

Three gaps below all bottom out on the same missing primitive: **every
write endpoint in this API requires an authenticated session, except the
`contract_token`-scoped `/guest-bookings/*` routes** (`lib/jorna.ts` line
~856: *"None of these go through the normal Authorization-bearer path —
there's no session to attach. The `contract_token` in the URL is the entire
credential, same trust model as the RSVP system's invitation token."*).
HoneyBook's whole front door — a stranger who has never heard of the
product submitting a form — needs exactly that same shape of endpoint, and
none exists for "a stranger contacts a vendor directly."

Recommend asking for **one new endpoint that covers two features at once**,
rather than three separate asks:

> **`POST /vendors/{vendor_id}/public-inquiries`** (unauthenticated) — body
> `{ name, phone?, email?, event_date_iso?, note?, requested_slot_iso? }` →
> creates a `Lead` scoped to that vendor (same shape `POST /leads` already
> creates, minus the vendor-auth requirement). `requested_slot_iso` is
> optional and is what Phase 2.2 (scheduling) needs on top of Phase 2.1
> (plain inquiry) — same endpoint, one more optional field, not a second
> endpoint.

### 2.1 Public inquiry / lead-capture link — needs backend (above)

Once the endpoint exists:

- New public page `/inquiry?v=<vendor_id>` (same "no account, just this
  page" shape as `/booking-link`): name/phone/email/event date/note →
  `POST /vendors/{id}/public-inquiries` → confirmation screen.
- Vendor's `/vendor-profile` gains a "Copy your inquiry link" action next to
  the existing "See what clients see" link, so it's discoverable the same
  way the contract link already is on `/contracts/new`.
- No pipeline change needed — the created Lead lands in `/my-dashboard`'s
  Inquiry column exactly like a manually-entered one (`LeadsPanel` already
  handles this data shape; nothing to build there).

### 2.2 Self-service scheduling — needs backend (2.1's endpoint + real availability data)

Blocked on two things landing, not one: 2.1's endpoint accepting
`requested_slot_iso`, **and** `GET /vendors/{id}/availability` actually
returning populated `baseline_hours_map`/busy-times data (see 1.2's
correction above — it's public today but empty in practice). Ask for both
in the same backend conversation; building the picker against a
still-empty endpoint would repeat 1.2's mistake.

Once both are real:

- A picker on `/vendor` (the widget originally proposed as 1.2, now
  buildable for real): click an open day → pick a time within the vendor's
  `baseline_hours_map` for that day → submit through the same
  public-inquiries form, pre-filled with `requested_slot_iso`.
- This is a **request**, not a confirmed booking — same trust level as an
  inquiry. A vendor still turns it into a real Contract from `/contracts/new`
  once they've actually agreed to the call/date. (HoneyBook's own scheduler
  auto-confirms; matching that exactly would need a second endpoint to
  block the slot atomically, which is more machinery than "barebones"
  needs — flag as a fast-follow once the base loop ships, not part of this
  phase.)

### 2.3 Guest messaging on `/booking-link` — needs backend

**The gap:** `MessageVendorButton`/`openBookingThread` go through the normal
bearer-auth path (`lib/jorna.ts` line ~646) — a guest on `/booking-link` can
fill in details, sign, and self-report payment, but can't ask "can we move
the start time 30 minutes?" without an account. This is the one place the
existing guest flow is more restrictive than HoneyBook's client portal.

**The ask:** a `contract_token`-scoped message endpoint mirroring the
`/guest-bookings/*` pattern — e.g. `POST /guest-bookings/{token}/messages` /
`GET /guest-bookings/{token}/messages` — rather than extending the normal
1:1 thread system's auth model, to keep the guest trust boundary exactly
where it already is for every other guest action.

Once it exists: add a simple threaded message box to `/booking-link`,
visually consistent with the existing conversation UI
(`components/AskVendor.tsx`) but reading/writing through the new
token-scoped calls instead of `openBookingThread`.

### 2.4 Payment installments — needs backend, biggest lift

**The gap:** a booking has exactly one deposit and one implicit "the rest."
HoneyBook's core invoicing value-add is a **payment schedule** — N
installments by date or milestone, optionally client-selectable.

**The ask:** replace (or add alongside) `deposit_percent` a
`payment_schedule: { label, due_date_iso, amount_cents }[]` on Contract/
VendorBooking, with per-installment `marked_paid_at`/`confirmed_received_at`
timestamps (same self-attestation shape the deposit fields already use, just
repeated N times instead of once).

Frontend work once it lands:

- `/contracts/new` — replace the single "Deposit (%)" field with a schedule
  builder (N rows of label/due-date/amount, defaulting to "50% now / 50% at
  event" so the common case is still one click).
- `/booking-link` — a payment-schedule table instead of the current
  single deposit/full-payment block, each row getting its own "I sent it"
  action once its turn comes.
- `/my-bookings` — the vendor's own confirm-received actions, one per
  installment, replacing the current single deposit/full-payment block.
- `/my-dashboard`'s "Deposits still owed" stat tile generalizes to "Payments
  owed" summed across all outstanding installments, not just deposits.

---

## Explicitly not in scope for barebones

Matching `VENDOR_DASHBOARD_BRIEF.md`'s convention of naming what's
deliberately excluded, not just what's included:

- **AI features** (email drafts, project summaries, meeting notes,
  trend analysis) — a 2026 HoneyBook add-on, not core to the loop.
- **A workflow-automation engine** (arbitrary trigger → multi-step email
  sequences). Sending an email at all needs backend/email infra this repo
  doesn't own; a full automation *builder* is well beyond barebones.
- **Automated payment reminders / late fees** — same email-infra blocker as
  above. The nearest barebones equivalent that's already true today: the
  Dashboard's "Deposits still owed" / "Needs you" surfacing already makes an
  overdue payment visible to the *vendor*; reminding the *client*
  automatically is out of scope here.
- **Account-synced templates, multiple team members/roles, custom pipeline
  stages** — all real HoneyBook features, all bigger asks than a single
  vendor's browser-local templates and a fixed 5-stage pipeline.
- **Reporting/analytics beyond the existing stat tiles** — `/my-dashboard`
  and `/my-earnings` already surface the numbers the API can actually
  supply; see `VENDOR_DASHBOARD_BRIEF.md`'s "What the API cannot give you"
  for the ones it can't (views, search rank, conversion funnels — none of
  that changes here).

---

## Suggested execution order

1. Ship Phase 1 (1.1 only, now — 1.2 was struck out, see above) — no
   blockers, real value, a small diff.
2. Open one `jorna-backend` issue for the Phase 2 endpoint (`POST
   /vendors/{vendor_id}/public-inquiries`) covering 2.1 and 2.2 together,
   and a second for 2.3's guest-messaging endpoint — both scoped narrowly
   enough to land independently of 2.4.
3. Build 2.1 and 2.2's frontend the moment the endpoint lands; they share
   one page and one form.
4. Treat 2.4 (payment installments) as its own project once 1–3 are live —
   it's the biggest schema change and touches the most existing pages
   (`/contracts/new`, `/booking-link`, `/my-bookings`, `/my-dashboard`).
