"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { createCheckoutSession, getBundle } from "@/lib/jorna";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  categoryLabel,
  priceUnitLabel,
  type BundleBooking,
  type BundleDetail,
} from "@/lib/types";
import { Button, Card, LinkButton } from "@/components/ui";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

/** Escrow-aware status line for one booking. */
function statusLine(b: BundleBooking): { text: string; tone: string } {
  const pay = b.payment_status ?? "unpaid";
  if (pay !== "unpaid" && pay !== "processing") {
    const tone =
      pay === "released"
        ? "text-green"
        : pay === "refunded" || pay === "disputed"
          ? "text-maroon dark:text-gold"
          : "text-gold";
    return { text: PAYMENT_STATUS_LABELS[pay] ?? pay, tone };
  }
  return {
    text: BOOKING_STATUS_LABELS[b.status] ?? b.status,
    tone: b.status === "rejected" ? "text-ink-faint" : "text-ink-soft",
  };
}

function BookingRow({
  booking,
  onPay,
  paying,
}: {
  booking: BundleBooking;
  onPay: (b: BundleBooking) => void;
  paying: boolean;
}) {
  const pay = booking.payment_status ?? "unpaid";
  const unit = priceUnitLabel(booking.price_unit);
  const status = statusLine(booking);

  // Mirror the backend's checkout guards so we never offer a button that must
  // fail: only an approved, not-yet-paid booking with a resolvable total.
  const payable =
    booking.status === "approved" && (pay === "unpaid" || pay === "processing");
  const blockedOnQuantity = payable && booking.price_pending_quantity;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="serif text-lg text-ink">
            {booking.service_name || "Service"}
          </h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            {booking.vendor_name}
            {booking.service_category
              ? ` · ${categoryLabel(booking.service_subcategory || booking.service_category)}`
              : ""}
          </p>
          <p className={`mt-1.5 text-sm font-medium ${status.tone}`}>{status.text}</p>
        </div>

        <div className="text-right">
          <p className="serif text-lg text-ink">{money(booking.price)}</p>
          {unit ? <p className="text-xs text-ink-faint">{unit}</p> : null}
        </div>
      </div>

      {blockedOnQuantity ? (
        <p className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-xs text-ink-soft">
          This service is priced {unit || "per unit"}. Its total needs a guest count
          or date range before it can be paid — add those in the Jorna app.
        </p>
      ) : payable ? (
        <div className="mt-3 flex justify-end">
          <Button onClick={() => onPay(booking)} disabled={paying}>
            {paying ? "Opening checkout…" : `Pay ${money(booking.price)}`}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function BundleInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const bundleId = params.get("id");

  const [bundle, setBundle] = useState<BundleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=/bundle${bundleId ? `?id=${bundleId}` : ""}`);
    }
  }, [authLoading, user, router, bundleId]);

  const load = useCallback(async () => {
    if (!bundleId || !user) return;
    try {
      setBundle(await getBundle(bundleId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this bundle.");
    } finally {
      setLoading(false);
    }
  }, [bundleId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pay(booking: BundleBooking) {
    setPayingId(booking.booking_id);
    setNotice(null);
    try {
      const { checkout_url } = await createCheckoutSession(booking.booking_id);
      // Hand off to Stripe's hosted page; it returns to /app/payment-complete.
      window.location.href = checkout_url;
    } catch (err) {
      setNotice(
        err instanceof ApiError ? err.message : "Couldn't start checkout. Try again.",
      );
      setPayingId(null);
      if (err instanceof ApiError && err.status === 409) void load();
    }
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  if (error || !bundle) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">{error ?? "Bundle not found."}</p>
        <LinkButton href="/bundles" variant="ghost" className="mt-5">
          Back to your bundles
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto w-[min(880px,100%-2rem)] py-10">
      <Link href="/bundles" className="text-sm text-ink-soft hover:text-ink">
        ← Your bundles
      </Link>

      <header className="mt-5">
        <h1 className="serif text-4xl text-maroon dark:text-gold">
          {bundle.event_name || bundle.name}
        </h1>
        <p className="mt-2 text-ink-soft">
          {bundle.booking_count} {bundle.booking_count === 1 ? "vendor" : "vendors"}
          {bundle.event?.date_iso ? ` · ${bundle.event.date_iso}` : ""}
          {bundle.event?.location ? ` · ${bundle.event.location}` : ""}
        </p>
        <p className="serif mt-3 text-2xl text-ink">
          {money(bundle.total_estimated_cost)}
        </p>
      </header>

      {notice ? (
        <p className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {notice}
        </p>
      ) : null}

      <section className="mt-8 grid gap-3">
        {bundle.bookings.map((b) => (
          <BookingRow
            key={b.booking_id}
            booking={b}
            paying={payingId === b.booking_id}
            onPay={pay}
          />
        ))}
      </section>

      <p className="mt-8 rounded-2xl border border-card-edge bg-panel p-5 text-center text-sm text-ink-soft">
        Each vendor is paid separately. Your money is held in escrow and only
        released after the event, once you and the vendor both confirm.
      </p>
    </div>
  );
}

export default function BundlePage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <BundleInner />
    </Suspense>
  );
}
