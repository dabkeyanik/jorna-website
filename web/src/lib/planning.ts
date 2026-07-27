"use client";

// What a celebration still needs, derived from the bundle the app already has.
//
// This is the one place the "what's outstanding" rules live. The dashboard, the
// bundle page, and lib/attention all read it, so the tab-bar badge and the
// planning checklist can't drift apart — which is the failure lib/attention was
// already written to avoid, back when it was the only caller.
//
// Every booking rule mirrors a backend guard, so a task never points at an
// action the server must reject.

import {
  eventHasPassed,
  priceUnitLabel,
  type BundleBooking,
  type BundleDetail,
  type BundleEventInfo,
} from "./types";

export type TaskKind =
  /** The event itself is missing a date, place, or headcount. */
  | "event-detail"
  /** Sent to the vendor; they haven't answered. Waiting on them, not you. */
  | "vendor-reply"
  /** Priced per guest/day, so the total isn't known yet and can't be charged. */
  | "quantity"
  | "payment"
  | "confirm";

/**
 * The kinds lib/attention surfaces as "Needs you".
 *
 * Not every task belongs there. "vendor-reply" is waiting on the vendor, and
 * putting event-detail gaps in the badge would make it count things that were
 * never in it — this list is what the badge already meant, held steady while
 * the rules themselves moved here.
 */
export const ATTENTION_KINDS: TaskKind[] = ["quantity", "payment", "confirm"];

export interface PlanTask {
  id: string;
  kind: TaskKind;
  title: string;
  /** The vendor it concerns, when it concerns one. */
  vendor?: string;
  /** Trailing explanation, no leading punctuation. */
  note?: string;
  tone: "urgent" | "normal";
  cta: string;
  bookingId?: string;
}

export interface BundlePlan {
  tasks: PlanTask[];
  /** Vendors actually on the team — accepted, or already paid for. */
  booked: BundleBooking[];
  /** Requested, no answer yet. */
  awaiting: BundleBooking[];
  /** Declined, cancelled, or refunded — kept so the page can explain a gap. */
  closed: BundleBooking[];
  paidCount: number;
  /** Bookings that still count toward the plan (everything but `closed`). */
  liveCount: number;
  /** Whether the event has a venue to check into. */
  canCheckIn: boolean;
}

const DEAD_STATUSES = ["rejected", "cancelled"];

/** Mirrors the backend's _DEAD_* — a booking that no longer counts. */
export function isDeadBooking(b: BundleBooking): boolean {
  return (
    DEAD_STATUSES.includes(b.status) || (b.payment_status ?? "unpaid") === "refunded"
  );
}

/**
 * Does the event still have a venue to check into? Mirrors the backend's source
 * of truth (the bundle's live venue booking) rather than any cached coords — a
 * rejected or refunded venue stops anchoring, and check-in 400s. (A disputed
 * venue still anchors, which falls out of the same rule.)
 */
export function hasLiveVenue(bookings: BundleBooking[]): boolean {
  return bookings.some((b) => b.service_category === "venue" && !isDeadBooking(b));
}

/** Gaps in the event itself — the answers every vendor ends up needing. */
function eventTasks(event: BundleEventInfo | null | undefined): PlanTask[] {
  if (!event) return [];
  const missing: PlanTask[] = [];
  const add = (field: string, title: string, note: string) =>
    missing.push({
      id: `event-${field}`,
      kind: "event-detail",
      title,
      note,
      tone: "normal",
      cta: "Add",
    });

  if (!event.date_iso || event.date_iso === "TBD") {
    add("date", "Set your event date", "Vendors can't hold a slot without one.");
  }
  if (!event.location) {
    add("location", "Add where it's happening", "Used to match vendors near you.");
  }
  if (event.guest_count == null) {
    add(
      "guests",
      "Add your guest count",
      "Anything priced per person needs it before it can be paid.",
    );
  }
  return missing;
}

/** What one booking still needs. At most one task each, most pressing first. */
function bookingTask(b: BundleBooking): PlanTask | null {
  const pay = b.payment_status ?? "unpaid";
  const service = b.service_name || "a service";
  const vendor = b.vendor_name || "the vendor";

  // Money is held and the event is over — the client's confirm is the only
  // thing between the vendor and their payout. Gated on the booking's LAST day,
  // like the backend's event_confirmable_date.
  if (pay === "paid" && !b.customer_confirmed_at && eventHasPassed(b.date_end || b.date_iso)) {
    return {
      id: `confirm-${b.booking_id}`,
      kind: "confirm",
      title: `Confirm ${service} happened`,
      vendor,
      note: "this releases their payment.",
      tone: "urgent",
      cta: "Confirm",
      bookingId: b.booking_id,
    };
  }

  // Approved and waiting on payment. Mirrors the checkout guard: a total still
  // pending a quantity can't be paid, so don't offer a Pay button.
  if (b.status === "approved" && (pay === "unpaid" || pay === "processing")) {
    if (b.price_pending_quantity) {
      return {
        id: `quantity-${b.booking_id}`,
        kind: "quantity",
        title: `${service} needs a guest count or dates`,
        vendor,
        note: `it's priced ${priceUnitLabel(b.price_unit) || "per unit"}, so its total can't be worked out until then.`,
        tone: "normal",
        cta: "View",
        bookingId: b.booking_id,
      };
    }
    return {
      id: `pay-${b.booking_id}`,
      kind: "payment",
      title: `Pay for ${service}`,
      vendor,
      tone: "normal",
      cta: "Pay",
      bookingId: b.booking_id,
    };
  }

  if (b.status === "pending") {
    return {
      id: `reply-${b.booking_id}`,
      kind: "vendor-reply",
      title: `${service} is awaiting a reply`,
      vendor,
      note: "nothing to do until they answer.",
      tone: "normal",
      cta: "View",
      bookingId: b.booking_id,
    };
  }

  return null;
}

/** Everything outstanding on one bundle, plus how its bookings sort out. */
export function planForBundle(bundle: BundleDetail): BundlePlan {
  const bookings = bundle.bookings ?? [];

  const booked: BundleBooking[] = [];
  const awaiting: BundleBooking[] = [];
  const closed: BundleBooking[] = [];
  for (const b of bookings) {
    if (isDeadBooking(b)) closed.push(b);
    else if (b.status === "pending" || b.status === "negotiation_ongoing") awaiting.push(b);
    else booked.push(b);
  }

  const tasks = [
    ...eventTasks(bundle.event),
    ...bookings.filter((b) => !isDeadBooking(b)).map(bookingTask).filter((t): t is PlanTask => t !== null),
  ];
  // Urgent first; otherwise the order they were derived in.
  tasks.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "urgent" ? -1 : 1));

  return {
    tasks,
    booked,
    awaiting,
    closed,
    paidCount: bookings.filter((b) => ["paid", "released"].includes(b.payment_status ?? ""))
      .length,
    liveCount: bookings.length - closed.length,
    canCheckIn: hasLiveVenue(bookings),
  };
}

/** A task's supporting line. `where` names the bundle, for feeds that mix several. */
export function taskDetail(task: PlanTask, where?: string): string {
  const lead = [task.vendor, where].filter(Boolean).join(" · ");
  if (!task.note) return lead;
  return lead ? `${lead} — ${task.note}` : task.note;
}
