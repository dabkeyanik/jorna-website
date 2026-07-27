"use client";

// The vendor's side of the planning rules — what needs them, where their money
// is, what's on today, and why they aren't getting booked.
//
// Same arrangement as lib/planning on the client side: the rules live here, and
// both the dashboard and lib/attention's badge read them, so the two can't tell
// a vendor different things. Every rule mirrors a backend guard.

import {
  eventHasPassed,
  type AvailabilitySlot,
  type Earnings,
  type ServiceItem,
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
 * Stripe comes first and alone in its tone: every other task is a job to get
 * on with, that one is money quietly not arriving. Pass `stripeComplete` as
 * null when it couldn't be checked — an unknown isn't an alarm.
 */
export function vendorTasks(
  bookings: VendorBooking[],
  stripeComplete: boolean | null,
): VendorTask[] {
  const tasks: VendorTask[] = [];

  if (stripeComplete === false) {
    tasks.push({
      id: "stripe",
      kind: "stripe",
      title: "Finish your payment setup",
      detail:
        "Clients can book you now, but nothing can be paid out until this is done.",
      cta: "Set up payments",
      tone: "alarm",
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
      const atVenue = b.venue_latitude != null && b.venue_longitude != null;
      const canAct = atVenue || eventHasPassed(b.date_end || b.date_iso);
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
  stripeComplete: boolean | null;
}): HealthIssue[] {
  const { vendor, services, availability, stripeComplete } = opts;
  const issues: HealthIssue[] = [];

  if (stripeComplete === false) {
    issues.push({
      id: "stripe",
      issue: "Payment setup incomplete",
      consequence: "Clients can book you, but no payment can reach you.",
      cta: "Set up payments",
      href: "/my-earnings",
      severity: "critical",
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
