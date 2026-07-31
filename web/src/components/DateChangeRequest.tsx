"use client";

// A client asking to move a booking this vendor has already agreed to.
//
// Lived inside /my-bookings, which made that page the only route to answering
// one: the dashboard could tell a vendor a date change was waiting but not let
// them settle it. Shared, so the answer is wherever the booking is.
//
// Presentational — it reads change_request off the booking the caller already
// has, and fetches nothing. That's why it renders open rather than behind a
// toggle: showing it costs nothing but the space.

import { useState } from "react";
import type { VendorBooking } from "@/lib/types";
import { Button } from "./ui";

function prettyDate(iso?: string | null): string | null {
  if (!iso || iso === "TBD") return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Accepting is the same commitment as accepting the booking was, so the server
 * re-runs the double-booking check and refuses on a clash — naming the booking
 * that clashes, which is what makes the refusal something to act on rather than
 * a wall. Declining is always available and costs the vendor nothing: their
 * booking stays exactly as it was.
 */
export function DateChangeRequest({
  booking,
  busy,
  onAnswer,
}: {
  booking: VendorBooking;
  busy: boolean;
  onAnswer: (accept: boolean, message?: string) => void | Promise<void>;
}) {
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState("");
  const cr = booking.change_request;
  if (!cr) return null;

  const to = prettyDate(cr.date_iso) ?? "a new date";
  const span =
    cr.date_end && cr.date_end !== cr.date_iso ? ` – ${prettyDate(cr.date_end)}` : "";
  const hours = cr.time_start ? `${cr.time_start}–${cr.time_end ?? ""}` : null;

  // Already accepted; the client owes the difference. Nothing for the vendor to
  // do, but its absence would read as their acceptance having been lost.
  if (cr.repriced_amount_cents != null) {
    return (
      <p className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-xs text-ink-soft">
        You&apos;ve accepted {to}
        {span}. It costs more on those dates, so we&apos;re waiting on{" "}
        {booking.client_name || "your client"} to approve the difference.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-gold/50 bg-gold/[0.07] p-3">
      <p className="text-sm font-medium text-ink">
        {booking.client_name || "Your client"} would like to move this to {to}
        {span}
        {hours ? `, ${hours}` : ""}.
      </p>
      {cr.message ? (
        <p className="mt-1 text-xs text-ink-soft">“{cr.message}”</p>
      ) : null}
      <p className="mt-1 text-xs text-ink-faint">
        Your booking stays exactly as it is unless you accept. Declining costs
        you nothing.
      </p>

      {declining ? (
        <div className="mt-3">
          <input
            type="text"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Why? (optional) — e.g. already booked that weekend"
            className="w-full rounded-lg border border-card-edge bg-ground-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="md"
              disabled={busy}
              onClick={() => onAnswer(false, why.trim() || undefined)}
            >
              {busy ? "Sending…" : "Decline the new date"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setDeclining(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="md" disabled={busy} onClick={() => onAnswer(true)}>
            {busy ? "Working…" : "Accept the new date"}
          </Button>
          <Button variant="ghost" size="md" onClick={() => setDeclining(true)}>
            Can&apos;t make it
          </Button>
        </div>
      )}
    </div>
  );
}
