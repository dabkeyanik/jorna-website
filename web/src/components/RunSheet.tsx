"use client";

// The run sheet — the celebration's day, in order.
//
// Every booking is created with a required time_start/time_end and its own
// location, and none of it was shown anywhere: a host couldn't say what time the
// photographer arrives, or that the mehndi artist is coming to the house while
// everyone else is at the hall. This lays each date out in time order.
//
// On the day it doubles as an arrivals board. vendor_checked_in_at is already
// recorded (the vendor's GPS check-in) and was likewise invisible to the person
// who most wants it — the host standing in a hall wondering who's turned up.
//
// It appears in the week before the first day and not until then. Both of those
// jobs are same-week jobs; months out it was a second copy of the vendor list,
// above the parts of the page a host can still do something about.
//
// Times are shown only when the day's look real. Bookings can't be created
// without a time, so an unset one arrives as a default rather than as nothing —
// see ScheduleDay.timesKnown. When they don't, the vendors still list, without
// invented clock times.

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { resendCheckInEmail } from "@/lib/jorna";
import { categoryLabel, formatCheckInTime, type BundleBooking } from "@/lib/types";
import { daysUntil, runSheetIsDue, scheduleFor, type ScheduleDay } from "@/lib/planning";
import type { BundleDetail } from "@/lib/types";
import { Avatar } from "@/components/ui";

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function relative(iso: string): string | null {
  const n = daysUntil(iso);
  if (n == null) return null;
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 0) return n === -1 ? "Yesterday" : `${Math.abs(n)} days ago`;
  return `in ${n} days`;
}

function Arrivals({ day }: { day: ScheduleDay }) {
  const n = daysUntil(day.dateIso);
  // Only meaningful around the event itself — a check-in count is noise while
  // the day is still months out.
  if (n == null || n > 1 || n < -2 || day.expected === 0) return null;

  const all = day.arrived === day.expected;
  return (
    <div
      className={`mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
        all ? "bg-green/12" : "bg-gold/12"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${all ? "bg-green" : "bg-gold"}`}
      />
      <p className={`text-sm font-medium ${all ? "text-green" : "text-ink"}`}>
        {day.arrived} of {day.expected} vendors checked in
        {all ? " — everyone's here." : ""}
      </p>
    </div>
  );
}

/**
 * Nudge one vendor who hasn't checked in.
 *
 * Per booking, because that's the shape of the problem on the day: four vendors
 * are here and the fifth isn't. It lives on the run sheet rather than with the
 * plan's other buttons because this is where their absence is visible — a row
 * with no "Here" against it.
 *
 * Offered strictly on the backend's own answer. can_resend_checkin already
 * accounts for the cooldown, whether they've arrived, whether there's anywhere
 * to check in against, and how close the day is; second-guessing any of that
 * here would only produce a button that gets refused.
 */
function Nudge({ booking }: { booking: BundleBooking }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (booking.vendor_checked_in_at) return null;
  if (!booking.can_resend_checkin) {
    // Nothing to press, but "sent four minutes ago" is worth saying — a button
    // that quietly disappears into its cooldown reads as one that didn't work.
    if (note) return <p className="mt-1 text-xs text-green">{note}</p>;
    const cooling = booking.resend_checkin_reason?.startsWith("Just sent");
    return cooling ? (
      <p className="mt-1 text-xs text-ink-faint">{booking.resend_checkin_reason}</p>
    ) : null;
  }

  async function send() {
    setBusy(true);
    try {
      const result = await resendCheckInEmail(booking.booking_id);
      setNote(result.message);
    } catch (err) {
      setNote(
        err instanceof ApiError ? err.message : "Couldn't send it. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (note) return <p className="mt-1 text-xs text-green">{note}</p>;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={send}
      className="mt-1 text-xs font-semibold text-gold transition hover:underline disabled:opacity-50"
    >
      {busy ? "Sending…" : "Resend check-in email"}
    </button>
  );
}

function Entry({
  booking,
  start,
  end,
  showTimes,
}: {
  booking: BundleBooking;
  start: string | null;
  end: string | null;
  showTimes: boolean;
}) {
  const here = Boolean(booking.vendor_checked_in_at);
  return (
    <li className="flex gap-3 border-l-2 border-line-soft py-3 pl-4">
      {showTimes ? (
        <span className="w-20 shrink-0 pt-0.5 text-sm tabular-nums text-ink-soft">
          {start ?? "—"}
          {end ? <span className="block text-xs text-ink-faint">to {end}</span> : null}
        </span>
      ) : null}

      <Avatar name={booking.vendor_name} size={32} />

      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{booking.service_name || "Service"}</p>
        <p className="text-sm text-ink-soft">
          {booking.vendor_name}
          {booking.service_category
            ? ` · ${categoryLabel(booking.service_subcategory || booking.service_category)}`
            : ""}
        </p>
        {booking.location ? (
          <p className="mt-0.5 text-xs text-ink-faint">{booking.location}</p>
        ) : null}
        <Nudge booking={booking} />
      </div>

      {here ? (
        <span
          className="shrink-0 self-start rounded-full bg-green/12 px-2.5 py-0.5 text-xs font-medium text-green"
          title={
            formatCheckInTime(booking.vendor_checked_in_at)
              ? `Checked in ${formatCheckInTime(booking.vendor_checked_in_at)}`
              : undefined
          }
        >
          Here
        </span>
      ) : null}
    </li>
  );
}

export function RunSheet({ bundle }: { bundle: BundleDetail }) {
  const days = scheduleFor(bundle);
  // Held back until the week of — see runSheetIsDue. Nothing here helps a host
  // whose celebration is months away, and it was pushing what does further down.
  if (!runSheetIsDue(days)) return null;

  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-3">The day</h2>
      <div className="grid gap-4">
        {days.map((day) => (
          <div
            key={day.dateIso}
            className="rounded-2xl border border-card-edge bg-card p-5 shadow-[var(--shadow-card)]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="serif text-lg text-ink">{dayLabel(day.dateIso)}</h3>
              <span className="text-sm text-ink-faint">{relative(day.dateIso)}</span>
            </div>

            <Arrivals day={day} />

            {!day.timesKnown ? (
              <p className="mt-3 text-xs text-ink-faint">
                No times set on these bookings yet — add them so everyone knows when
                to arrive.
              </p>
            ) : null}

            <ul className="mt-2">
              {day.entries.map((entry) => (
                <Entry
                  key={entry.booking.booking_id}
                  booking={entry.booking}
                  start={entry.start}
                  end={entry.end}
                  showTimes={day.timesKnown}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
