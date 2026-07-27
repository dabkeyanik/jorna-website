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

/** Days until an event; negative once past, null when there's no date. */
export function daysUntil(iso?: string | null): number | null {
  if (!iso || iso === "TBD") return null;
  const day = Date.parse(`${iso}T00:00:00`);
  if (Number.isNaN(day)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((day - today.getTime()) / 86_400_000);
}

/**
 * Order celebrations by date, anchored on today.
 *
 * Upcoming first, soonest at the top; then finished ones, most recent first;
 * then anything undated, since there is nothing to place it against. A plain
 * ascending sort on the date reads as "date order" but puts last year's wedding
 * above the one three weeks out, which is the wrong end of the list to be
 * looking at on a planning screen.
 *
 * Returns a comparator result; ties fall through to the caller.
 */
export function compareByDate(aIso?: string | null, bIso?: string | null): number {
  const a = daysUntil(aIso);
  const b = daysUntil(bIso);
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const aPast = a < 0;
  const bPast = b < 0;
  if (aPast !== bPast) return aPast ? 1 : -1;
  // Upcoming: soonest first. Past: most recent first — so both read as
  // "closest to now at the top".
  return aPast ? b - a : a - b;
}

/**
 * How close the event has to be before an outstanding task counts as urgent.
 *
 * The same unpaid booking is background noise three months out and a real
 * problem three days out, and a checklist that never changes its mind stops
 * being read. Confirming after the event is urgent regardless — that one is
 * holding up someone else's money.
 */
const URGENT_WITHIN_DAYS: Partial<Record<TaskKind, number>> = {
  payment: 21,
  quantity: 30,
  "vendor-reply": 14,
  "event-detail": 45,
};

function sharpen(task: PlanTask, days: number | null): PlanTask {
  if (task.tone === "urgent" || days == null || days < 0) return task;
  const window = URGENT_WITHIN_DAYS[task.kind];
  if (window == null || days > window) return task;

  const clause =
    days === 0
      ? "The event is today."
      : days === 1
        ? "The event is tomorrow."
        : `Only ${days} days to go.`;
  const base = task.note?.trim();
  return {
    ...task,
    tone: "urgent",
    // The existing note is a sentence, so end it before starting another —
    // joining them raw produced "…until they answer. only 12 days to go."
    note: base ? `${base.replace(/\.?$/, ".")} ${clause}` : clause,
  };
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

  const days = daysUntil(bundle.event?.date_iso);
  const tasks = [
    ...eventTasks(bundle.event),
    ...bookings
      .filter((b) => !isDeadBooking(b))
      .map(bookingTask)
      .filter((t): t is PlanTask => t !== null),
  ].map((t) => sharpen(t, days));
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

// ── Money ────────────────────────────────────────────────────────────
//
// "2 of 5 paid" is a count, and the question a host actually has is about
// money: how much have I committed, how much is already gone, and what's still
// coming. Every figure here comes off the bookings.

export interface MoneyBreakdown {
  /** Everything still live — what the celebration will cost as booked. */
  committed: number;
  /** Paid, held by Jorna, not yet the vendor's. */
  inEscrow: number;
  /** Paid out. */
  released: number;
  /** Approved and payable, not yet paid. */
  outstanding: number;
  /** Approved but unpayable until a guest count or date range lands. */
  awaitingQuantity: number;
  refunded: number;
}

export function moneyForBundle(bundle: BundleDetail): MoneyBreakdown {
  const sum: MoneyBreakdown = {
    committed: 0,
    inEscrow: 0,
    released: 0,
    outstanding: 0,
    awaitingQuantity: 0,
    refunded: 0,
  };

  for (const b of bundle.bookings ?? []) {
    const pay = b.payment_status ?? "unpaid";
    const price = b.price ?? 0;

    if (pay === "refunded") {
      sum.refunded += price;
      continue;
    }
    if (isDeadBooking(b)) continue;

    sum.committed += price;
    if (pay === "paid" || pay === "disputed") sum.inEscrow += price;
    else if (pay === "released") sum.released += price;
    else if (b.status === "approved") {
      if (b.price_pending_quantity) sum.awaitingQuantity += price;
      else sum.outstanding += price;
    }
  }
  return sum;
}

// ── Schedule ─────────────────────────────────────────────────────────
//
// Every booking carries a required time_start/time_end and its own location,
// none of which the app showed anywhere — so a host couldn't say what time the
// photographer arrives without asking. This turns the bookings into a run
// sheet: the day, in order, with who's coming and where.

export interface ScheduleEntry {
  booking: BundleBooking;
  /** Minutes past midnight, or null when the time can't be read. */
  startMinutes: number | null;
  start: string | null;
  end: string | null;
}

export interface ScheduleDay {
  dateIso: string;
  entries: ScheduleEntry[];
  /** Vendors who have checked in at the venue. */
  arrived: number;
  /** Vendors expected — the ones a check-in could come from. */
  expected: number;
  /**
   * False when the day's times can't be trusted: all identical, or all
   * midnight. Bookings are created with a required time, so an unset one
   * arrives as a default rather than as nothing, and a run sheet that laid
   * five vendors on top of each other at 12:00am would invent a schedule
   * nobody entered. The day still lists its vendors, just without clock times.
   */
  timesKnown: boolean;
}

/** "18:00", "18:00:00", "6:00 PM" → minutes past midnight. Null if unreadable. */
export function parseTime(raw?: string | null): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!m) return null;
  let hours = Number(m[1]);
  const mins = Number(m[2]);
  if (hours > 23 || mins > 59) return null;
  const suffix = m[3]?.toLowerCase();
  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;
  return hours * 60 + mins;
}

function clock(raw?: string | null): string | null {
  const mins = parseTime(raw);
  if (mins == null) return null;
  const d = new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Every date this bundle touches, each with its bookings in time order. */
export function scheduleFor(bundle: BundleDetail): ScheduleDay[] {
  const byDate = new Map<string, BundleBooking[]>();

  for (const b of bundle.bookings ?? []) {
    if (isDeadBooking(b)) continue;
    const date = b.date_iso;
    if (!date || date === "TBD") continue;
    // A booking spanning days belongs to each of them — a three-day tent hire
    // should appear on all three, not only the day it started.
    for (const day of daysBetween(date, b.date_end)) {
      const list = byDate.get(day);
      if (list) list.push(b);
      else byDate.set(day, [b]);
    }
  }

  return [...byDate.entries()]
    .map(([dateIso, bookings]) => {
      const entries: ScheduleEntry[] = bookings
        .map((booking) => ({
          booking,
          startMinutes: parseTime(booking.time_start),
          start: clock(booking.time_start),
          end: clock(booking.time_end),
        }))
        .sort((a, b) => (a.startMinutes ?? 1e9) - (b.startMinutes ?? 1e9));

      const starts = entries.map((e) => e.startMinutes);
      const known =
        starts.some((s) => s != null) &&
        !starts.every((s) => s === 0) &&
        new Set(starts).size > 1;

      return {
        dateIso,
        entries,
        arrived: bookings.filter((b) => b.vendor_checked_in_at).length,
        expected: bookings.length,
        timesKnown: known,
      };
    })
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

/** Inclusive list of ISO days from `start` to `end`, capped so a bad range can't run away. */
function daysBetween(start: string, end?: string | null): string[] {
  if (!end || end === "TBD" || end === start) return [start];
  const from = Date.parse(`${start}T00:00:00`);
  const to = Date.parse(`${end}T00:00:00`);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return [start];
  const days: string[] = [];
  for (let t = from; t <= to && days.length < 31; t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

// ── Categories the plan is still missing ─────────────────────────────

/**
 * Categories the host said they needed that nothing live covers.
 *
 * Read off the event's own services_needed, so this is a comparison against
 * what they asked for rather than a guess at what a wedding "should" have.
 */
export function missingCategories(
  servicesNeeded: string[] | null | undefined,
  bundles: BundleDetail[],
): string[] {
  if (!servicesNeeded?.length) return [];
  const covered = new Set<string>();
  for (const bundle of bundles) {
    for (const b of bundle.bookings ?? []) {
      if (isDeadBooking(b)) continue;
      if (b.service_category) covered.add(b.service_category.toLowerCase());
      if (b.service_subcategory) covered.add(b.service_subcategory.toLowerCase());
    }
  }
  return servicesNeeded.filter((c) => !covered.has(c.toLowerCase()));
}
