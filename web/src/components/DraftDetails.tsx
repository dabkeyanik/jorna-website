"use client";

// The form that makes a draft sendable.
//
// It exists because the event editor couldn't do this job. That one writes to
// the event, and a draft straight out of the builder may have no event at all —
// so on exactly the bundles that need details most, there was nowhere to put
// them. PATCH /bookings/{id} takes date, location, guest count and times, which
// is the whole of what bookingGaps checks, so the details are written onto the
// bookings themselves. The event is updated too when there is one, so the two
// don't disagree.
//
// Only what's missing is asked for. A plan of flat-rate services is never asked
// for a headcount, and per-hour times are asked for on the one booking that
// needs them rather than across the plan.

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { updateBooking, updateEvent } from "@/lib/jorna";
import {
  formatAddress,
  isCompleteAddress,
  parseAddress,
  zipFromVenue,
  type Address,
} from "@/lib/address";
import {
  bookingGaps,
  isDeadBooking,
  sendReadiness,
  type BookingGapField,
} from "@/lib/planning";
import type { BundleDetail, BundleBooking } from "@/lib/types";
import { AddressFields } from "@/components/AddressFields";
import { Button, Card, Field } from "@/components/ui";

export function DraftDetails({
  bundle,
  onSaved,
}: {
  bundle: BundleDetail;
  onSaved: () => void | Promise<void>;
}) {
  const readiness = sendReadiness(bundle);
  const live = (bundle.bookings ?? []).filter((b) => !isDeadBooking(b));

  const needs = (field: BookingGapField) =>
    readiness.blocked.some((r) => r.gaps.some((g) => g.field === field));

  // Seed from whatever is already known — the event, then any booking that has
  // an answer, so a partly-filled plan doesn't ask again from scratch.
  const seedDate =
    bundle.event?.date_iso && bundle.event.date_iso !== "TBD"
      ? bundle.event.date_iso
      : (live.find((b) => b.date_iso && b.date_iso !== "TBD")?.date_iso ?? "");
  const seedLocation =
    bundle.event?.location || live.find((b) => b.location)?.location || "";
  const venueZip = zipFromVenue(
    live.filter((b) => b.service_category === "venue").map((b) => b.location),
  );

  const [date, setDate] = useState(seedDate);
  const [addr, setAddr] = useState<Address>(() => {
    const parsed = parseAddress(seedLocation);
    return parsed.zip || !venueZip ? parsed : { ...parsed, zip: venueZip };
  });
  const [guests, setGuests] = useState(
    bundle.event?.guest_count != null ? String(bundle.event.guest_count) : "",
  );
  // Per-hour bookings each want their own start and end.
  const hourly = live.filter((b) =>
    bookingGaps(b, bundle.event).some((g) => g.field === "hours"),
  );
  const [times, setTimes] = useState<Record<string, { start: string; end: string }>>(() =>
    Object.fromEntries(
      hourly.map((b) => [
        b.booking_id,
        { start: b.time_start ?? "", end: b.time_end ?? "" },
      ]),
    ),
  );

  const [busy, setBusy] = useState(false);
  const [showGaps, setShowGaps] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (readiness.canSend) return null;

  async function save() {
    setError(null);
    if (needs("location") && !isCompleteAddress(addr)) {
      setShowGaps(true);
      setError("Add the full address — vendors travel to it.");
      return;
    }
    if (needs("date") && !date) {
      setError("Add the date.");
      return;
    }
    if (needs("guests") && !(Number(guests) > 0)) {
      setError("Add a guest count — something here is priced per person.");
      return;
    }
    for (const b of hourly) {
      const t = times[b.booking_id];
      if (!t?.start || !t?.end) {
        setError(`Add start and end times for ${b.service_name || "the hourly service"}.`);
        return;
      }
    }

    setBusy(true);
    try {
      const location = isCompleteAddress(addr) ? formatAddress(addr) : undefined;
      const count = Number(guests) > 0 ? Number(guests) : undefined;

      // Written onto every live booking, because that's what a vendor is sent
      // and what the send check reads.
      await Promise.all(
        live.map((b) =>
          updateBooking(b.booking_id, {
            ...(date ? { date_iso: date } : {}),
            ...(location ? { location } : {}),
            ...(count != null ? { guest_count: count } : {}),
            ...(times[b.booking_id]?.start
              ? {
                  time_start: times[b.booking_id].start,
                  time_end: times[b.booking_id].end,
                }
              : {}),
          }),
        ),
      );

      // And onto the event when there is one, so the dashboard and the run sheet
      // read the same answers.
      if (bundle.event?.event_id) {
        await updateEvent(bundle.event.event_id, {
          ...(date ? { date_iso: date } : {}),
          ...(location ? { location } : {}),
          ...(count != null ? { guest_count: count } : {}),
        }).catch(() => {});
      }

      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save those details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4 p-5">
      <h2 className="serif text-lg text-ink">Before this can be sent</h2>
      <p className="mt-1 text-sm text-ink-soft">
        These go to every vendor in the plan.
      </p>

      <div className="mt-4 grid gap-4">
        {needs("date") ? (
          <Field
            label="Event date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        ) : null}

        {needs("guests") ? (
          <Field
            label="Guest count"
            type="number"
            min={1}
            placeholder="200"
            hint="Something in this plan is priced per person."
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          />
        ) : null}

        {needs("location") ? (
          <div>
            <p className="mb-2 text-sm font-medium text-ink-soft">Where it&apos;s happening</p>
            <AddressFields
              value={addr}
              onChange={setAddr}
              showGaps={showGaps}
              zipHint={venueZip && venueZip === addr.zip ? venueZip : null}
            />
          </div>
        ) : null}

        {hourly.map((b: BundleBooking) => (
          <div key={b.booking_id}>
            <p className="mb-2 text-sm font-medium text-ink-soft">
              {b.service_name || "Hourly service"} — charged by the hour
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Starts"
                type="time"
                value={times[b.booking_id]?.start ?? ""}
                onChange={(e) =>
                  setTimes((t) => ({
                    ...t,
                    [b.booking_id]: { ...t[b.booking_id], start: e.target.value },
                  }))
                }
              />
              <Field
                label="Ends"
                type="time"
                value={times[b.booking_id]?.end ?? ""}
                onChange={(e) =>
                  setTimes((t) => ({
                    ...t,
                    [b.booking_id]: { ...t[b.booking_id], end: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <Button disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save details"}
        </Button>
      </div>
    </Card>
  );
}
