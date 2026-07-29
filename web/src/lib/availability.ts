// "Is this vendor free on this date?" for the Marketplace's date filter.
//
// /vendors/search has no date parameter, so the date filter can't be served by
// the search itself. What exists is GET /vendors/{id}/availability, which is
// public and takes a start/end date — so a chosen date is applied by asking
// that endpoint about the vendors already on screen.
//
// Two things to know:
//
// 1. The endpoint's response is untyped in the backend's OpenAPI schema
//    (`schema: {}`), and every vendor currently returns it empty:
//    { baseline_hours_map: {}, internal_busy_times: [], google_busy_times: [] }.
//    So the field shapes below are inferred, not observed. baseline_hours_map is
//    read under both plausible keyings (day-of-week and ISO date) because
//    availability is *stored* weekly (AvailabilitySlot.day_of_week) but the
//    endpoint is *queried* by date.
//
// 2. Because of (1), this fails open: a vendor is hidden only on positive
//    evidence of a conflict. An empty, unparseable, or failed response leaves
//    them visible. A wrong guess about the shape therefore costs a filter that
//    doesn't narrow — never one that wrongly hides vendors.
//
// Consequence worth stating plainly: with no vendor publishing hours and no
// bookings on the books, this filter excludes nobody today. It starts having an
// effect the moment vendors set availability or get booked.

import { getVendorAvailability } from "./jorna";
import type { VendorAvailability } from "./types";

/** Local start/end instants for a "YYYY-MM-DD" calendar date. */
function dayBounds(iso: string): { start: number; end: number } | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(start.getTime())) return null;
  return { start: start.getTime(), end: start.getTime() + 24 * 60 * 60 * 1000 };
}

/** AvailabilitySlot.day_of_week counts from Monday (see WEEKDAYS); Date does not. */
function mondayIndex(iso: string): number | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : (date.getDay() + 6) % 7;
}

function overlapsDay(range: unknown, bounds: { start: number; end: number }): boolean {
  if (!range || typeof range !== "object") return false;
  const r = range as Record<string, unknown>;
  // Seen as start/end elsewhere in this API; start_time/end_time is the shape
  // AvailabilitySlot uses, so accept either.
  const rawStart = r.start ?? r.start_time ?? r.from;
  const rawEnd = r.end ?? r.end_time ?? r.to;
  if (typeof rawStart !== "string" || typeof rawEnd !== "string") return false;
  const start = Date.parse(rawStart);
  const end = Date.parse(rawEnd);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start < bounds.end && end > bounds.start;
}

/** An "HH:MM"–"HH:MM" window on a given day, as local instants. */
export interface TimeWindow {
  start: string;
  end: string;
}

function windowBounds(
  dateIso: string,
  window: TimeWindow | null | undefined,
): { start: number; end: number } | null {
  const day = dayBounds(dateIso);
  if (!day || !window?.start || !window?.end) return day;

  const at = (hhmm: string): number | null => {
    const [h, m] = hhmm.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return day.start + (h * 60 + m) * 60_000;
  };
  const start = at(window.start);
  let end = at(window.end);
  if (start == null || end == null) return day;
  // Ends at or before it starts — it runs past midnight, the same reading the
  // backend's conflict check uses.
  if (end <= start) end += 24 * 60 * 60 * 1000;
  return { start, end };
}

/**
 * Whether `availability` shows a conflict on `dateIso` ("YYYY-MM-DD").
 * Returns false — free — whenever the answer can't be established.
 *
 * With a `window`, only busy blocks overlapping those hours count. A vendor's
 * day isn't a single booking: one with a morning ceremony can take an evening
 * reception, and asking whole-day questions dropped them from the results.
 * Without one the question stays whole-day, because a search that hasn't said
 * when can't be told that the afternoon would have done.
 */
export function hasConflictOn(
  availability: VendorAvailability,
  dateIso: string,
  window?: TimeWindow | null,
): boolean {
  const bounds = windowBounds(dateIso, window);
  if (!bounds) return false;

  const busy = [
    ...(availability.internal_busy_times ?? []),
    ...(availability.google_busy_times ?? []),
  ];
  if (busy.some((b) => overlapsDay(b, bounds))) return true;

  // A published weekly schedule that omits this day means the vendor doesn't
  // work it. An absent or empty map states nothing, so it isn't a conflict.
  const hours = availability.baseline_hours_map;
  if (!hours || typeof hours !== "object" || Object.keys(hours).length === 0) return false;

  const dow = mondayIndex(dateIso);
  const entry = hours[dateIso] ?? (dow == null ? undefined : hours[String(dow)]);
  // The map is keyed some way this code doesn't recognise — say nothing.
  if (entry === undefined) return false;
  return Array.isArray(entry) ? entry.length === 0 : !entry;
}

// One request per vendor is the only way to apply a date, and the caller can
// hold a poolful (QUERY_POOL = 100). Going wide all at once would put a burst
// that size on the backend for a single keystroke, so they go a window at a time.
const CONCURRENCY = 8;

/**
 * Vendor ids from `vendorIds` that are free on `dateIso`. Vendors whose
 * availability can't be fetched are treated as free.
 */
export async function freeVendorIds(
  vendorIds: string[],
  dateIso: string,
  window?: TimeWindow | null,
): Promise<Set<string>> {
  const free = new Set<string>(vendorIds);
  const queue = [...vendorIds];

  async function worker() {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        const availability = await getVendorAvailability(id, dateIso, dateIso);
        if (hasConflictOn(availability, dateIso, window)) free.delete(id);
      } catch {
        // Unreachable or erroring — leave the vendor visible.
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
  );
  return free;
}
