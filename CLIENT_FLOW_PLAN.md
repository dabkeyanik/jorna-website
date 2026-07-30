# Client booking & planning flow — fix plan

Findings from a full read of the client path (bundle builder → marketplace →
booking form → plan page → dashboard → run sheet → check-in → escrow), then
**verified against the backend** at `Desiconnect/server`.

Ordered **most critical first**. Same convention as `WEB_PARITY_PLAN.md`: tick a
box only when the step is **built, verified against the real backend, and
deployed**.

Every item carries a **Verdict** line recording what the backend actually does,
because four of the original findings changed once it was read: two were worse
than they looked from the frontend, one was caused by the frontend bypassing a
guard the backend already had, and two were not bugs at all.

| Tier | Meaning | Items |
| --- | --- | --- |
| 🔴 Critical | Money can be lost, or the app states something materially false | 1–6 |
| 🟠 High | Two screens contradict each other, or a needed capability is absent | 7–11 |
| 🟡 Medium | Confusing, avoidable friction, or a promise the data can't keep | 12–22 |
| ⚪ Verified clean | Investigated, no action needed | 23–24 |

**Where the work lands:** items 1, 5, 14 and 20 need backend changes. Everything
else is frontend-only.

---

## 🔴 Critical

### 1. The bundle builder sums rates as if they were totals

**Frontend:** [`BundleResults.tsx:57`](web/src/components/BundleResults.tsx#L57), [`:93`](web/src/components/BundleResults.tsx#L93) · [`types.ts:23-34`](web/src/lib/types.ts#L23-L34)
**Backend:** `services/chatbot_service.py:505-531`, `:415-416` · `models/chatbot_schemas.py:129-151`

> **Verdict: confirmed, and worse than it looked.** `price = round(service.price, 2)`
> then `total_min += price` — the raw rate, with no unit awareness anywhere in
> the builder. `BundleItem` has no `price_unit` field to carry one.
>
> Two consequences the frontend can't see:
>
> 1. For a 200-guest wedding, a $62/head caterer contributes **$62** to the
>    headline total. The "Estimated total" a client picks a bundle on can be
>    understated by five figures.
> 2. `_candidate_service_rows` filters on `s.price <= price_cap`
>    (`chatbot_service.py:416`) — also the raw rate. So the budget tiers are
>    systematically biased: a $95/head chef-led caterer clears a per-category cap
>    that excludes an $8,500 venue. "Budget-friendly" is not selecting for what
>    it claims to.
>
> The backend **already has the correct function** — `estimate_amount_cents`
> (`booking_service.py:557-606`), which handles person/day/hour/event properly
> and is what every booking is priced with. The builder simply doesn't call it.

- [x] Backend: price each slot through `resolve_total_cents` — the same function
      `_booking_summary` uses — via a new `_price_for(service, state)`. Chosen
      over `estimate_amount_cents` because that one returns `None` for flat
      pricing, meaning "nothing to multiply", which is not the same as "unknown".
- [x] Backend: `price_unit` + `price_pending_quantity` on `BundleItem`,
      `pending_quantity_count` on `Bundle` — the same three-field contract a
      booking already carries, so both read the same way.
- [x] Backend: `price_cap` measures the resolved total, not `service.price`.
- [x] Backend: the strategy ranking (`budget`, `balanced`) and the scored
      builder's tiebreak now sort on the total too — "cheapest" was picking the
      lowest per-head figure, which at 200 guests is frequently the dearest bill.
- [x] Backend: `_score_vendor`'s tier alignment takes resolved totals, and
      **skips** the comparison when they're unknown. A $62 rate was being read as
      a cheap vendor and penalised under the premium tier.
- [x] Backend: one `_bundle_item` factory replaced three hand-rolled, identical
      `BundleItem` constructions that were each priced wrong; one `_retotal`
      replaced four copies of the totalling arithmetic.
- [x] Backend: `event_dates(state)` extracted so the preview and
      `_create_bundle_from_chatbot` derive dates once — a preview that disagrees
      with the booking it previews is the same bug in a new place.
- [x] Frontend: `BundleItem` gains the two fields; every figure in
      `BundleResults` goes through `priceLine`, captioned with its unit.
- [x] Frontend: headline reads "Estimated so far" with a per-bundle explanation
      when anything is unpriced, and renders min–max as a range when they differ.
- [x] Frontend: builder prompts for a guest count when the results contain
      unpriced per-person slots — the one input that makes the three comparable.
- [x] Tests: `TestRatePricedBundleItems` — resolution, the pending flag, flat
      rates never pending, the budget cap, and a test pinning the preview to
      `estimate_amount_cents` so the two can't drift.

**Verified:** 620 backend tests pass (80 in `test_chatbot.py`, 5 new). Web app
typechecks and builds. A venue + per-head caterer + flat photographer + hourly DJ
bundle at 200 guests, 18:00–23:00 now totals **$26,700**; it read **$12,762**
before, and still does when no quantities are given — where it is now labelled a
floor rather than the price.

**Not done — deliberately out of scope:** see item 25, found while doing this.

---

### 2. Deleting a plan destroys paid bookings and the escrow record with them ✅ done

**Backend:** `services/bundle_service.py:750-761` (`delete_bundle`) → `:697-746` (`_delete_bundle_cascade`) → `:273-297` (`_delete_booking_cascade`)
**Frontend:** [`bundle/page.tsx:1173-1192`](web/src/app/bundle/page.tsx#L1173-L1192)

> **Verdict: confirmed, and escalated.** `remove_booking_from_bundle` refuses
> this correctly — *"Don't delete a booking that's already been paid for — money
> is involved"* (`bundle_service.py:504-506`), rejecting `paid`, `released` and
> `disputed`.
>
> `delete_bundle` has **no equivalent check anywhere in its path**. It walks
> straight to `db.delete(booking)`. So:
>
> | Action | Result |
> | --- | --- |
> | Remove one paid booking | **Refused** ✅ |
> | Delete the plan containing that same paid booking | **Allowed** ❌ |
>
> Same file, same author, 200 lines apart. The constant that would fix it —
> `_PROTECTED_PAYMENT_STATUSES` — already exists at `:770`, and is used only by
> the one-off legacy cleanup.
>
> The frontend offers Delete unconditionally, with a dialog that says "This can't
> be undone" and never mentions money.

- [x] Backend: the guard lives in `_delete_booking_cascade` — the one point
      every delete path passes through — rather than at each caller, because the
      bug *was* a caller that didn't have it. A rule stated once at the
      chokepoint can't be skipped by the next path someone adds.
- [x] Backend: `delete_bundle` also checks up front, so the refusal names the
      amount, the services and what to do instead rather than reporting whichever
      booking the cascade reached first. It re-raises `BundleError` instead of
      burying a considered refusal in a 500.
- [x] Backend: one `MONEY_MOVED_STATUSES` replaces three separate ideas of what
      counts — the legacy `_PROTECTED_PAYMENT_STATUSES` (five states, used only
      by the cleanup), `remove_booking_from_bundle`'s own list of three, and
      `delete_bundle`'s nothing. The two the live path was missing matter most:
      `processing` is money in flight, `refunded` is where the record *is* the
      evidence it came back.
- [x] Frontend: Delete isn't offered at all when money is on the plan, replaced
      by a line saying how much and what to do instead. `heldOnPlan` mirrors the
      server's set rather than reusing `isBeyondActionable`, which answers a
      different question and omits `processing`.
- [x] Tests: `TestPaidBookingsSurviveDeletion` — all five states across both
      paths, the refusal naming the money, unpaid plans still deleting, an unpaid
      sibling surviving a refusal, and the cascade refusing on its own.

**Verified:** 642 backend tests pass, 14 new. **With the guard disabled, 13 of
the 14 fail** — the one that doesn't is the control asserting unpaid plans still
delete. Web typechecks and builds.

---

### 3. Escrow can be released before the event happens

**Backend:** `services/booking_service.py:1092-1137` (`event_confirmable_date`)
**Frontend:** [`types.ts:299-303`](web/src/lib/types.ts#L299-L303), [`:387-392`](web/src/lib/types.ts#L387-L392)

> **Verdict: confirmed — and the backend is the worse offender.** It compares
> `datetime.now(timezone.utc).date() >= end`, so the gate opens at **00:00 UTC on
> the event's last day**.
>
> For a Los Angeles wedding on 8 Aug:
>
> | Layer | Confirm allowed from |
> | --- | --- |
> | Backend (`event_confirmable_date`) | **5:00pm on 7 Aug** — the day before |
> | Frontend (`eventIsOver`, `23:59:59Z`) | **5:00pm on 8 Aug** — mid-reception |
>
> The two disagree by roughly 24 hours, and the frontend is the *stricter* one —
> so this is not a button that gets refused, it's the server accepting a release
> the client UI wouldn't even have offered. iOS or a direct API call gets the
> earlier window.
>
> `eventHasStarted` carries the same skew, which defeats the guard at
> [`types.ts:322-329`](web/src/lib/types.ts#L322-L329) written specifically to
> stop a vendor's night-before equipment drop counting as the event.
>
> **The backend already has what this needs.** `services/timezone_service.py` is
> a complete US timezone resolver — state from the address, longitude for the
> thirteen split states, DST-correct via `zoneinfo`. It is used for reminders and
> nothing else.

- [ ] Backend: resolve the booking's zone via `timezone_service.zone_for(...)`
      and compare against *local* today, not UTC today.
- [ ] Backend: expose the resolved zone (or a `confirmable_from` instant) on the
      booking payload, so the client stops re-deriving it.
- [ ] Frontend: parse local (`` `${iso}T00:00:00` ``/`` T23:59:59 ``) until the
      server field exists, then read the server field.
- [ ] Tests pinned to `TZ=America/Los_Angeles` on both sides.

**Done when:** neither layer will release escrow while the celebration is still
running, in any US timezone.

---

### 4. Committed / budget / "still to pay" are built from unresolved rates

**Frontend:** [`planning.ts:353-370`](web/src/lib/planning.ts#L353-L370) · [`bundle/page.tsx:1206`](web/src/app/bundle/page.tsx#L1206), [`:1240`](web/src/app/bundle/page.tsx#L1240) · [`bundles/page.tsx:285`](web/src/app/bundles/page.tsx#L285)
**Backend:** `services/bundle_service.py:31-59` (`_booking_summary`)

> **Verdict: confirmed exactly.** The backend is explicit and correct:
>
> ```python
> total_cents = resolve_total_cents(booking, service)
> price = (total_cents / 100) if total_cents is not None else (service.price or 0.0)
> "price_pending_quantity": total_cents is None,
> ```
>
> — with the comment *"None => rate-priced with an unknown quantity, so show the
> rate + unit, not a total masquerading as one."*
>
> `moneyForBundle` sums `b.price` unconditionally and ignores the flag the
> backend sends specifically to prevent this. So "Committed $5,240" can mean
> $20,000, "Awaiting a guest count: $38" is a per-head rate in a row of dollar
> totals, and `overBudget` reassures a client who is well over.

- [ ] Exclude `price_pending_quantity` bookings from `committed`, `outstanding`
      and `awaitingQuantity` **as money**.
- [ ] Report them as a count: *"2 vendors not yet priced"*.
- [ ] Where the event has a guest count, show a provisional total marked as such.
- [ ] Make `overBudget` withhold a verdict while any booking is unpriced.

**Done when:** every dollar sign in the client UI is a resolved total, or is
visibly flagged as not one.

---

### 5. "Every vendor… is a real business with a profile you can open and check" — you can't

**Frontend:** [`home/page.tsx:174`](web/src/app/home/page.tsx#L174) (FAQ) · [`BundleResults.tsx:78-97`](web/src/components/BundleResults.tsx#L78-L97)

> **Verdict: confirmed, and free to fix.** `BundleItem` already carries
> `service_id`, `vendor_id` and `match_reason`
> (`chatbot_schemas.py:129-139`) — all three populated at
> `chatbot_service.py:509-523`. The frontend renders them as plain `<li>` and
> drops `match_reason` entirely. No backend work needed.

- [ ] Link each line-up row to `/service?id={service_id}`, falling back to
      `/vendor?id={vendor_id}`.
- [ ] Open in a new tab — the three generated options are unsaved state on
      `/plan` and navigating in place loses them.
- [ ] Render `match_reason` so "why this vendor" is answerable in place.

---

### 6. `autoReleaseOn` shows a wrong date, and the sentence around it overstates

**Frontend:** [`types.ts:332-342`](web/src/lib/types.ts#L332-L342) · [`bundle/page.tsx:379`](web/src/app/bundle/page.tsx#L379)
**Backend:** `services/stripe_service.py:700-760` (`auto_release_due`)

> **Verdict: confirmed, plus a second problem the backend revealed.**
>
> 1. **Wrong date.** Local `Date` → `+7 days` → `.toISOString().slice(0,10)`. In
>    IST, local midnight on the 15th is `14T18:30Z`, so this renders **21 Aug**
>    instead of 22 Aug. A wrong money deadline, on a product whose hosts are
>    frequently in UTC+.
> 2. **Overstated promise.** The copy says *"If you do nothing, this releases on
>    its own on {date}"*. `auto_release_due` requires
>    `Booking.vendor_confirmed_at.isnot(None)` — deliberately, so it never pays a
>    vendor who hasn't claimed to have delivered. **If the vendor never confirms,
>    it never auto-releases.** The date shown may never arrive, and the client is
>    told their inaction is sufficient when it isn't.

- [ ] Format from local date parts, never `toISOString()`.
- [ ] Sweep for the same pattern (`planning.ts:507` `daysBetween` has it).
- [ ] Reword: *"Once your vendor confirms, this releases on its own on {date} if
      you don't."* — condition first.
- [ ] Test with `TZ=Asia/Kolkata`.

---

## 🟠 High

### 7. "Request booking" promises a vendor review that does not happen

**Frontend:** [`book/page.tsx:222-252`](web/src/app/book/page.tsx#L222-L252), [`:420-423`](web/src/app/book/page.tsx#L420-L423)
**Backend:** `services/booking_service.py:816-847`

> **Verdict: resolved — the frontend is lying, the plan page is right.** The
> backend is unambiguous:
>
> ```python
> still_a_draft = parent is not None and parent.status == "draft"
> if still_a_draft:
>     notification = {"skipped": "Draft plan — vendors are told when it's sent."}
> ```
>
> A new bundle is created with `status="draft"` (`:699`), so **"A new plan" is
> always a draft** and the vendor is never told. The plan page's "Not sent yet"
> is correct; the form's *"The vendor reviews your request first"* is false.
>
> **Worse:** `submit()` and `addAsDraft()` send byte-identical payloads to the
> same endpoint. On a draft target they are **the same API call** — the only
> differences are client-side validation and where the router pushes. The page
> presents them as two meaningfully different choices separated by an "or".

- [ ] Rename the primary button to "Add to plan" and delete the "vendor reviews
      your request first" line.
- [ ] Collapse the two buttons into one when the target is a draft; keep the
      distinction only when joining an already-sent plan (which the backend does
      treat differently — `booking_service.py:711-725`).
- [ ] Route to the plan with a note pointing at the Send button.
- [ ] Keep the per-person guest-count validation as a *warning*, not a block —
      the draft exists precisely so details can arrive later.

---

### 8. There is no way to contact a vendor — and the conversation already exists

**Frontend:** the only route to `/conversation` in the whole tree is [`messages/page.tsx:92`](web/src/app/messages/page.tsx#L92)
**Backend:** `services/conversation_service.py:89-146` · `services/bundle_service.py:574-588, 673-676`

> **Verdict: confirmed, and the post-send half is nearly free.** `select_bundle`
> calls `_open_bundle_conversations` the moment a plan is sent, creating both an
> `all_parties` and a `vendors_only` chat, with every vendor as a member and a
> push notification to each. `ConversationSummary` already carries `bundle_id`
> ([`types.ts:522-523`](web/src/lib/types.ts#L522-L523)).
>
> So for every sent plan there is a working group chat that the plan page never
> links to. Only the **pre-booking** 1:1 needs backend work — there is no
> endpoint to open a conversation without a bundle.
>
> Separately, [`NegotiationPanel.tsx:81-86`](web/src/components/NegotiationPanel.tsx#L81-L86)
> drops the `message` argument both `startNegotiation` and `counterOffer` accept
> (`negotiations` router supports it) and never renders `offers[].message`. The
> one channel that could carry "we'd do $2,800 if you drop the second shooter"
> discards it.

- [ ] Frontend: fetch the bundle's conversation via `listConversations()` filtered
      on `bundle_id`; add "Message vendors" to the plan header and a per-vendor
      entry point on each `BookingRow`.
- [ ] Frontend: name chats after the celebration; never fall back to
      `"Group · N people"` ([`messages/page.tsx:24-28`](web/src/app/messages/page.tsx#L24-L28)).
- [ ] Frontend: add a message field to `NegotiationPanel`; render the offer
      history with its messages.
- [ ] Frontend: rewrite the Messages empty state — "confirmed" is backend
      vocabulary; the client's word is "sent".
- [ ] Backend: an endpoint to open a 1:1 client↔vendor conversation with no
      bundle, for pre-booking questions.

---

### 9. The client can never see when each vendor is coming

**Frontend:** [`bundle/page.tsx:230-464`](web/src/app/bundle/page.tsx#L230-L464) (`BookingRow`) · [`planning.ts:472-498`](web/src/lib/planning.ts#L472-L498)

> **Verdict: confirmed, frontend-only.** `_booking_summary` returns `date_iso`,
> `date_end`, `time_start`, `time_end` and `location` on every booking
> (`bundle_service.py:43-51`). `BookingRow` renders **none** of them, and the run
> sheet that does is gated to 7 days out.
>
> So for months, a client with six vendors booked has no screen that says what
> time the photographer arrives, or that the mehndi artist is coming to the house
> rather than the hall. `CelebrationPanel` shows one event-level date, which is
> wrong the moment a celebration spans a mehndi, a sangeet and a reception.
>
> Holding the *arrivals board* back is right. Holding the *schedule* back is not.

- [ ] Add a facts line to `BookingRow`: date (+ end date), time window, location.
- [ ] Split `RunSheet` — schedule always visible once any booking has a date;
      `Arrivals` + `Nudge` stay gated on `runSheetIsDue`.
- [ ] Flag on the row where a booking's date differs from the event's.

---

### 10. One guest count is written to every vendor

**Frontend:** [`DraftDetails.tsx:169-195`](web/src/components/DraftDetails.tsx#L169-L195) · [`bundle/page.tsx:533`](web/src/app/bundle/page.tsx#L533)

> **Verdict: confirmed; needs backend.** A `Booking` has its own `guest_count`
> and the guest list is modelled per function
> ([`types.ts:848-902`](web/src/lib/types.ts#L848-L902), `guest_service.py`), but
> nothing links a booking to a function — so `DraftDetails` fans one number
> across every live booking and the mehndi caterer is billed against the
> reception's 300.
>
> `GuestsRow` compounds it: `Math.max(...headcount.map(h => h.attending))` under
> the label "N coming" presents the largest function's number as the whole
> celebration's.

- [ ] Backend: allow a booking to reference a `function_id`.
- [ ] Drive a booking's `guest_count` from its function's headcount.
- [ ] Interim: relabel the field "Guests for the main function"; allow
      per-booking headcount editing on the row.
- [ ] Fix `GuestsRow` — sum across functions, or name the function it reports.

---

### 11. Auto-charge is invisible after sending, and starts a silent refund clock

**Frontend:** [`bundle/page.tsx:1261-1323`](web/src/app/bundle/page.tsx#L1261-L1323) · [`planning.ts:248-256`](web/src/lib/planning.ts#L248-L256)
**Backend:** `services/stripe_service.py:793-835` (`REFUND_WINDOW_HOURS = 24`)

> **Verdict: confirmed.** The 24-hour window is real and measured from
> `paid_at`. The saved-card panel lives inside `{draft ? … }`, so once a plan is
> sent there is nowhere to add, change or remove the card that will charge them —
> and `planForBundle` still emits "Pay for X" tasks with no awareness of a card on
> file, telling the client to pay something about to pay itself.

- [ ] Show the card row on sent plans, not only drafts.
- [ ] Suppress or reword `payment` tasks when `card.has_card` — "charged
      automatically when they accept".
- [ ] Render the remaining window: *"Full refund available for another 19 hours"*.
- [ ] Email or push on auto-charge — a charge nobody initiated needs a receipt
      that doesn't depend on having the tab open.

---

## 🟡 Medium

### 12. The frontend bypasses the backend's own orphan guard when deleting ✅ mostly done

**Frontend:** [`bundle/page.tsx:952-964`](web/src/app/bundle/page.tsx#L952-L964)
**Backend:** `services/bundle_service.py:735-746` · `services/event_service.py:83-90`

> **Verdict: corrected — this is caused by the frontend, not the backend.**
> `_delete_bundle_cascade` already deletes the event *only* when
> `still_referenced == 0`. The frontend then calls `deleteEvent(eventId)`
> explicitly afterwards, and `delete_event` is a bare `db.delete(event)` with no
> reference check — so the frontend destroys an event that sibling bundles still
> point at, defeating a guard written to prevent exactly that.

- [x] Deleted the `await deleteEvent(eventId)` line. The backend handles it.
      Done alongside item 2 — it is the same function, and leaving a known bug
      in code being actively edited is worse than the small scope expansion.
- [ ] Backend (defence in depth): make `delete_event` refuse while a bundle
      references it.

---

### 13. A bundle can be cancelled while holding escrow, and looks live afterwards

**Backend:** `services/bundle_service.py:550-572` (`update_bundle_status`)
**Frontend:** [`planning.ts:675-678`](web/src/lib/planning.ts#L675-L678)

> **Verdict: found while checking item 14.** `update_bundle_status` accepts
> `cancelled` with no payment check of any kind. On the client, `isDraftBundle`
> only asks whether the status is `"draft"`, so a **cancelled** bundle renders as
> a normal sent plan — banners, actions and all.

- [ ] Backend: refuse `cancelled` while any booking holds escrow.
- [ ] Frontend: render a cancelled bundle as cancelled.

---

### 14. Cancelled-but-paid bookings would vanish from every money figure

**Frontend:** [`planning.ts:357-361`](web/src/lib/planning.ts#L357-L361)

> **Verdict: corrected — latent, not live.** `BookingStatus`
> (`models/schemas.py:4-9`) has **no `cancelled` member**, and nothing in the
> codebase sets a booking to it; only *bundles* can be cancelled. Both sides
> carry `"cancelled"` in their dead-booking constants defensively
> (`booking_service.py:295`).
>
> So the bug is not reachable today. But `moneyForBundle` does
> `if (isDeadBooking(b)) continue` *after* handling `refunded` — so the day
> `cancelled` becomes a real booking status (one line in an enum), paid escrow
> disappears from `committed` **and** `inEscrow` while the booking's card still
> renders the full escrow block. Cheap to make correct now.

- [ ] Add a `strandedInEscrow` bucket, counted before the dead-booking bail-out.
- [ ] Surface it with a route to dispute/refund; add it to `ATTENTION_KINDS`.

---

### 15. "Negotiate price" appears on an unsent draft

**Frontend:** [`bundle/page.tsx:134-137`](web/src/app/bundle/page.tsx#L134-L137), [`:290`](web/src/app/bundle/page.tsx#L290)

`isAwaitingVendor` short-circuits to `false` when `draft`, so the button renders
on a booking no vendor has received — and per item 7, genuinely has not been told
about.

- [ ] Hide negotiation while `draft` is true.

---

### 16. A paid booking has no reschedule path

**Frontend:** [`bundle/page.tsx:728-732`](web/src/app/bundle/page.tsx#L728-L732)
**Backend:** `services/plan_readiness.py:181-221` (`locked_fields_for`)

> **Verdict: confirmed by design.** `COMMITTED_FIELDS` freezes date, times,
> location, guest count and end date once a request has reached a vendor —
> correctly, since those are what the vendor agreed to. But the frontend's advice
> ("cancel the requests affected and book again") is unactionable: a paid booking
> is `isBeyondActionable`, so no cancel button exists, and
> `remove_booking_from_bundle` would refuse anyway. Past 24 hours the only exits
> are dispute or nothing.

- [ ] Design a change-request flow: client proposes, vendor accepts, escrow follows.
- [ ] Interim: make the copy name something the client can actually do.

---

### 17. The marketplace date filter promises availability it cannot check

**Frontend:** [`marketplace/page.tsx:368-372`](web/src/app/marketplace/page.tsx#L368-L372) · [`availability.ts:18-25`](web/src/lib/availability.ts#L18-L25)

The hint says *"Hides vendors booked at all that day"*, while `availability.ts`
fails open and its own header records that the filter "excludes nobody today". A
client filters to their wedding date, reads the result as "these are free", and
gets declined.

- [ ] Reword to "Hides vendors who have told us they're busy".
- [ ] Show "availability unknown" on cards whose vendor publishes no hours.

---

### 18. A payment in progress reads as unpaid, inviting a double charge

**Frontend:** [`bundle/page.tsx:149`](web/src/app/bundle/page.tsx#L149), [`:220`](web/src/app/bundle/page.tsx#L220)

`payable` includes `processing`, and `statusLine` skips it so it falls through to
"Approved". After `/payment-complete` says *"Payment is processing"*, the plan
shows **Approved · Pay $2,200**.

- [ ] Add a `processing` branch to `statusLine`.
- [ ] Remove `processing` from `payable`.

---

### 19. Gap warnings render on declined bookings

**Frontend:** [`bundle/page.tsx:260-266`](web/src/app/bundle/page.tsx#L260-L266)

Guarded on `!isBeyondActionable`, which is false for a *rejected* unpaid
booking — so a declined vendor's card says "The vendor can't act on this until it
has a guest count".

- [ ] Add `&& !isDeadBooking(booking)`.

---

### 20. "Build a bundle" from an existing celebration creates a second celebration

**Frontend:** [`bundles/page.tsx:181-188`](web/src/app/bundles/page.tsx#L181-L188), [`:369`](web/src/app/bundles/page.tsx#L369)
**Backend:** `models/chatbot_schemas.py:213-253` (`BundleRequest`)

> **Verdict: confirmed.** `BundleRequest` has no `event_id` field, and
> `_ensure_bundle_event` always creates a fresh event for a generated bundle. The
> client ends up with two dashboard cards for one wedding and no way to merge.

- [ ] Backend: accept an optional `event_id` on `POST /chatbot/bundles`; have
      `_ensure_bundle_event` adopt it instead of creating one.
- [ ] Frontend: pass it from the dashboard; warn on the button until it exists.

---

### 21. "Still to book" never fires for hand-made celebrations

**Frontend:** [`planning.ts:521-535`](web/src/lib/planning.ts#L521-L535) · [`bundles/page.tsx:433-439`](web/src/app/bundles/page.tsx#L433-L439)

`missingCategories` reads `event.services_needed`, which the dashboard's "New
celebration" form never sets.

- [ ] Add a category multi-select to that form, or derive from the celebration
      type the way `/plan?event=wedding` does.

---

### 22. Budget can't be saved while the address is incomplete

**Frontend:** [`bundle/page.tsx:634-639`](web/src/app/bundle/page.tsx#L634-L639)

The `isCompleteAddress` check blocks the whole save. A budget is never sent to a
vendor; it shouldn't be hostage to a street name.

- [ ] Save the budget regardless; gate only the address fields.

---

### 25. A date range is charged as the event's duration ✅ done

**Backend:** `services/chatbot_service.py` — `event_dates` / `_create_bundle_from_chatbot`

> **Verdict: found while fixing item 1.** `BundleRequest.date_range` is
> documented as *"Date range when the exact date is unknown"* — a client saying
> "sometime in October". But `_create_bundle_from_chatbot` persists
> `date_iso = range.start, date_end = range.end`, and `estimate_amount_cents`
> reads a start-to-end span as the number of days to charge for. A per-day
> service picked with a two-week range is billed for fourteen days.
>
> Item 1 deliberately did **not** change this. The persisted booking is what gets
> charged, so the estimate has to match it — correcting only the preview would
> have moved the lie rather than removed it. `event_dates()` is now the single
> place this is decided, so the fix is one function when someone takes it on.
>
> **Resolved.** `date_end` means "last day of the engagement" in five places —
> per-day pricing, `event_confirmable_date`, `auto_release_due`, the run sheet's
> day-spreading, and the frontend's `dayCount`. A window written into it was two
> meanings in one pair of columns, so a fortnight-long "sometime in October" also
> delayed escrow confirmation by a fortnight and smeared every vendor across
> fourteen rows of run sheet.
>
> Settled: a window keeps its **first day as a provisional date** and drops the
> width; a celebration that genuinely runs several days says so with a new,
> explicit `event_date_end`. The two can no longer be confused for each other.

- [x] `event_dates` — a settled date wins and may carry an end; a window yields
      `(start, None)`. One writer, so the estimate and the persisted booking
      cannot disagree.
- [x] `BundleRequest.event_date_end` + `ChatbotState.event_date_end`, threaded
      through all three state constructions. Docstrings on both `DateRange` and
      the new field say which is which and why it matters.
- [x] `_get_booked_vendor_ids` no longer narrows on a window. Asked about a
      fortnight it dropped every vendor with a single booking anywhere inside it
      — for "sometime in October", most of the good ones, on the strength of a
      day nobody had picked. A window is not evidence of a conflict with any
      particular date, which is the rule the marketplace filter already follows.
      A settled span still narrows, and the vendor's own approval re-checks the
      conflict on the day actually asked for.
- [x] The bot's confirmation line says what the bookings were dated — "I've
      pencilled it in for 1 Oct … change it before you send" — rather than
      describing a fortnight-long event nobody asked for.
- [x] Frontend: `/plan` gains a **When** block with an "I know the date / Not
      sure of the date yet" toggle, a "+ Runs across multiple days" affordance
      worded exactly as `/book`'s, and a line naming the date that will be
      pencilled in. Exactly one of `event_date(+end)` / `date_range` is sent.
- [x] Tests: `TestEventDateSemantics` — the window's first day, a settled span
      keeping both ends, a settled date beating a window, no date at all, the
      per-day billing (`$500` not `$7,500`), availability excluding nobody on a
      window but still narrowing on a span, and the persisted booking matching
      what was priced.

**Verified:** 628 backend tests pass (88 in `test_chatbot.py`, 8 new). Web
typechecks and builds. A `$500/day` marquee over a 15-day window now bills
**$500**; a genuine Friday-to-Sunday celebration still bills **$1,500**.

---

## ⚪ Verified clean — no action

### 23. `priceLine`'s `price_pending_quantity` fallback

> `_booking_summary` emits `"price_pending_quantity": total_cents is None` on
> **every** booking (`bundle_service.py:59`). The field is never absent, so the
> `?? quantity == null` fallback at [`types.ts:833`](web/src/lib/types.ts#L833)
> never fires. Not a bug.
>
> The related concern stands and is folded into item 9: `/book` defaults to
> 17:00–23:00, so a defaulted time window is indistinguishable from an answered
> one — here and in `ScheduleDay.timesKnown`.

- [ ] (Optional) Stop defaulting the time window, or mark it as unanswered.

### 24. The send gate mirrors the server field for field

> `plan_readiness.py` is a deliberate, faithful mirror of `lib/planning`'s
> `bookingGaps` — `is_complete_address` reproduces `parseAddress` + `addressGaps`
> including the state/ZIP tail cases, and `_price_unit_kind` delegates to
> `_normalize_unit` so "per head" is read the same way on both sides. The
> greyed-out Send button and the server's 400 agree. Nothing to do.

---

## Suggested order of work

1. **Item 2 — the escrow deletion hole.** A backend guard, a few lines, and it
   closes the only path in the product that can destroy money. Do it first
   regardless of anything else on this list.
2. **Item 3 — the timezone gate**, same reason: it releases escrow early, the
   backend is the offender, and `timezone_service` already exists.
3. **Item 1 — unit-correct the builder.** Backend then frontend. It's the front
   door and its numbers are the least trustworthy in the product.
4. **Item 7 — the draft/sent contradiction.** One product decision, then all the
   copy follows. Cheap and immediately visible.
5. **Item 4 — money truthfulness**, one pass over `moneyForBundle`.
6. **Items 5, 8, 9** — the pre-commitment gap: link the vendors, link the chats,
   show the schedule. All frontend.
7. Everything else, top to bottom.

---

## What reading the backend changed

Worth recording, because the pattern is informative:

- **Two findings got worse.** The builder doesn't just display rates as totals,
  it *filters budget tiers* on them (item 1). The escrow-deletion hole isn't a
  missing warning, it's a missing guard that exists 200 lines away in the same
  file (item 2).
- **One was mine, not theirs.** The sibling-event orphan (item 12) is the
  frontend bypassing a guard the backend already had.
- **Two weren't bugs.** `price_pending_quantity` is always sent, and the send
  gate mirrors the server exactly.
- **The backend is consistently ahead of the frontend.** `estimate_amount_cents`,
  `timezone_service`, `plan_readiness`, `_PROTECTED_PAYMENT_STATUSES`,
  `match_reason`, the bundle conversations — the correct machinery mostly exists
  and is not wired up. Several items here are connection work, not construction.

The original conclusion survives: the **sent, paid, live** half of the journey is
handled carefully on both sides, and the **pre-commitment** half — comparing
bundles, asking a question, seeing a schedule — is where the gaps cluster.
