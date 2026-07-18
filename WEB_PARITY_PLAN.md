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

- [ ] **A1. Book a service from a vendor profile**
  - `POST /bookings` — needs `service_id`, `event_name`, `date_iso`, `time_start`,
    `time_end`, `location`; optional `date_end`, `guest_count`, `bundle_id`.
  - Per-person/per-day services **must** capture quantity here or the booking
    can't be paid later (`price_pending_quantity`).
  - Add to a new or existing bundle; land on `/bundle?id=`.
  - Done when: browse → vendor → book → the booking appears in a bundle.

- [ ] **A2. Edit a bundle**
  - Swap a service (`/services?category=&subcategory=` for candidates),
    remove a booking (`DELETE /bundles/{id}/bookings/{booking_id}`),
    add an existing booking, rename (`PATCH /bundles/{id}`), delete.
  - Swap candidates must be filtered by **subcategory** (a DJ slot never lists dhol).

- [ ] **A3. Events**
  - `GET /events`, `POST /events`, event detail with its bundles/bookings.
  - Remember: a booking reaches its event only via its bundle.

## Phase B — make a vendor operable on the web

Today a vendor cannot function on web at all. B1–B4 are what a vendor needs to
take money; B5–B6 complete their side.

- [ ] **B1. Become a vendor / vendor profile**
  - `POST /vendors`, `GET /vendors/me`, `PATCH /vendors/me`.
  - Category + subcategory, bio, travel radius, negotiation prefs.

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
