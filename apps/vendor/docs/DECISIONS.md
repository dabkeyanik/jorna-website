# Architectural Decisions

Lightweight log of decisions discovered in the code and existing docs (commit
history, code comments, `DEPLOY.md`, `README.md`). Not all of these are
formal ADRs — some are conventions inferred from consistent code comments.
Where the rationale isn't evidenced anywhere, that's stated explicitly rather
than guessed.

## Decision: Cloudflare Pages instead of Workers Static Assets

### Context
The site was originally deployed as a Cloudflare Worker using Static Assets.

### Decision
Migrated to a Cloudflare Pages project (`jorna-vendor`) serving `public/`.
The old Worker (`misty-water-0dbb`) has been deleted.

### Consequences
Deploy tooling (`scripts/deploy.mjs`, `npm run deploy`) targets `wrangler
pages deploy`, not `wrangler deploy`. `wrangler.jsonc` config is now minimal
(`pages_build_output_dir`).

**Why:** Workers Static Assets' many-file asset serving intermittently
dropped every `/app` route (the marketing page kept working, the app 404'd)
even after a deploy reported success. Documented in `DEPLOY.md` and
`wrangler.jsonc` comments.

---

## Decision: self-verifying deploy script

### Context
`wrangler`'s incremental asset upload has, in practice, silently dropped
files while still printing a "Deployed" success line — leaving production
partially broken with no error signal.

### Decision
`npm run deploy` (→ `scripts/deploy.mjs`) builds once, deploys, then actually
fetches every route on the live domain and re-deploys until all routes serve
200 across three consecutive sweeps. `npm run deploy:once` remains available
as the unverified single-shot for when that's specifically wanted.

### Consequences
A bare `wrangler deploy`/`wrangler pages deploy` should not be used for
routine deploys — it skips this verification. See `docs/MODULE_MAP.md`
"Build & deploy tooling."

---

## Decision: web app is a fully client-rendered static export, not SSR

### Context
The web app (`web/`) needs to call an external FastAPI backend for all data;
there is no backend logic that needs to run in this repo.

### Decision
Next.js is configured with `output: "export"` and `basePath: "/app"`
(`web/next.config.ts`). Every page is a client component; the export is
static HTML/JS served by Cloudflare Pages alongside the marketing page — no
Next.js server runs anywhere.

### Consequences
- No server components with real server-side data fetching are possible;
  data fetching happens in the browser via `web/src/lib/jorna.ts`.
- Served HTML for `/app/*` routes carries no UI copy (it's behind
  `<Suspense>`) — don't try to verify content by grepping fetched HTML; see
  `DEPLOY.md`.
- Deploying requires copying the export into `public/app/` first
  (`web/scripts/export-to-public.mjs`), which is why `public/app/` is
  generated + gitignored rather than committed.

---

## Decision: the site root permanently serves the app's Home route; the legacy static page is retired

### Context
Originally, `public/index.html` was a hand-written marketing page served at
`/`, separate from the Next app under `/app`.

### Decision
As of commit `58ce333` (2026-07-31), `public/_redirects` rewrites `/` to
`/app/` (HTTP 200 rewrite, not a redirect), which renders
`web/src/app/page.tsx` → the app's own `home/page.tsx`. `public/index.html`
itself was deleted in that same commit — confirmed as of 2026-08-22 it is
not on disk and not in `git ls-files`, and this is a permanent decision, not
an interim state: the app's Home page is the site's front door going
forward, with no plan to restore the standalone file.

### Consequences
`README.md` and `docs/ARCHITECTURE.md`/`docs/MODULE_MAP.md` were corrected
(2026-08-22) to stop describing `public/index.html` as present-but-
unreachable — several revisions after the file was actually deleted had
still described it that way, which is itself a caution: re-verify this kind
of claim against `git ls-files`/`ls public/`, not just against the last doc
that mentioned it. The "design tokens duplicated by hand" tradeoff described
elsewhere in this file no longer applies for the marketing page specifically
— `web/src/app/globals.css` is now the only place brand tokens live.
`public/help/index.html` is the one remaining hand-written, no-build-step
static file. See "Root routing" in `docs/ARCHITECTURE.md`.

---

## Decision: two auth paths — direct password auth vs. Supabase-mediated OAuth

### Context
The product needs both simple email/password accounts and "Sign in with
Google."

### Decision
Password auth talks directly to the backend, which issues Jorna's own JWTs.
Google OAuth is handled by Supabase purely as an identity provider; the
resulting Supabase token is exchanged for a Jorna session
(`adoptSession`/`/auth/callback`). Supabase never becomes the source of
truth for sessions.

### Consequences
Two different token systems exist in the codebase (Supabase's and Jorna's)
but only Jorna's is used past the callback step. See `docs/API.md`.

---

## Decision: centralized "what's outstanding" task rules

### Context
Multiple surfaces (client dashboard, vendor dashboard, the tab-bar attention
badge) need to agree on what a user still needs to do. An early version had
a task kind ("vendor-reply") that wasn't actually actionable, which made a
"6 things need you" list contain things the user couldn't act on.

### Decision
`web/src/lib/planning.ts` (client) and `web/src/lib/vendorPlan.ts` (vendor)
are the single source of truth for task/attention rules. `lib/attention.ts`
(the badge) and the dashboard pages both read from these rather than
re-deriving their own logic. Every rule is written to mirror an actual
backend guard.

### Consequences
Changing what counts as "needs attention" means changing these two files —
adding parallel logic elsewhere will cause the badge and the dashboard to
disagree, which is the exact bug this convention exists to prevent.

---

## Decision (superseded 2026-08-22): marketing design tokens duplicated rather than shared

### Context
The marketing page (`public/index.html`) was deliberately kept as a
build-step-free static file, but the app (`web/`) uses Tailwind v4 and needed
the same palette.

### Decision
The same color/font tokens were defined twice: inline in `public/index.html`
and as Tailwind `@theme` variables in `web/src/app/globals.css`, kept in sync
by hand rather than by a shared source file.

### Consequences
**Superseded**: `public/index.html` was deleted in commit `58ce333`
(2026-07-31; see the root-routing decision above) and the app's Home page is
now the permanent site root. `web/src/app/globals.css` is the sole source of
brand tokens — there is nothing left to hand-sync. `DESIGN_BRIEF.md` still
lists the full token set as a readable reference; verify against
`globals.css` if a color looks off, same as before.

---

## Decision: Figma Make exports are not committed

### Context
Some UI (e.g. the marketing Home screen, the vendor dashboard) was designed
via Figma Make, which exports a full standalone Vite app (`*.make` files,
~1.4 MB each, containing a git repo in packfiles).

### Decision
`*.make` files are gitignored. What matters from them is ported by hand into
`web/src/app` / `web/src/components`; the raw exports are kept locally only,
to be unzipped and re-read as needed.

### Consequences
There's no in-repo record of the original Figma Make output — only the
ported result and whatever the `.make` file holder still has on disk. If you
need to re-derive a screen from a Make export, check with whoever has the
local file; it will not be in `git log`.

---

## Decision: Escrow disabled for the MVP via an ESCROW_ENABLED flag

### Context
The MVP cuts Jorna down to a leaner product: vendors get paid off-platform
via a Venmo handle and/or Zelle contact on their profile, not through Stripe
checkout/escrow. The manual Venmo/Zelle track already existed in the backend
and this repo as an opt-in alternative to Stripe (`payment_method: "stripe" |
"manual"` on `VendorDetail`/bookings), so this wasn't new payment
infrastructure — it was making that existing alternative the only one shown,
without ripping out the Stripe code paths in case escrow comes back later.

### Decision
`web/src/lib/flags.ts` exports `ESCROW_ENABLED` (from
`NEXT_PUBLIC_ESCROW_ENABLED`, defaults `true`), mirroring the backend's flag
of the same name (`Desiconnect/server/app/config.py`). With it `false`:

- `VendorPaymentFields` (`components/VendorProfileFields.tsx`) renders only
  the Venmo/Zelle inputs — no Stripe/manual radio choice.
- The Stripe-onboarding banner on `/vendor` and the Stripe readiness gate/CTA
  on `/my-earnings` don't render; `getStripeStatus()` isn't even fetched
  (`/my-earnings`, `/my-dashboard`), so `vendorTasks()` never emits a
  `"stripe"` task (it already treats a `null` status as "nothing to check").
  `/my-earnings` gained a standing "Payment details" card using the shared
  `VendorPaymentFields` component instead of its own duplicate Venmo/Zelle
  form — consolidating what used to be two separate implementations of the
  same fields (this page and `/vendor-profile`).
- `/vendor-onboarding`'s "reach" step (step 2 of 3) also collects Venmo/Zelle
  and won't advance without at least one — there was previously no point in
  the wizard that asked for payment info at all, since Stripe onboarding
  happened later, out-of-band, on `/my-earnings`.

Nothing was deleted: the Stripe checkout branch in `/bundle`, the Connect
onboarding pages (`/vendor/stripe-onboard/*`), `/payment-complete`,
`/card-saved` are all left as unreachable dead routes/branches once the
backend's own flag forces every booking's `payment_method` to `"manual"` —
see the backend's `docs/DECISIONS.md` #12 for that half of the mechanism.

### Consequences
Flipping `NEXT_PUBLIC_ESCROW_ENABLED` back to `true` (the default) and
rebuilding restores the Stripe UI exactly as it was — no code revert needed.
A vendor row saved while the flag was off always has `payment_method:
"manual"` with at least one contact method; nothing here retroactively edits
a vendor who already had `payment_method: "stripe"` on file, since the
backend's booking-time override is what actually keeps new bookings off
Stripe regardless of what a vendor's profile still says.

---

## Decision: persistent vendor sidebar, replacing the shared header nav for most seller pages

### Context
The vendor side of the app (pipeline, bookings, contracts, listing) used to
share `SiteHeader`'s top nav and `VendorNav`'s phone pill-strip with the
client-facing marketing/marketplace pages — the same chrome for two very
different products. `my-dashboard/page.tsx` had an explicit note from its own
2026-07-27 port explaining why a left sidebar from that Figma design was
*not* carried over: "the app has a header nav and a phone tab bar already,
and a third shell would make the vendor side feel like a different product."

A second Figma Make prototype ("sprint-center", 2026-09-22) made the case the
other way: a persistent sidebar (Dashboard/Bookings/Contracts/Clients/
Settings) that makes the vendor dashboard the app's primary surface for a
vendor, not one destination in a nav shared with the marketing site.

### Decision
Reversed the 2026-07-27 call. `VendorSidebar` (`web/src/components/
VendorSidebar.tsx`) now wraps five vendor routes via a route group
(`web/src/app/(vendor)/layout.tsx`): `/my-dashboard`, `/my-bookings`,
`/contracts/new`, `/clients` (new), `/vendor-profile`. `ChromeGate`
(`web/src/components/ChromeGate.tsx`) hides `SiteHeader`/`SiteFooter` on
those routes by pathname — the one conditional-chrome check in the app.
`/my-pipeline` (the kanban board + Leads/Clients tabs) was folded into
`/my-dashboard`; Clients was promoted to its own route; Leads stayed a
`?view=leads` tab on Dashboard (no sidebar slot for it in the new design).
`/my-calendar` and `/my-earnings` are **not** in the sidebar (only 5 items in
the design) and keep using the old header nav + `VendorNav`.

The marketing Home page at `/` is unchanged — this is a rebuild of the
signed-in vendor experience, not a reversal of the separate "root is the
marketing Home" decision above.

The sidebar also introduces the app's first manual light/dark toggle
(`web/src/lib/theme.ts`) — `globals.css`'s `data-theme` mechanism existed
already but nothing before this ever set it; the app only ever followed
`prefers-color-scheme`.

### Consequences
A vendor now has two different navigation chromes depending on which page
they're on (sidebar on the five shell routes, shared header everywhere else,
including Calendar/Earnings and any client-facing page they visit). This is
a deliberate, disclosed tradeoff, not an oversight — moving Calendar/Earnings
into the sidebar too, or giving the whole app one nav system, is future work
if the sidebar's scope grows past its initial five destinations.

---

## Decision: Home trimmed to a landing page; How it works / For clients / For vendors split into their own pages

### Context
Home was one long scroll: hero, a 3-step "How it works" section, an
illustrative bundle showcase, a live vendor showcase, a "For vendors" pitch
card, an escrow/trust section, an FAQ, and a closing CTA. SiteHeader's
signed-out nav linked into two of these as `#how`/`#vendors` anchors. There
was no dedicated "for clients" case being made anywhere — most of Home was
already client-facing content, but nothing stated the trust/escrow pitch on
its own terms the way the vendor card made the vendor case.

### Decision
Three real pages now exist: `/how-it-works` (the 3-step explanation plus the
bundle example and celebration picker that make it concrete), `/for-clients`
(new — the escrow/trust content, given its own page rather than a mid-scroll
section), and `/for-vendors` (the existing pitch card, given room to be a
full page). Home is trimmed to: hero, the live vendor showcase (real data,
kept as Home's proof), a "learn more" section of three cards linking to the
pages above, the FAQ, and the closing CTA. SiteHeader's signed-out nav
(`SiteHeader.tsx`) links to the three real pages instead of `#how`/`#vendors`
anchors, and gained a fourth link ("For clients") it didn't have before.
Shared bits (`Eyebrow`, the marketing icon set) moved to
`components/marketing/` since four pages now use them instead of one.

### Consequences
No redirects were added for the old `/home#how`/`/home#vendors` anchors —
they were never separately indexable URLs, only in-page scroll targets, and
the only place that linked to them (`SiteHeader`) was updated in the same
change. A stray bookmark to `/home#how` still loads Home fine; it just lands
at the top instead of scrolling down, since that `id` no longer exists.
