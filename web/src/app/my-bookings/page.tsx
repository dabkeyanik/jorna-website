"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  checkInBooking,
  confirmBookingEvent,
  getMyVendor,
  listVendorBookings,
  setBookingStatus,
} from "@/lib/jorna";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  categoryLabel,
  eventHasPassed,
  priceUnitLabel,
  type VendorBooking,
  type VendorDetail,
} from "@/lib/types";
import { Button, Card, LinkButton } from "@/components/ui";
import { VendorNav } from "@/components/VendorNav";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

type Filter = "pending" | "upcoming" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Needs your answer" },
  { value: "upcoming", label: "Accepted" },
  { value: "all", label: "All" },
];

function matches(filter: Filter, b: VendorBooking): boolean {
  if (filter === "all") return true;
  if (filter === "pending")
    return b.status === "pending" || b.status === "negotiation_ongoing";
  return b.status === "approved" || b.status === "payment_confirmed";
}

/** A booking is venue-anchored when it carries the event's mirrored coords. */
function hasVenue(b: VendorBooking): boolean {
  return b.venue_latitude != null && b.venue_longitude != null;
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
  const [filter, setFilter] = useState<Filter>("pending");

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
        if (mine) await load(mine.vendor_id);
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
    setBusyId(b.booking_id);
    setError(null);
    setNotice(null);
    try {
      await setBookingStatus(b.booking_id, status);
      setConfirmDecline(null);
      setNotice(
        status === "approved"
          ? "Accepted. The client can pay now — the money is held until after the event."
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
  ) {
    if (!vendor) return;
    setBusyId(b.booking_id);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load(vendor.vendor_id);
      setNotice("Confirmed. The payment releases once the client confirms too.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusyId(null);
    }
  }

  function checkIn(b: VendorBooking) {
    if (!navigator.geolocation) {
      setError("This browser can't share a location, so it can't verify you're at the venue.");
      return;
    }
    setBusyId(b.booking_id);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        void release(
          b,
          () => checkInBooking(b.booking_id, pos.coords.latitude, pos.coords.longitude),
          "Couldn't check you in — make sure you're at the venue.",
        ),
      () => {
        setBusyId(null);
        setError("Couldn't read your location. You need to allow it to check in at the venue.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function vendorConfirm(b: VendorBooking) {
    void release(
      b,
      () => confirmBookingEvent(b.booking_id),
      "Couldn't confirm — please try again.",
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
          least one service.
        </p>
        <LinkButton href="/vendor-profile" className="mt-6">
          Create vendor profile
        </LinkButton>
      </div>
    );
  }

  const shown = bookings.filter((b) => matches(filter, b));
  const pendingCount = bookings.filter((b) => matches("pending", b)).length;

  return (
    <div className="mx-auto w-[min(880px,100%-2rem)] py-10">
      <VendorNav />
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

      <div className="mt-6 flex flex-wrap gap-2">
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
            const unit = priceUnitLabel(b.price_unit);
            const dates =
              b.date_end && b.date_end !== b.date_iso
                ? `${b.date_iso} → ${b.date_end}`
                : b.date_iso;

            return (
              <Card key={b.booking_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="serif text-lg text-ink">
                      {b.service_name || "Service"}
                    </h3>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {b.client_name || "A client"}
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
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="serif text-lg text-ink">{money(b.price)}</p>
                    {unit ? <p className="text-xs text-ink-faint">{unit}</p> : null}
                    {b.price_pending_quantity ? (
                      <p className="mt-1 max-w-[12rem] text-xs text-gold">
                        Client still needs to add a quantity before paying.
                      </p>
                    ) : null}
                  </div>
                </div>

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
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => setConfirmDecline(b.booking_id)}
                      >
                        Decline
                      </Button>
                      <Button
                        size="md"
                        disabled={busyId === b.booking_id}
                        onClick={() => decide(b, "approved")}
                      >
                        {busyId === b.booking_id ? "Accepting…" : "Accept"}
                      </Button>
                    </div>
                  )
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
                    ) : eventHasPassed(b.date_end || b.date_iso) ? (
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
