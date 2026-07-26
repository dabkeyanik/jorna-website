# Drafts — not published

Anything here is deliberately outside `public/`, so `npm run deploy` doesn't
touch it.

## `privacy/`, `terms/`, `support/` (+ `legal/style.css`)

Drafted 2026-07-26, parked before publishing.

They're written against how Jorna actually behaves rather than from a template —
rate-and-unit pricing, the amount freezing at payment, escrow releasing only when
both sides confirm *and* the event date has passed, per-booking isolation for
refunds and disputes, the 24-hour refund window measured from payment, GPS
check-in and its attestation fallback, Stripe Connect payouts and the platform
fee. The privacy page also discloses two things a template wouldn't: precise
location is read only at the moment of check-in, and the bundle builder sends
event details (city, date, guest count, budget, style — no name, email, messages
or payment data) to a third-party language model.

### Before publishing

1. Replace every `FILL:` marker. They're highlighted in the rendered page so they
   can't be skimmed past:
   - legal entity name and registered address
   - support email — must be one that's actually monitored, since guideline 1.2
     commits to acting on reports within 24 hours
   - governing law / jurisdiction
   - effective date
   - **minimum age** — the backend currently accepts 13 (`age … ge=13`), but Jorna
     moves money through Stripe Connect and most marketplaces require 18. Choosing
     18 means a backend validation change too, and it feeds the App Store age
     rating.
2. Have a lawyer read them. Real money and escrow are involved; these are accurate
   about the product, not legal advice.
3. `git mv` the three directories and `legal/` back into `public/`.
4. Add `/privacy/`, `/terms/` and `/support/` to the seed list in
   `scripts/deploy.mjs` so a deploy that stops serving them fails.
5. Link them from the app footer (`web/src/components/SiteFooter.tsx`) and the
   marketing page footer (`public/welcome/index.html`) — guideline 1.2 wants them
   reachable from inside the app, not only from the website.
6. `npm run deploy`. It aborts while any page under `public/` still contains
   `FILL:`, so a half-finished policy can't reach production.

### Why they matter

App Store Connect won't accept a listing without a privacy policy URL and a
support URL, and guideline 1.2 wants terms with a zero-tolerance clause plus a
way to reach a human, because the app carries user content (group chat, reviews,
uploaded photos). See `APP_STORE_LAUNCH_PLAN.md` §2.5–2.6 in the iOS repo.
