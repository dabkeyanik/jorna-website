"use client";

// The vendor's side of the planning rules — what needs them, where their money
// is, what's on today, and why they aren't getting booked.
//
// Same arrangement as lib/planning on the client side: the rules live here, and
// both the dashboard and lib/attention's badge read them, so the two can't tell
// a vendor different things. Every rule mirrors a backend guard.

import {
  eventIsOver,
  type AvailabilitySlot,
  type Earnings,
  type ServiceItem,
  type StripeStatus,
  type VendorBooking,
  type VendorDetail,
} from "./types";

export type VendorTaskKind =
  /** No Stripe: they can be booked and still never be paid. */
  | "stripe"
  /** A client is waiting on a yes or no. */
  | "request"
  /** Their own payout is blocked on this. */
  | "confirm"
  | "check-in";

export interface VendorTask {
  id: string;
  kind: VendorTaskKind;
  title: string;
  detail: string;
  cta: string;
  tone: "alarm" | "urgent" | "normal";
  bookingId?: string;
}

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function plainMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

/** "2026-09-05" → "5 Sep 2026". A raw ISO date in a sentence reads like a log line. */
function niceDate(iso?: string | null): string | null {
  if (!iso || iso === "TBD") return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// ── Getting paid at all ──────────────────────────────────────────────

/**
 * Stripe's field names, in words a vendor standing in their kitchen can act on.
 *
 * Several keys are one real-world errand — a date of birth arrives as three
 * separate fields, an address as four — so they map to the same phrase and the
 * caller dedupes. Anything unmapped degrades to a readable version of the key
 * rather than being dropped: a vendor told "Stripe still needs your
 * business_profile.mcc" can at least search for it, where a vendor told nothing
 * has to guess.
 */
const REQUIREMENT_LABELS: Record<string, string> = {
  "individual.id_number": "your ID number",
  "individual.ssn_last_4": "the last 4 digits of your SSN",
  "individual.verification.document": "a photo of your ID",
  "individual.verification.additional_document": "a second form of ID",
  "individual.dob.day": "your date of birth",
  "individual.dob.month": "your date of birth",
  "individual.dob.year": "your date of birth",
  "individual.first_name": "your name",
  "individual.last_name": "your name",
  "individual.email": "your email address",
  "individual.phone": "your phone number",
  "individual.address.line1": "your address",
  "individual.address.city": "your address",
  "individual.address.state": "your address",
  "individual.address.postal_code": "your address",
  external_account: "your bank account",
  "business_profile.url": "your website",
  "business_profile.mcc": "your business category",
  "company.tax_id": "your tax ID",
  "tos_acceptance.date": "your acceptance of Stripe's terms",
  "tos_acceptance.ip": "your acceptance of Stripe's terms",
};

export function requirementLabel(key: string): string {
  return REQUIREMENT_LABELS[key] ?? key.split(".").pop()!.replace(/_/g, " ");
}

/** "a", "a and b", "a, b and c" — a sentence, not a bullet list. */
function sentenceList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export type PaymentsState =
  /** Couldn't be read. An unknown isn't an alarm. */
  | "unknown"
  | "ready"
  /** No Stripe account at all. */
  | "not-started"
  /** They opened Stripe's form and didn't reach the end. */
  | "unfinished"
  /** They finished it, and Stripe has since asked for more. */
  | "needs-more"
  /** Stripe is verifying. Nothing for them to do but wait. */
  | "under-review";

export interface PaymentsSetup {
  state: PaymentsState;
  /** Whether money can reach them right now. */
  ready: boolean;
  title: string;
  detail: string;
  cta: string;
  /** "needs-more" and a lapsed account are alarms; waiting on Stripe isn't. */
  tone: "alarm" | "normal";
}

/**
 * The one reading of a vendor's payment setup, for every screen that mentions it.
 *
 * There were four, and they all assumed the only way to be unpayable was never
 * to have finished — because that was the only way the old completeness flag
 * could be false. It can now go false on an account that was live for months,
 * when Stripe withdraws a payout capability and asks for something new. Told
 * "payment setup incomplete", that vendor goes looking for a setup step they
 * finished long ago and finds nothing wrong.
 */
export function paymentsSetup(status: StripeStatus | null): PaymentsSetup {
  if (!status) {
    return {
      state: "unknown",
      ready: false,
      title: "Payment setup",
      detail: "We couldn't reach Stripe just now.",
      cta: "Check payment setup",
      tone: "normal",
    };
  }

  if (status.stripe_onboarding_complete) {
    return {
      state: "ready",
      ready: true,
      title: "Payments are set up",
      detail: "You're ready to be booked and paid.",
      cta: "Manage payments",
      tone: "normal",
    };
  }

  if (!status.stripe_account_id) {
    return {
      state: "not-started",
      ready: false,
      title: "Set up payments",
      detail:
        "Clients can't pay you until Stripe has your details — a booking can be accepted, but checkout will refuse. It takes a few minutes.",
      cta: "Set up payments",
      tone: "alarm",
    };
  }

  if (!status.details_submitted) {
    return {
      state: "unfinished",
      ready: false,
      title: "Finish your payment setup",
      detail:
        "You started with Stripe but didn't get to the end. Until you do, a client can book you and checkout will refuse.",
      cta: "Continue payment setup",
      tone: "alarm",
    };
  }

  const owed = Array.from(
    new Set((status.requirements_due ?? []).map(requirementLabel)),
  );

  if (owed.length) {
    return {
      state: "needs-more",
      ready: false,
      title: "Stripe needs one more thing",
      detail: `Your details are in, but Stripe still wants ${sentenceList(owed)}. Until it has that, nothing can be paid out to you.`,
      cta: "Give Stripe what it needs",
      tone: "alarm",
    };
  }

  if (status.pending_verification) {
    return {
      state: "under-review",
      ready: false,
      title: "Stripe is checking your details",
      // Nothing is asked of them, because nothing they can do would help. A
      // vendor sent to press a button would come back to the same screen.
      detail:
        "Nothing for you to do — payouts open when Stripe finishes. Bookings you accept in the meantime can't be paid for yet.",
      cta: "Check with Stripe",
      tone: "normal",
    };
  }

  // Payouts are off and Stripe hasn't named a reason we can act on. Say the
  // consequence, which is the part that's certainly true.
  return {
    state: "needs-more",
    ready: false,
    title: "Payouts are on hold",
    detail:
      "Stripe isn't paying out on your account at the moment. Opening it will show you what it needs.",
    cta: "Open Stripe",
    tone: "alarm",
  };
}

/** A booking that no longer counts toward anything. */
export function isDeadVendorBooking(b: VendorBooking): boolean {
  return (
    ["rejected", "cancelled"].includes(b.status) ||
    (b.payment_status ?? "unpaid") === "refunded"
  );
}

/**
 * What the vendor still has to do.
 *
 * Stripe comes first and usually alone in its tone: every other task is a job
 * to get on with, that one is money quietly not arriving. Pass `stripe` as null
 * when it couldn't be checked — an unknown isn't an alarm, and isn't a task.
 *
 * The wording is paymentsSetup's, not this function's, so the badge, the
 * dashboard and the earnings page can't describe the same account differently.
 */
export function vendorTasks(
  bookings: VendorBooking[],
  stripe: StripeStatus | null,
): VendorTask[] {
  const tasks: VendorTask[] = [];

  const payments = paymentsSetup(stripe);
  if (stripe && !payments.ready) {
    tasks.push({
      id: "stripe",
      kind: "stripe",
      title: payments.title,
      detail: payments.detail,
      cta: payments.cta,
      tone: payments.tone,
    });
  }

  for (const b of bookings) {
    if (isDeadVendorBooking(b)) continue;
    const service = b.service_name || "a service";
    const client = b.client_name || "A client";

    // Someone is waiting on an answer.
    if (b.status === "pending") {
      tasks.push({
        id: `request-${b.booking_id}`,
        kind: "request",
        title: `${client} wants to book ${service}`,
        detail: niceDate(b.date_iso)
          ? `For ${niceDate(b.date_iso)} · ${plainMoney(b.price)}`
          : "Date to be confirmed",
        cta: "Answer",
        tone: "urgent",
        bookingId: b.booking_id,
      });
      continue;
    }

    // Paid, but the vendor's half of the release is outstanding — this is their
    // own money waiting. Mirrors lib/attention, which had these rules first.
    if ((b.payment_status ?? "unpaid") === "paid" && !b.vendor_confirmed_at) {
      // The anchor the server will actually measure against — a booked venue's
      // pin, or the event's own address when the plan has no venue. Gating on
      // venue_latitude alone meant a wedding in a family hall offered nobody a
      // check-in, so the vendor's payout waited on a confirmation that had no
      // way of being given.
      const atVenue = b.checkin_latitude != null && b.checkin_longitude != null;
      const canAct = atVenue || eventIsOver(b);
      if (canAct) {
        tasks.push({
          id: `release-${b.booking_id}`,
          kind: atVenue ? "check-in" : "confirm",
          title: atVenue
            ? `Check in at the venue for ${service}`
            : `Confirm ${service} happened`,
          detail: `${client} — your payout is waiting on this.`,
          cta: atVenue ? "Check in" : "Confirm",
          tone: "urgent",
          bookingId: b.booking_id,
        });
      }
    }
  }

  const rank = { alarm: 0, urgent: 1, normal: 2 };
  tasks.sort((a, b) => rank[a.tone] - rank[b.tone]);
  return tasks;
}

// ── Money ────────────────────────────────────────────────────────────

export interface VendorMoney {
  releasedCents: number;
  inEscrowCents: number;
  upcomingCents: number;
  upcomingCount: number;
  disputedCents: number;
  refundedCents: number;
  feesCents: number;
  /**
   * The platform's actual cut, as a percentage, worked out from what it has
   * taken. The API publishes no rate — only a per-booking `platform_fee_cents`
   * — so a hardcoded "10%" would be a guess that goes quietly wrong the day it
   * changes. Null until there's a booking to derive it from.
   */
  feePercent: number | null;
}

export function vendorMoney(e: Earnings | null): VendorMoney | null {
  if (!e) return null;
  const gross = (e.history ?? []).reduce((n, h) => n + (h.amount_cents ?? 0), 0);
  const fees = (e.history ?? []).reduce((n, h) => n + (h.platform_fee_cents ?? 0), 0);
  return {
    releasedCents: e.total_released_cents ?? 0,
    inEscrowCents: e.in_escrow_cents ?? 0,
    upcomingCents: e.upcoming_cents ?? 0,
    upcomingCount: e.upcoming_count ?? 0,
    disputedCents: e.disputed_cents ?? 0,
    refundedCents: e.refunded_cents ?? 0,
    feesCents: e.platform_fees_cents ?? 0,
    feePercent: gross > 0 ? Math.round((fees / gross) * 1000) / 10 : null,
  };
}

export { money as centsToMoney };

// ── Jobs ─────────────────────────────────────────────────────────────

export interface VendorJob {
  booking: VendorBooking;
  dateIso: string;
  isToday: boolean;
  isPast: boolean;
}

/** Days until an ISO date; negative once past, null when unusable. */
export function daysUntil(iso?: string | null): number | null {
  if (!iso || iso === "TBD") return null;
  const day = Date.parse(`${iso}T00:00:00`);
  if (Number.isNaN(day)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((day - today.getTime()) / 86_400_000);
}

/**
 * Confirmed work, soonest first, with anything already past dropped — a vendor's
 * "next jobs" is a list of places to be, not a history.
 */
export function vendorJobs(bookings: VendorBooking[]): VendorJob[] {
  return bookings
    .filter((b) => !isDeadVendorBooking(b) && b.status !== "pending")
    .map((b) => {
      const n = daysUntil(b.date_end || b.date_iso);
      return {
        booking: b,
        dateIso: b.date_iso ?? "",
        isToday: daysUntil(b.date_iso) === 0,
        isPast: n != null && n < 0,
      };
    })
    .filter((j) => j.dateIso && j.dateIso !== "TBD" && !j.isPast)
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

/**
 * What's ahead, for the calendar's side list.
 *
 * Deliberately not `vendorJobs`, which drops anything still "pending" because
 * the dashboard lists those separately under Requests. On the calendar that
 * exclusion showed as a hole: a day tinted gold with "Tentative" in the legend
 * beside it, and nothing in the list to click. Everything the grid marks is
 * here, carrying which of the two it is so the list and the tint agree.
 *
 * Anchored on the last day, so a booking running across today is still ahead of
 * you rather than behind.
 */
export function upcomingOnCalendar(
  bookings: VendorBooking[],
): { booking: VendorBooking; dateIso: string; status: DayStatus; isToday: boolean }[] {
  return bookings
    .filter((b) => !isDeadVendorBooking(b))
    .map((b) => ({
      booking: b,
      dateIso: b.date_iso ?? "",
      status: statusOfBooking(b),
      isToday: daysUntil(b.date_iso) === 0,
      lastDay: daysUntil(b.date_end || b.date_iso),
    }))
    .filter(
      (j) =>
        j.dateIso &&
        j.dateIso !== "TBD" &&
        j.status !== "free" &&
        j.lastDay != null &&
        j.lastDay >= 0,
    )
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso))
    .map(({ booking, dateIso, status, isToday }) => ({
      booking,
      dateIso,
      status,
      isToday,
    }));
}

/** Requests awaiting an answer, soonest event first. */
export function vendorRequests(bookings: VendorBooking[]): VendorBooking[] {
  return bookings
    .filter((b) => b.status === "pending" && !isDeadVendorBooking(b))
    .sort((a, b) => (a.date_iso ?? "").localeCompare(b.date_iso ?? ""));
}

// ── Listing health ───────────────────────────────────────────────────

export interface HealthIssue {
  id: string;
  issue: string;
  /** What it costs them — the reason to bother fixing it. */
  consequence: string;
  cta: string;
  href: string;
  severity: "critical" | "warning";
}

/**
 * Concrete reasons a vendor isn't getting booked. Not a score: every row is a
 * thing that is switched off, and the consequence is the one it actually has.
 */
export function listingHealth(opts: {
  vendor: VendorDetail | null;
  services: ServiceItem[];
  availability: AvailabilitySlot[];
  stripe: StripeStatus | null;
}): HealthIssue[] {
  const { vendor, services, availability, stripe } = opts;
  const issues: HealthIssue[] = [];

  const payments = paymentsSetup(stripe);
  if (stripe && !payments.ready) {
    issues.push({
      id: "stripe",
      issue: payments.title,
      consequence: "Clients can book you, but no payment can reach you.",
      cta: payments.cta,
      href: "/my-earnings",
      // Waiting on Stripe's own review isn't something they're failing at.
      severity: payments.tone === "alarm" ? "critical" : "warning",
    });
  }

  if (services.length === 0) {
    issues.push({
      id: "no-services",
      issue: "You have no services listed",
      consequence: "There's nothing for a host to book, so you won't appear in search.",
      cta: "Add a service",
      href: "/my-services",
      severity: "critical",
    });
  }

  if (availability.length === 0) {
    issues.push({
      id: "no-availability",
      issue: "No weekly hours set",
      consequence:
        "Hosts filtering by a date can't tell whether you're free, so you're easy to skip.",
      cta: "Set hours",
      href: "/my-availability",
      severity: "warning",
    });
  }

  const noPhotos = services.filter((s) => !s.media?.length);
  if (noPhotos.length > 0) {
    const first = noPhotos[0].name || "A service";
    issues.push({
      id: "no-photos",
      issue:
        noPhotos.length === 1
          ? `“${first}” has no photos`
          : `${noPhotos.length} services have no photos`,
      consequence: "A listing with no photo is the one people scroll past.",
      cta: "Add photos",
      href: "/my-services",
      severity: "warning",
    });
  }

  if (vendor && !vendor.bio?.trim()) {
    issues.push({
      id: "no-bio",
      issue: "Your profile has no bio",
      consequence: "Hosts choosing between two vendors read this first.",
      cta: "Write one",
      href: "/vendor-profile",
      severity: "warning",
    });
  }

  if (vendor && vendor.travel_radius_miles == null && !vendor.open_to_long_distance) {
    issues.push({
      id: "no-radius",
      issue: "No travel radius set",
      consequence: "Hosts searching by distance may never see you.",
      cta: "Set radius",
      href: "/vendor-profile",
      severity: "warning",
    });
  }

  return issues;
}

// ── Calendar ─────────────────────────────────────────────────────────
//
// A month of the vendor's work. Bookings carry a date, a start and end time,
// and optionally a date_end, so a multi-day job belongs to every day it covers
// rather than only the one it started on.

/**
 * A day's state, matching the iOS calendar (VendorCalendarView.swift):
 * approved and payment_confirmed read as booked, pending and
 * negotiation_ongoing as tentative, rejected shows as nothing at all.
 */
export type DayStatus = "booked" | "tentative" | "free";

export interface CalendarDay {
  dateIso: string;
  /** Day of the month, 1-31. */
  day: number;
  /** False for the leading/trailing days that pad the grid to whole weeks. */
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  status: DayStatus;
  /** Busy in the vendor's connected Google Calendar, with nothing booked here. */
  googleBusy: boolean;
  bookings: VendorBooking[];
}

/** iOS maps booking status onto the calendar's three states this way. */
export function statusOfBooking(b: VendorBooking): DayStatus {
  if (b.status === "approved" || b.status === "payment_confirmed") return "booked";
  if (b.status === "pending" || b.status === "negotiation_ongoing") return "tentative";
  return "free";
}

/** Booked wins over tentative on a day that holds both. */
export function dayStatus(bookings: VendorBooking[]): DayStatus {
  let seen: DayStatus = "free";
  for (const b of bookings) {
    const s = statusOfBooking(b);
    if (s === "booked") return "booked";
    if (s === "tentative") seen = "tentative";
  }
  return seen;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Inclusive ISO days from `start` to `end`, capped so a bad range can't run away. */
function spanDays(start: string, end?: string | null): string[] {
  if (!end || end === "TBD" || end === start) return [start];
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return [start];
  }
  const days: string[] = [];
  for (const d = new Date(from); d <= to && days.length < 62; d.setDate(d.getDate() + 1)) {
    days.push(isoOf(d));
  }
  return days;
}

/** Every live booking indexed by each day it covers. */
export function bookingsByDay(bookings: VendorBooking[]): Map<string, VendorBooking[]> {
  const byDay = new Map<string, VendorBooking[]>();
  for (const b of bookings) {
    if (isDeadVendorBooking(b)) continue;
    if (!b.date_iso || b.date_iso === "TBD") continue;
    for (const day of spanDays(b.date_iso, b.date_end)) {
      const list = byDay.get(day);
      if (list) list.push(b);
      else byDay.set(day, [b]);
    }
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.time_start ?? "").localeCompare(b.time_start ?? ""));
  }
  return byDay;
}

/**
 * A month as whole weeks starting Monday, so the grid is always 7 wide and the
 * columns line up with WEEKDAYS. `month` is 0-indexed, like Date.
 */
export function calendarMonth(
  bookings: VendorBooking[],
  year: number,
  month: number,
  /** ISO days the vendor's Google Calendar reports as busy. */
  googleBusyDays: Set<string> = new Set(),
): CalendarDay[] {
  const byDay = bookingsByDay(bookings);
  const todayIso = isoOf(new Date());

  const first = new Date(year, month, 1);
  // getDay() counts from Sunday; the grid starts Monday, like WEEKDAYS.
  const lead = (first.getDay() + 6) % 7;
  const cursor = new Date(year, month, 1 - lead);

  const days: CalendarDay[] = [];
  // Six weeks always covers a month, and a fixed height stops the grid jumping
  // as you page through.
  for (let i = 0; i < 42; i++) {
    const iso = isoOf(cursor);
    const dayBookings = byDay.get(iso) ?? [];
    const status = dayStatus(dayBookings);
    days.push({
      dateIso: iso,
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === month,
      isToday: iso === todayIso,
      isPast: iso < todayIso,
      status,
      // Only worth saying when nothing of Jorna's own is on that day; a booked
      // day is already accounted for.
      googleBusy: status === "free" && googleBusyDays.has(iso),
      bookings: dayBookings,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
