"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  confirmBookingEvent,
  confirmDepositReceived,
  confirmPaymentReceived,
  getMyVendor,
  getStripeStatus,
  listVendorBookings,
  respondToChange,
  setBookingStatus,
} from "@/lib/jorna";
import { checkInAtVenue, LocationError } from "@/lib/checkin";
import { isDeadVendorBooking, paymentsSetup } from "@/lib/vendorPlan";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  categoryLabel,
  eventIsOver,
  formatCheckInTime,
  priceLine,
  type StripeStatus,
  type VendorBooking,
  type VendorDetail,
} from "@/lib/types";
import { Button, Card, LinkButton } from "@/components/ui";
import { NegotiationPanel } from "@/components/NegotiationPanel";
import { DateChangeRequest } from "@/components/DateChangeRequest";
import { MessageVendorButton } from "@/components/MessageVendorButton";

/** "2027-06-14" → "14 Jun 2027". Raw ISO reads like a database row. */
function prettyDate(iso?: string | null): string | null {
  if (!iso || iso === "TBD") return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

/** A guest booking has no client_name (no account to join to) — guest_name
 *  is what the client typed in themselves instead. */
function clientDisplayName(b: VendorBooking): string | null {
  return b.client_name || b.guest_name || null;
}

type Filter = "pending" | "upcoming" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Needs your answer" },
  { value: "upcoming", label: "Accepted" },
  { value: "all", label: "All" },
];

/** Awaiting this vendor's "I received it" on a manual (Venmo/Zelle) payment
 *  the client says they've sent — same condition the confirm button itself
 *  is gated on, below. */
function awaitingPaymentConfirmation(b: VendorBooking): boolean {
  return (
    b.payment_method === "manual" &&
    b.status === "approved" &&
    b.payment_status === "marked_paid"
  );
}

function matches(filter: Filter, b: VendorBooking): boolean {
  if (filter === "all") return true;
  if (filter === "pending") {
    return (
      b.status === "pending" ||
      b.status === "negotiation_ongoing" ||
      awaitingPaymentConfirmation(b)
    );
  }
  return b.status === "approved" || b.status === "payment_confirmed";
}

/** Can this be checked into? True when the plan has a place — a booked venue,
    or the event's own address. Mirrors what the server resolves, so the button
    is never offered for a call it has to refuse. */
function hasVenue(b: VendorBooking): boolean {
  return b.checkin_latitude != null && b.checkin_longitude != null;
}

export default function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  // Whether accepting here would actually get this vendor paid — the Stripe
  // gate used to only surface on /my-dashboard, so a vendor who works from
  // this page could accept any number of bookings without ever seeing it.
  const [stripe, setStripe] = useState<StripeStatus | null>(null);
  const [stripeChecked, setStripeChecked] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/my-bookings");
  }, [authLoading, user, router]);

  const load = useCallback(async (vendorId: string) => {
    const res = await listVendorBookings(vendorId, { limit: 100 });
    setBookings(res.items);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyVendor()
      .then(async (mine) => {
        if (cancelled) return;
        setVendor(mine);
        if (mine) {
          await load(mine.vendor_id);
          getStripeStatus(mine.vendor_id)
            .then((s) => !cancelled && setStripe(s))
            .catch(() => !cancelled && setStripe(null))
            .finally(() => !cancelled && setStripeChecked(true));
        }
      })
      .catch((err) =>
        !cancelled &&
        setError(err instanceof ApiError ? err.message : "Couldn't load your bookings."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, load]);

  async function decide(b: VendorBooking, status: "approved" | "rejected") {
    if (!vendor) return;
    const wasApproved = b.status === "approved";
    setBusyId(b.booking_id);
    setError(null);
    setNotice(null);
    try {
      await setBookingStatus(b.booking_id, status);
      setConfirmDecline(null);
      setConfirmCancel(null);
      setNotice(
        status === "approved"
          ? // A signed-in client's request becomes a contract they sign
            // (backend DECISIONS #17); it's final once they do.
            "Accepted — we've emailed them a contract to sign, built from your usual terms. The date is held for them until they sign."
          // Declining a request and pulling out of a booking are the same
          // call and very different acts; the confirmation should say which.
          : wasApproved
            ? "Cancelled. Your client has been told and it's off their plan."
            : "Declined.",
      );
      await load(vendor.vendor_id);
    } catch (err) {
      // A 409 means this date is already taken by another accepted booking.
      // The server's message explains it; show that rather than a generic error.
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't update that request. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  /** Run a release action, then refetch so the new state is authoritative. */
  async function release(
    b: VendorBooking,
    action: () => Promise<unknown>,
    fallback: string,
    success = "Confirmed. The payment releases once the client confirms too.",
  ) {
    if (!vendor) return;
    setBusyId(b.booking_id);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load(vendor.vendor_id);
      setNotice(success);
    } catch (err) {
      // A LocationError explains a permission/GPS problem specifically —
      // showing the generic fallback instead left a blocked vendor no wiser
      // about why "make sure you're at the venue" kept failing when they were.
      setError(
        err instanceof ApiError || err instanceof LocationError ? err.message : fallback,
      );
    } finally {
      setBusyId(null);
    }
  }

  // The geolocation half lives in lib/checkin, shared with the vendor
  // dashboard, which offers the same action.
  function checkIn(b: VendorBooking) {
    void release(
      b,
      () => checkInAtVenue(b.booking_id),
      "Couldn't check you in — make sure you're at the venue.",
    );
  }

  function vendorConfirm(b: VendorBooking) {
    void release(
      b,
      () => confirmBookingEvent(b.booking_id),
      "Couldn't confirm — please try again.",
    );
  }

  // Manual track only — the vendor's side of the "I sent payment" / "I
  // received it" exchange. Self-reported; Jorna never touches this money.
  function confirmReceived(b: VendorBooking) {
    void release(
      b,
      () => confirmPaymentReceived(b.booking_id),
      "Couldn't confirm — please try again.",
      "Confirmed. The client can see you've got it.",
    );
  }

  function confirmDeposit(b: VendorBooking) {
    void release(
      b,
      () => confirmDepositReceived(b.booking_id),
      "Couldn't confirm — please try again.",
      "Deposit confirmed.",
    );
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  if (!vendor) {
    return (
      <div className="mx-auto w-[min(560px,100%-2rem)] py-20 text-center">
        <h1 className="serif text-3xl text-maroon dark:text-gold">
          You&apos;re not selling on Jorna yet
        </h1>
        <p className="mt-3 text-ink-soft">
          Booking requests show up here once you have a vendor profile and at
          least one package.
        </p>
        <LinkButton href="/vendor-profile" className="mt-6">
          Create vendor profile
        </LinkButton>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = bookings
    .filter((b) => matches(filter, b))
    .filter(
      (b) =>
        !q ||
        [clientDisplayName(b), b.service_name, b.event_name].some((v) =>
          v?.toLowerCase().includes(q),
        ),
    );
  const pendingCount = bookings.filter((b) => matches("pending", b)).length;
  const confirmedCount = bookings.filter((b) => matches("upcoming", b)).length;
  const totalContractedAmount = bookings
    .filter((b) => !isDeadVendorBooking(b))
    .reduce((sum, b) => sum + priceLine(b).amount, 0);
  const setup = paymentsSetup(stripe);
  // Stripe's gate has nothing to say to a vendor who already chose Direct —
  // they don't need it — so this stays false for that track instead of
  // nagging about a Stripe setup they deliberately opted out of. Mirrors
  // the same `vendor.payment_method === "manual"` check my-earnings/page.tsx
  // uses for its own version of this gate.
  const paymentsBlocked =
    stripeChecked && !setup.ready && vendor.payment_method !== "manual";

  return (
    <div>
      <header>
        <span className="eyebrow">Selling</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
          Booking requests
        </h1>
        <p className="mt-2 text-ink-soft">
          {pendingCount > 0
            ? `${pendingCount} waiting on you.`
            : "Nothing waiting on you right now."}
        </p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Total bookings</p>
          <p className="serif mt-1 text-2xl text-ink">{bookings.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Confirmed / active</p>
          <p className="serif mt-1 text-2xl text-green">{confirmedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Pending inquiry</p>
          <p className="serif mt-1 text-2xl text-gold">{pendingCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Total contracted</p>
          <p className="serif mt-1 text-2xl text-maroon dark:text-gold">
            {money(totalContractedAmount)}
          </p>
        </Card>
      </div>

      {paymentsBlocked ? (
        <div className="mt-6 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink-soft">
          <p>
            <strong className="text-ink">{setup.title}.</strong> {setup.detail} You can still
            accept requests below, but you won&apos;t be paid for them until this is sorted.
          </p>
          <Link href="/my-earnings" className="mt-1.5 inline-block font-semibold text-gold hover:underline">
            {setup.cta} →
          </Link>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                filter === f.value
                  ? "border-gold bg-gold/15 text-maroon dark:text-gold"
                  : "border-card-edge bg-ground-2 text-ink-soft hover:border-gold/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bookings…"
          className="w-full max-w-xs rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
      </div>

      {error ? (
        <p className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-6 rounded-lg bg-green/10 px-3 py-2 text-sm text-green">
          {notice}
        </p>
      ) : null}

      {shown.length === 0 ? (
        <p className="mt-12 text-center text-ink-soft">Nothing here yet.</p>
      ) : (
        <div className="mt-6 grid gap-3">
          {shown.map((b) => {
            const pay = b.payment_status ?? "unpaid";
            const state =
              pay !== "unpaid" && pay !== "processing"
                ? (PAYMENT_STATUS_LABELS[pay] ?? pay)
                : (BOOKING_STATUS_LABELS[b.status] ?? b.status);
            const decidable =
              b.status === "pending" || b.status === "negotiation_ongoing";
            // Pulling out of one already accepted. "paid" is the one
            // money-moved state this is still allowed from — the server
            // refunds the client in full automatically, since the vendor is
            // the one breaking the commitment. Every other money-moved state
            // stays blocked (a charge still in flight, funds already
            // released, or a booking already refunded/cancelled/disputed
            // isn't a plain "vendor changed their mind") — mirrors the
            // server's own guard, so the button is never offered for a call
            // that has to be refused.
            const cancellable =
              b.status === "approved" &&
              !["processing", "released", "refunded", "cancelled", "disputed"].includes(
                (b.payment_status ?? "unpaid").toLowerCase(),
              );
            const cancellingPaidBooking = b.payment_status === "paid";
            // Manual track: the client self-reported paying directly, so
            // Jorna has nothing to refund even though money did move.
            const cancellingSelfReportedPaidBooking =
              b.payment_method === "manual" &&
              ["marked_paid", "confirmed_paid"].includes(b.payment_status ?? "");
            const price = priceLine(b);
            const dates =
              b.date_end && b.date_end !== b.date_iso
                ? `${b.date_iso} → ${b.date_end}`
                : b.date_iso;

            return (
              <Card key={b.booking_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="serif text-lg text-ink">
                      {b.service_name || "Package"}
                    </h3>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {clientDisplayName(b) || "A client"}
                      {b.event_name ? ` · ${b.event_name}` : ""}
                      {b.service_category
                        ? ` · ${categoryLabel(b.service_subcategory || b.service_category)}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-ink-faint">
                      {[
                        dates,
                        b.time_start && b.time_end
                          ? `${b.time_start}–${b.time_end}`
                          : null,
                        b.location,
                        b.guest_count ? `${b.guest_count} guests` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-ink-soft">{state}</p>
                    {b.client_note ? (
                      <p className="mt-2 rounded-lg bg-panel px-3 py-2 text-sm text-ink-soft">
                        “{b.client_note}”
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="serif text-lg text-ink">{money(price.amount)}</p>
                    {price.caption ? (
                      <p className="text-xs text-ink-faint">{price.caption}</p>
                    ) : null}
                    {b.price_pending_quantity ? (
                      <p className="mt-1 max-w-[12rem] text-xs text-gold">
                        Client still needs to add a quantity before paying.
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* On the row, same as the client's side of this button — a
                    question about this booking starts here, not in a tab
                    listing every thread. Not available on a guest booking —
                    there's no account on the other end to message. */}
                {!b.is_guest_booking ? (
                  <div className="mt-3 flex justify-end">
                    <MessageVendorButton bookingId={b.booking_id} />
                  </div>
                ) : null}

                {decidable ? (
                  confirmDecline === b.booking_id ? (
                    <div className="mt-3 rounded-lg bg-panel p-3">
                      <p className="text-xs text-ink-soft">
                        Decline this request? The client will need to find someone
                        else for this slot.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="md"
                          disabled={busyId === b.booking_id}
                          onClick={() => decide(b, "rejected")}
                        >
                          {busyId === b.booking_id ? "Declining…" : "Decline"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => setConfirmDecline(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      {paymentsBlocked ? (
                        <p className="mb-2 text-right text-xs text-gold">
                          Accepting won&apos;t pay out yet — {setup.title.toLowerCase()}.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => setConfirmDecline(b.booking_id)}
                        >
                          Decline
                        </Button>
                        <LinkButton
                          href={`/contracts/new?request=${b.booking_id}`}
                          variant="ghost"
                          size="md"
                        >
                          Customize contract
                        </LinkButton>
                        <Button
                          size="md"
                          disabled={busyId === b.booking_id}
                          onClick={() => decide(b, "approved")}
                        >
                          {busyId === b.booking_id ? "Accepting…" : "Accept & send contract"}
                        </Button>
                      </div>
                    </div>
                  )
                ) : null}

                {/* Accepted, but it's a proposal until they sign it. */}
                {b.status === "approved" && b.contract_token && !b.signed_at ? (
                  <p className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel px-3 py-2 text-sm text-ink-soft">
                    <span>
                      {b.contract_status === "expired"
                        ? "Their contract expired unsigned — the date is open again."
                        : "Waiting for them to sign the contract."}
                    </span>
                    <Link
                      href={`/contracts/view?id=${b.booking_id}`}
                      className="font-semibold text-ink hover:text-maroon dark:hover:text-gold"
                    >
                      View contract
                    </Link>
                  </p>
                ) : null}

                {/* Pulling out of a booking already accepted. A vendor whose
                    circumstances changed had no way out of one at all, so the
                    honest options were to say so in the chat and hope, or not
                    turn up. Quiet, and behind a confirmation: it is somebody
                    else's celebration losing a supplier. */}
                {cancellable ? (
                  confirmCancel === b.booking_id ? (
                    <div className="mt-3 rounded-lg bg-panel p-3">
                      <p className="text-xs text-ink-soft">
                        Cancel this booking? {clientDisplayName(b) || "Your client"} is
                        told straight away, and it comes off their plan.{" "}
                        {cancellingPaidBooking
                          ? "They'll be refunded in full — you won't be paid for this one."
                          : cancellingSelfReportedPaidBooking
                            ? "They told us they already paid you directly — cancelling won't refund that automatically, since it happened outside Jorna."
                            : "They haven't paid, so nothing is refunded —"}{" "}
                        but they will have to find someone else
                        {b.date_iso ? ` for ${prettyDate(b.date_iso)}` : ""}.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="md"
                          disabled={busyId === b.booking_id}
                          onClick={() => decide(b, "rejected")}
                        >
                          {busyId === b.booking_id
                            ? "Cancelling…"
                            : "Yes, cancel it"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => setConfirmCancel(null)}
                        >
                          Keep the booking
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="quiet"
                        size="md"
                        onClick={() => setConfirmCancel(b.booking_id)}
                      >
                        Cancel this booking
                      </Button>
                    </div>
                  )
                ) : null}

                {/* Negotiation — on a negotiable request the vendor can counter
                    the client's offer or settle a price before accepting. */}
                {decidable && b.negotiable ? (
                  <div className="mt-3">
                    <NegotiationPanel
                      bookingId={b.booking_id}
                      listedPrice={b.price}
                      counterpartyName={b.client_name}
                      onSettled={() => {
                        setNotice("Price agreed — the booking is approved at the new price.");
                        void load(vendor.vendor_id);
                      }}
                    />
                  </div>
                ) : null}

                {/* The client wants to move this one. Their date is yours to
                    hold once you've agreed to it, so this is a question rather
                    than a change that has already happened to you. */}
                {b.change_request ? (
                  <DateChangeRequest
                    booking={b}
                    busy={busyId === b.change_request.change_request_id}
                    onAnswer={async (accept, message) => {
                      setBusyId(b.change_request!.change_request_id);
                      setNotice(null);
                      try {
                        await respondToChange(
                          b.change_request!.change_request_id,
                          accept,
                          message,
                        );
                        setNotice(
                          accept
                            ? "Moved. Your client has been told."
                            : "Declined. Your booking stays as it was.",
                        );
                        await load(vendor.vendor_id);
                      } catch (err) {
                        // The server names the clashing booking on a 409, which
                        // is the one thing that makes the refusal actionable.
                        setNotice(
                          err instanceof ApiError
                            ? err.message
                            : "That didn't work. Try again.",
                        );
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                ) : null}

                {/* The client's GPS arrival. Presence only — it is not their
                    escrow confirmation, so it never moves the payout along. */}
                {b.client_checked_in_at ? (
                  <p className="mt-3 text-xs text-green">
                    {clientDisplayName(b) || "Your client"} checked in at the venue on{" "}
                    {formatCheckInTime(b.client_checked_in_at)}.
                  </p>
                ) : null}

                {/* Escrow release — the vendor's half, once the money is held */}
                {b.payment_status === "paid" ? (
                  <div className="mt-3 border-t border-line-soft pt-3">
                    {b.vendor_confirmed_at ? (
                      <p className="text-xs text-ink-soft">
                        {b.customer_confirmed_at
                          ? "Confirmed by both — your payout is on its way."
                          : "You've confirmed. Waiting on the client to confirm before the payment releases."}
                      </p>
                    ) : hasVenue(b) ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-ink-faint">
                          Check in at the venue to confirm you delivered.
                        </p>
                        <Button
                          size="md"
                          disabled={busyId === b.booking_id}
                          onClick={() => checkIn(b)}
                        >
                          {busyId === b.booking_id ? "Checking in…" : "Check in at venue"}
                        </Button>
                      </div>
                    ) : eventIsOver(b) ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-ink-faint">
                          Confirm the event happened to release your payment.
                        </p>
                        <Button
                          size="md"
                          disabled={busyId === b.booking_id}
                          onClick={() => vendorConfirm(b)}
                        >
                          {busyId === b.booking_id ? "Confirming…" : "Confirm"}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-ink-soft">
                        You can confirm after the event
                        {b.date_iso && b.date_iso !== "TBD" ? ` (${b.date_iso})` : ""}.
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Deposit self-attestation — a second, earlier pair alongside
                    the full-payment one below, only present when this
                    booking (almost always a Contract) has a deposit
                    configured at all. */}
                {b.deposit_percent != null && b.status === "approved" ? (
                  <div className="mt-3 border-t border-line-soft pt-3">
                    {b.deposit_marked_paid_at && !b.deposit_confirmed_received_at ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-ink-faint">
                          {clientDisplayName(b) || "Your client"} says they&apos;ve sent the deposit.
                        </p>
                        <Button
                          size="md"
                          disabled={busyId === b.booking_id}
                          onClick={() => confirmDeposit(b)}
                        >
                          {busyId === b.booking_id ? "Confirming…" : "I received the deposit"}
                        </Button>
                      </div>
                    ) : b.deposit_confirmed_received_at ? (
                      <p className="text-xs text-green">You confirmed receiving the deposit.</p>
                    ) : (
                      <p className="text-xs text-ink-faint">
                        Waiting on {clientDisplayName(b) || "the client"} to pay the deposit
                        {b.deposit_amount_cents != null ? ` (${money(b.deposit_amount_cents / 100)})` : ""}.
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Manual track: paid directly, not through Jorna. Nothing to
                    check in or release here — just the client's own report
                    that they've sent it, waiting on this vendor to say the
                    same. */}
                {b.payment_method === "manual" && b.status === "approved" ? (
                  <div className="mt-3 border-t border-line-soft pt-3">
                    {b.payment_status === "marked_paid" ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-ink-faint">
                          {clientDisplayName(b) || "Your client"} says they&apos;ve sent payment directly.
                        </p>
                        <Button
                          size="md"
                          disabled={busyId === b.booking_id}
                          onClick={() => confirmReceived(b)}
                        >
                          {busyId === b.booking_id ? "Confirming…" : "I received it"}
                        </Button>
                      </div>
                    ) : b.payment_status === "confirmed_paid" ? (
                      <p className="text-xs text-green">You confirmed receiving payment.</p>
                    ) : (
                      <p className="text-xs text-ink-faint">
                        Waiting on {clientDisplayName(b) || "the client"} to pay you directly.
                      </p>
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
