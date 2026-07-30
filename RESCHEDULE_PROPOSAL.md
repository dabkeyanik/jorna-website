# Rescheduling a paid booking — a proposal

Item 16 in `CLIENT_FLOW_PLAN.md`. Not built, because it is a decision about what
a booking *means* rather than a defect in how one is displayed, and it moves
escrow.

## The hole

Events move. Once a request has reached a vendor, `plan_readiness.COMMITTED_FIELDS`
freezes the date, times, location, headcount and end date — correctly, since
those are what the vendor agreed to. But the app's own advice for changing them
is unactionable:

> "Your vendors have this plan's date, address and headcount, so those are
> settled. To move any of them, cancel the requests affected and book again."
> — [`bundle/page.tsx`](web/src/app/bundle/page.tsx)

For a **paid** booking there is no cancel button (`isBeyondActionable`), and
`remove_booking_from_bundle` refuses it anyway now that money has moved. So past
the 24-hour refund window the only exits are:

- **Dispute** — freezes the money for manual review. Adversarial, and wrong for
  "the venue flooded, we've moved to the 14th."
- **Nothing** — the booking keeps its old date, the vendor turns up on the wrong
  day or doesn't, and escrow auto-releases seven days after a date that no
  longer means anything.

Neither is a reschedule. A client who moves their wedding today has no route
through the product that keeps the vendor, the money, and the truth together.

## What it should probably be

A **change request**: the same shape as the negotiation flow, which already
exists and already works this way — one side proposes, the other accepts or
declines, and acceptance mutates the booking.

```
client proposes new date/times          → booking.change_request (pending)
  vendor accepts                        → fields updated, escrow untouched
  vendor declines                       → client chooses: keep as booked, or refund
  no answer within N days               → client may withdraw for a full refund
```

Escrow does not move on a proposal, only on a resolution. That is the property
worth protecting: a client cannot free their money by proposing an impossible
date, and a vendor cannot strand it by ignoring one.

### Why mirror negotiations

`negotiation_service` is turn-based, the backend enforces whose turn it is, and
`NegotiationPanel` already renders the pattern. Reusing the shape means one
mental model for "I want to change something we agreed", whether the thing is a
price or a date, and one place to fix it.

## Questions this needs answered

1. **Does an accepted reschedule re-run the availability check?** A vendor
   accepting a new date they're already booked on is a double-booking.
   `update_booking_status` has a conflict guard for approval — should acceptance
   go through it, and what happens if it fails?
2. **What happens to the rest of the plan?** A wedding moving takes every vendor
   with it. Is a change request per booking, or per plan with a per-vendor
   response? Per plan is what a client wants; per booking is what the data
   models.
3. **Does a decline entitle the client to a refund outside the 24-hour window?**
   It should — the vendor can't supply what was asked for. But that is a
   commercial decision, and it is the one that decides whether vendors decline
   freely or feel pressured to accept.
4. **How long may a vendor sit on it?** `auto_release_due` waits 7 days on a
   comparable question. The same number is the obvious answer.
5. **Per-day pricing.** Moving a 3-day booking to a 2-day window changes the
   total. Does an accepted reschedule re-price, and if the price rises, does
   that need a second acceptance from the client?

## Smallest honest thing to do now

If the full flow isn't wanted yet, **fix the advice**, which is currently a
dead end:

- Replace "cancel the requests affected and book again" with what the client can
  actually do — message the vendor (now possible from the booking row), and
  report a problem if they can't accommodate it.
- Say plainly that a paid booking's date can't be changed in-app yet.

That is a ten-minute change and stops the app instructing people to press
buttons that aren't there. It does not solve the problem.
