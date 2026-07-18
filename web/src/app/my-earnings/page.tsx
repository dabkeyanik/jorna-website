"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  getEarnings,
  getMyVendor,
  getStripeStatus,
  startStripeOnboarding,
} from "@/lib/jorna";
import {
  PAYMENT_STATUS_LABELS,
  type Earnings,
  type StripeStatus,
  type VendorDetail,
} from "@/lib/types";
import { Button, Card, LinkButton } from "@/components/ui";
import { VendorNav } from "@/components/VendorNav";

function money(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function Stat({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ink" | "gold" | "green";
}) {
  const colour =
    tone === "green" ? "text-green" : tone === "gold" ? "text-gold" : "text-ink";
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`serif mt-1 text-2xl ${colour}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </Card>
  );
}

function EarningsInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  // Stripe sends the vendor back here after onboarding.
  const justOnboarded = params.get("stripe") === "return";

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/my-earnings");
  }, [authLoading, user, router]);

  const load = useCallback(async (vendorId: string) => {
    // Status is fetched live from Stripe, so returning from onboarding reflects
    // reality without any extra step.
    const [st, earn] = await Promise.all([
      getStripeStatus(vendorId).catch(() => null),
      getEarnings(vendorId).catch(() => null),
    ]);
    setStatus(st);
    setEarnings(earn);
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
        setError(err instanceof ApiError ? err.message : "Couldn't load your earnings."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, load]);

  async function onboard() {
    if (!vendor) return;
    setBusy(true);
    setError(null);
    try {
      const { onboarding_url } = await startStripeOnboarding(vendor.vendor_id);
      window.location.href = onboarding_url;
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't start payment setup.",
      );
      setBusy(false);
    }
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
        <LinkButton href="/vendor-profile" className="mt-6">
          Create vendor profile
        </LinkButton>
      </div>
    );
  }

  const onboarded = Boolean(status?.stripe_onboarding_complete);

  return (
    <div className="mx-auto w-[min(880px,100%-2rem)] py-10">
      <VendorNav />
      <header>
        <span className="eyebrow">Selling</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
          Earnings
        </h1>
      </header>

      {error ? (
        <p className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {/* Payments setup — the gate on getting paid at all */}
      {!onboarded ? (
        <Card className="mt-7 p-6">
          <h2 className="serif text-xl text-ink">
            {justOnboarded ? "Finishing payment setup…" : "Set up payments"}
          </h2>
          <p className="mt-2 text-ink-soft">
            {justOnboarded
              ? "Stripe hasn't confirmed your details yet. If you left anything incomplete, pick up where you left off."
              : "Clients can't pay you until Stripe has your details — a booking can be accepted, but checkout will refuse. It takes a few minutes."}
          </p>
          <Button className="mt-4" disabled={busy} onClick={onboard}>
            {busy
              ? "Opening Stripe…"
              : status?.stripe_account_id
                ? "Continue payment setup"
                : "Set up payments"}
          </Button>
        </Card>
      ) : (
        <p className="mt-6 rounded-lg bg-green/10 px-3 py-2 text-sm text-green">
          Payments are set up — you&apos;re ready to be booked and paid.
        </p>
      )}

      {/* Money */}
      {earnings ? (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Stat
              label="Paid out"
              value={money(earnings.total_released_cents)}
              hint="Released to you after the event"
              tone="green"
            />
            <Stat
              label="Held in escrow"
              value={money(earnings.in_escrow_cents)}
              hint="Yours once you and the client confirm"
              tone="gold"
            />
            <Stat
              label="Upcoming"
              value={money(earnings.upcoming_cents)}
              hint={`${earnings.upcoming_count} accepted, not yet paid`}
            />
          </div>

          {earnings.disputed_cents > 0 || earnings.refunded_cents > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {earnings.disputed_cents > 0 ? (
                <Stat
                  label="Under review"
                  value={money(earnings.disputed_cents)}
                  hint="Frozen while a dispute is resolved"
                />
              ) : null}
              {earnings.refunded_cents > 0 ? (
                <Stat
                  label="Refunded"
                  value={money(earnings.refunded_cents)}
                  hint="Returned to the client"
                />
              ) : null}
            </div>
          ) : null}

          <p className="mt-3 text-xs text-ink-faint">
            Amounts are what reaches you — Jorna&apos;s fee is already deducted
            ({money(earnings.platform_fees_cents)} so far).
          </p>

          <section className="mt-9">
            <h2 className="serif text-2xl text-ink">History</h2>
            {earnings.history.length === 0 ? (
              <p className="mt-3 text-ink-soft">
                Nothing yet. Payments show up here once a client pays.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {earnings.history.map((h) => (
                  <Card
                    key={h.booking_id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">
                        {h.event_name || "Booking"}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {[
                          h.client_name,
                          h.paid_at ? h.paid_at.slice(0, 10) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-ink">
                        {money(h.net_cents)}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {PAYMENT_STATUS_LABELS[h.payment_status ?? ""] ??
                          h.payment_status}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function EarningsPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <EarningsInner />
    </Suspense>
  );
}
