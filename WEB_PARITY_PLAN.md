# Web app parity plan

Goal: bring the web app (`web/`, served at `jornaevents.com/app`) to functional
parity with the native iOS app, against the same FastAPI backend.

Work top to bottom. Tick a box only when the step is **built, verified against
the real backend, and deployed**. Keep steps small enough to ship individually —
each one should leave the app in a working state.

---

## Done

- [x] Design system, auth (email/password), typed API client with token refresh
- [x] AI bundle builder (`/plan`) — one-shot form → 3 comparison bundles
- [x] Browse + filters (`/browse`), vendor profiles (`/vendor?id=`)
- [x] Bundles list (`/bundles`), bundle detail (`/bundle?id=`)
- [x] Stripe hosted checkout + return/reconcile (`/payment-complete`)
- [x] Escrow release — confirm, refund, dispute
- [x] Navigation back to the marketing site

---

## Phase A — close the client transaction loop

The most visible gap: you can browse and find a vendor, but you can't book them.

- [x] **A1. Book a service from a vendor profile** — `/book?service=`
  - "Book this" on each service → a request form → `POST /bookings` → `/bundle?id=`.
  - Guest count is **required** for per-person services (otherwise the total can
    never resolve and checkout would refuse). Multi-day toggle sets `date_end`.
  - Shows a live estimated total using the backend's own arithmetic
    (rate × quantity; per-day counts the end date inclusively, per-hour handles
    a window crossing midnight). Verified against `estimate_amount_cents`.
  - A venue service prefills its address and passes its map pin, so the event is
    anchored for check-in.
  - Adds to a new bundle or an existing one.

- [x] **A2. Edit a bundle**
  - Swap a service, remove a booking, rename, delete — all on `/bundle?id=`.
  - There is no swap endpoint: a swap is "book the replacement into the same
    slot, then remove the original". Candidates are narrowed by **subcategory**
    so a DJ slot never lists dhol.
  - The quantity (`guest_count`, `date_end`) is carried across, or the
    replacement lands unpayable. Needed a backend change to expose those on the
    bundle summary — the iOS swap drops them and has this bug.
  - `POST /bookings` is idempotent, so re-booking the slot returns the *same*
    booking; removing the "old" one would then delete it. Guarded by comparing
    the returned `booking_id`.
  - Editing is hidden once money has moved (`payment_confirmed`, or paid /
    released / refunded / disputed), mirroring the iOS rule.

- [x] **A3. Events** — `/events` and `/event?id=`
  - List + inline create; detail shows the event's bundles and their bookings,
    with a running total. Delete makes clear the bundles survive.
  - There is **no `GET /events/{id}`** — the list is the source of detail.
  - A booking has no `event_id`, so the event's vendors are assembled by matching
    **bundles** on `event_id` (iOS additionally falls back to matching the event
    *name*, which would wrongly merge two events sharing a name — not copied).

## Phase B — make a vendor operable on the web

Today a vendor cannot function on web at all. B1–B4 are what a vendor needs to
take money; B5–B6 complete their side.

- [x] **B1. Become a vendor / vendor profile** — `/vendor-profile`
  - Create or edit: category, speciality, bio, travel radius, long-distance and
    price-negotiation preferences, Instagram.
  - Options come from `GET /vendors/categories`, added for this step. The
    taxonomy is validated server-side, so a hardcoded copy that drifts produces
    400s the user can't act on. Changing category clears the speciality rather
    than sending a stale pair.

- [ ] **B2. Services CRUD**
  - `POST/PATCH/DELETE /services`, `GET /services?vendor_id=`.
  - Rate + unit (hour/day/event/person), `negotiable` toggle.
  - Venue services require location + map coords.
  - Image upload is **multipart** — the API client is JSON-only today and needs extending.

- [ ] **B3. Booking requests (approve / decline)**
  - `GET /bookings/vendor/{vendor_id}`, `PUT /bookings/{id}/status`.
  - Handle the **409 date-conflict** case (a vendor can't take two events on one day).

- [ ] **B4. Stripe onboarding + earnings**
  - `POST /payments/vendors/{id}/stripe-onboard` (hosted redirect),
    `GET /payments/vendors/{id}/stripe-status`, `GET /payments/vendors/{id}/earnings`.
  - Clients can't pay a vendor who hasn't onboarded — surface that clearly.

- [ ] **B5. Vendor confirm + check-in**
  - `POST /payments/bookings/{id}/confirm`; GPS check-in via browser geolocation
    where the event has venue coords, plain confirm where it doesn't.

- [ ] **B6. Calendar & availability**
  - `GET/PUT /vendors/me/availability`, `GET /vendors/{id}/availability`,
    Google Calendar connect.

## Phase C — communication & trust

- [ ] **C1. Group chat** — `GET /conversations`, messages (newest window first),
      live updates over the `/conversations/ws/{id}` WebSocket.
- [ ] **C2. Negotiation** — open/counter/accept; only on `negotiable` services.
- [ ] **C3. Leave a review** — `POST /reviews` after a completed booking.
- [ ] **C4. Report & block** — `Moderation` endpoints; hide blocked users.

## Phase D — account completeness

- [ ] **D1. Profile management** — edit email/phone/username/password, avatar upload.
- [ ] **D2. Password reset** — request + confirm.
- [ ] **D3. Google OAuth** — Supabase sign-in → `POST /auth/google/lookup` exchange.

## Phase E — platform differences

These can't be a straight port; decide per item rather than assuming parity.

- [ ] **E1. Client GPS check-in** — browser geolocation is permission-gated and
      less accurate than native. Ship it, but expect different fidelity.
- [ ] **E2. Push notifications** — iOS uses FCM native push. The web equivalent
      (service worker + VAPID) is **new backend work**, not a port. Likely an
      in-app notification list first; true web push is a separate decision.

---

## Working rules

- Mirror the backend's guards in the UI — never offer an action that must fail
  (see the Pay button and escrow actions for the pattern).
- Never show a rate as if it were a total; carry `price_unit` through.
- Verify against the real backend before ticking a box; `npm run deploy` publishes
  the marketing page and the app together.
- **Give a deploy ~30–60s before verifying, then curl the routes.** Checking
  immediately after "Deployed" has twice shown 404s that resolved on their own —
  the second time, the "fix" was a redeploy that uploaded *nothing*
  ("No updated asset files to upload"), which proves the assets were already
  there and only propagation was outstanding. So a 404 straight after deploy
  means *wait and re-check*, not *redeploy*. Still always check:

  ```bash
  for p in / /app/ /app/browse/ /app/book/ /app/plan/ /app/bundles/; do
    echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' -L https://jornaevents.com$p)"
  done
  ```

- Client-rendered pages ship a Suspense fallback in their static HTML, so
  grepping the deployed HTML for page copy proves nothing — check the status
  code and that the JS bundle is referenced.
