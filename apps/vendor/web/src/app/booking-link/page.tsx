"use client";

// Where a vendor-authored contract link lands (/booking-link?t=…).
//
// The only page in this app with no account behind it, same shape as the
// old RSVP flow this was cloned from — no sign-in, no app, just the token
// in the URL. Built for someone who found this vendor on Instagram or
// WhatsApp and has never heard of Jorna: they fill in their own details,
// read what they're agreeing to, and type their name to sign. Jorna never
// touches the money — see the callout below and docs/DECISIONS.md #13 in
// the backend for why that's the whole trust model here.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  declineGuestBooking,
  fillGuestBookingDetails,
  getGuestBooking,
  guestMarkDepositPaid,
  guestMarkFullPaid,
  signGuestBooking,
} from "@/lib/jorna";
import { Button, Card, Field } from "@/components/ui";
import type { GuestBooking } from "@/lib/types";

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function prettyTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  const hour = Number(m[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${((hour + 11) % 12) + 1}:${m[2]} ${suffix}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-[min(560px,100%-2rem)] py-20 text-center">{children}</div>;
}

function BookingLinkInner() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  // The vendor's own "View as client" (guestBookingPreviewLink): same page,
  // but it mustn't count as the client opening it, or act on their behalf.
  const preview = params.get("preview") === "1";

  const [booking, setBooking] = useState<GuestBooking | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [loadError, setLoadError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [location, setLocation] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [signerName, setSignerName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState<"deposit" | "full" | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getGuestBooking(token, preview)
      .then((b) => {
        if (cancelled) return;
        setBooking(b);
        setGuestName(b.guest_name ?? "");
        setGuestEmail(b.guest_email ?? "");
        setGuestPhone(b.guest_phone ?? "");
        setLocation(b.location === "TBD" ? "" : b.location);
        setGuestCount(b.guest_count?.toString() ?? "");
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? "This booking link isn't valid any more. Ask your vendor for a new one."
            : "Couldn't open this booking. Check your connection and try again.",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, preview]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fillGuestBookingDetails(token, {
        guest_name: guestName.trim() || null,
        guest_email: guestEmail.trim() || null,
        guest_phone: guestPhone.trim() || null,
        location: location.trim() || null,
        guest_count: guestCount ? Number(guestCount) : null,
      });
      const signed = await signGuestBooking(token, signerName);
      setBooking(signed);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't send your reply. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      setBooking(await declineGuestBooking(token, declineReason.trim() || null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function reportPaid(kind: "deposit" | "full") {
    setPaymentBusy(kind);
    setPaymentNotice(null);
    try {
      if (kind === "deposit") await guestMarkDepositPaid(token);
      else await guestMarkFullPaid(token);
      const refreshed = await getGuestBooking(token);
      setBooking(refreshed);
      setPaymentNotice("Marked as paid — your vendor still needs to confirm receiving it.");
    } catch (err) {
      setPaymentNotice(err instanceof ApiError ? err.message : "Couldn't mark that as paid.");
    } finally {
      setPaymentBusy(null);
    }
  }

  if (!token) {
    return (
      <Shell>
        <h1 className="serif text-2xl text-maroon dark:text-gold">Booking link</h1>
        <p className="mt-3 text-ink-soft">
          This link is missing its code. Ask your vendor to send it again.
        </p>
      </Shell>
    );
  }

  if (loading) {
    return <p className="py-20 text-center text-ink-soft">Opening your booking…</p>;
  }

  if (loadError || !booking) {
    return (
      <Shell>
        <h1 className="serif text-2xl text-maroon dark:text-gold">We couldn&apos;t open this</h1>
        <p className="mt-3 text-ink-soft">{loadError}</p>
      </Shell>
    );
  }

  const vendorName = booking.vendor_display_name ?? "your vendor";
  const holdUntil = booking.hold_expires_at
    ? new Date(booking.hold_expires_at).toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;

  if (booking.contract_status === "declined") {
    return (
      <Shell>
        <p className="eyebrow">Declined</p>
        <h1 className="serif mt-2 text-2xl text-maroon dark:text-gold">You turned this offer down</h1>
        <p className="mt-3 text-ink-soft">
          We let {vendorName} know. Nothing was signed and nothing is owed. If you change your
          mind, ask them for a new link.
        </p>
      </Shell>
    );
  }

  // Voided by the vendor. The backend still serves the link so this can say
  // so, instead of the generic "not valid" a dead token gets.
  if (booking.status === "rejected") {
    return (
      <Shell>
        <p className="eyebrow">Withdrawn</p>
        <h1 className="serif mt-2 text-2xl text-maroon dark:text-gold">
          {vendorName} withdrew this booking offer
        </h1>
        <p className="mt-3 text-ink-soft">
          Nothing was signed and nothing is owed. If you still want to book, ask{" "}
          {vendorName} to send you a new link.
        </p>
      </Shell>
    );
  }

  // The vendor held the date for a while; once that ran out it may have gone
  // to someone else, so the backend won't take a signature until they resend.
  if (booking.contract_status === "expired" && !booking.signed_at) {
    return (
      <Shell>
        <p className="eyebrow">Expired</p>
        <h1 className="serif mt-2 text-2xl text-maroon dark:text-gold">This offer has expired</h1>
        <p className="mt-3 text-ink-soft">
          {vendorName} was holding {prettyDate(booking.date_iso)} for you
          {holdUntil ? ` until ${holdUntil}` : ""}. If you&apos;d still like to book, ask them to
          resend it — they&apos;ll check the date is still free.
        </p>
      </Shell>
    );
  }

  const depositDue =
    booking.deposit_percent != null && booking.deposit_amount_cents != null
      ? money(booking.deposit_amount_cents)
      : null;

  if (booking.signed_at) {
    const depositPaid = Boolean(booking.deposit_marked_paid_at);
    const depositConfirmed = Boolean(booking.deposit_confirmed_received_at);
    const fullyPaid = booking.payment_status === "marked_paid" || booking.payment_status === "confirmed_paid";

    return (
      <div className="mx-auto w-[min(560px,100%-2rem)] py-14">
        <div className="text-center">
          <p className="eyebrow">Confirmed</p>
          <h1 className="serif mt-2 text-3xl text-maroon dark:text-gold">
            Your booking with {vendorName} is set
          </h1>
          <p className="mt-2 text-ink-soft">
            Signed by {booking.signer_name} on {new Date(booking.signed_at).toLocaleDateString()}.
          </p>
        </div>

        <Card className="mt-6 p-5">
          <h2 className="serif text-lg text-ink">{booking.service_name ?? "Service"}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {prettyDate(booking.date_iso)} · {prettyTime(booking.time_start)}–{prettyTime(booking.time_end)}
          </p>
          <p className="text-sm text-ink-faint">{booking.location}</p>
          <p className="mt-3 text-sm text-ink-soft">Total: {money(booking.amount_cents)}</p>
          {depositDue ? (
            <p className="text-sm text-ink-soft">
              Deposit due: {depositDue} {depositPaid ? "— marked paid" : ""}
              {depositConfirmed ? " (confirmed)" : ""}
            </p>
          ) : null}
        </Card>

        <div className="mt-4 rounded-lg bg-gold/10 px-4 py-3 text-sm text-ink-soft">
          You&apos;ll pay {vendorName} directly — Jorna doesn&apos;t handle the money.{" "}
          {booking.vendor_venmo_handle ? `Venmo: ${booking.vendor_venmo_handle}` : null}
          {booking.vendor_venmo_handle && booking.vendor_zelle_contact ? " · " : null}
          {booking.vendor_zelle_contact ? `Zelle: ${booking.vendor_zelle_contact}` : null}
        </div>

        {paymentNotice ? (
          <p className="mt-4 rounded-lg bg-ground-2 px-3 py-2 text-center text-sm text-ink-soft">
            {paymentNotice}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2">
          {depositDue && !depositPaid ? (
            <Button disabled={paymentBusy === "deposit"} onClick={() => reportPaid("deposit")}>
              {paymentBusy === "deposit" ? "Marking…" : "I've paid the deposit"}
            </Button>
          ) : null}
          {!fullyPaid ? (
            <Button variant={depositDue ? "ghost" : "primary"} disabled={paymentBusy === "full"} onClick={() => reportPaid("full")}>
              {paymentBusy === "full" ? "Marking…" : "I've paid in full"}
            </Button>
          ) : (
            <p className="text-center text-sm text-green">Marked as fully paid.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-[min(560px,100%-2rem)] py-12">
      {preview ? (
        <p className="mb-6 rounded-lg bg-panel px-3 py-2 text-center text-sm text-ink-soft">
          Preview — this is what your client sees. Opening it here doesn&apos;t count as them
          opening it.
        </p>
      ) : null}
      <div className="text-center">
        <p className="eyebrow">You&apos;ve been sent a booking by</p>
        <h1 className="serif mt-2 text-3xl text-maroon dark:text-gold">{vendorName}</h1>
        {holdUntil ? (
          <p className="mt-2 text-sm text-ink-soft">
            {vendorName} is holding this date for you until {holdUntil}.
          </p>
        ) : null}
      </div>

      <Card className="mt-8 p-5">
        <h2 className="serif text-lg text-ink">{booking.service_name ?? "Service"}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {prettyDate(booking.date_iso)} · {prettyTime(booking.time_start)}–{prettyTime(booking.time_end)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3 text-sm sm:grid-cols-3">
          {booking.overtime_rate_cents != null ? (
            <div>
              <p className="text-ink-faint">Overtime rate</p>
              <p className="font-semibold text-ink">{money(booking.overtime_rate_cents)}/hr</p>
            </div>
          ) : null}
          {depositDue ? (
            <div>
              <p className="text-ink-faint">Deposit due</p>
              <p className="font-semibold text-maroon dark:text-gold">{depositDue}</p>
            </div>
          ) : null}
          <div>
            <p className="text-ink-faint">Total</p>
            <p className="font-semibold text-ink">{money(booking.amount_cents)}</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-gold/10 px-3 py-2.5 text-sm text-ink-soft">
          <strong className="text-ink">You&apos;ll pay {vendorName} directly</strong> — Jorna
          doesn&apos;t handle the money. This is your written agreement.
        </p>
      </Card>

      <form onSubmit={submit} className="mt-6 grid gap-6">
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-soft">Your details</p>
          <div className="mt-3 grid gap-3">
            <Field label="Your full name" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Phone" type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
              <Field label="Email" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required />
            </div>
            <Field
              label="Venue address"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where the event will be"
            />
            <Field
              label="Guest count"
              type="number"
              min={1}
              hint="Helps your vendor plan. Your price is the total shown above."
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
            />
          </div>
        </Card>

        {(booking.cancellation_window_hours != null ||
          booking.contract_terms?.equipment_power ||
          booking.contract_terms?.travel ||
          booking.overtime_rate_cents != null ||
          depositDue) ? (
          <Card className="p-5">
            <p className="text-sm font-medium text-ink-soft">What you&apos;re agreeing to</p>
            <ul className="mt-3 grid gap-2 text-sm text-ink-soft">
              {depositDue ? (
                <li>✓ {depositDue} deposit ({booking.deposit_percent}%) due to secure your date</li>
              ) : null}
              {booking.cancellation_window_hours != null ? (
                <li>
                  ✓ Cancellations within {Math.round(booking.cancellation_window_hours / 24)} days of the
                  event may forfeit the deposit
                </li>
              ) : null}
              {booking.overtime_rate_cents != null ? (
                <li>✓ Overtime billed at {money(booking.overtime_rate_cents)}/hr, agreed in advance</li>
              ) : null}
              {booking.contract_terms?.equipment_power ? <li>✓ {booking.contract_terms.equipment_power}</li> : null}
              {booking.contract_terms?.travel ? <li>✓ {booking.contract_terms.travel}</li> : null}
            </ul>
          </Card>
        ) : null}

        <Card className="p-5">
          <p className="text-sm font-medium text-ink-soft">Your signature</p>
          <p className="mt-1 text-xs text-ink-soft">Type your full legal name to electronically sign this agreement</p>
          <div className="mt-3">
            <Field
              placeholder="Type your full name to sign"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              required
            />
          </div>
        </Card>

        {error ? (
          <p role="alert" className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
            {error}
          </p>
        ) : null}

        <div>
          <Button type="submit" size="lg" className="w-full" disabled={busy || preview || !signerName.trim()}>
            {busy ? "Confirming…" : "Confirm booking →"}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-faint">
            By confirming, you electronically sign this agreement. A summary will be sent to your email.
          </p>
        </div>
      </form>

      <div className="mt-8 border-t border-line-soft pt-6 text-center">
        {declining ? (
          <div className="grid gap-3 text-left">
            <Field
              label={`Anything you'd like ${vendorName} to know? (optional)`}
              value={declineReason}
              maxLength={500}
              onChange={(e) => setDeclineReason(e.target.value)}
            />
            <div className="flex justify-center gap-2">
              <Button variant="ghost" disabled={busy || preview} onClick={decline}>
                {busy ? "Sending…" : "Decline this offer"}
              </Button>
              <Button variant="quiet" onClick={() => setDeclining(false)}>
                Never mind
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDeclining(true)}
            className="text-sm text-ink-faint underline-offset-4 hover:text-ink hover:underline"
          >
            Not going ahead? Let {vendorName} know
          </button>
        )}
      </div>
    </div>
  );
}

export default function BookingLinkPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <BookingLinkInner />
    </Suspense>
  );
}
