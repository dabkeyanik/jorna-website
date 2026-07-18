"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  confirmBookingEvent,
  createCheckoutSession,
  deleteBundle,
  disputeBooking,
  getBundle,
  refundBooking,
  removeBookingFromBundle,
  renameBundle,
} from "@/lib/jorna";
import { ServiceSwapPanel } from "@/components/ServiceSwapPanel";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  categoryLabel,
  eventHasPassed,
  priceUnitLabel,
  withinRefundWindow,
  type BundleBooking,
  type BundleDetail,
} from "@/lib/types";
import { Button, Card, Field, LinkButton } from "@/components/ui";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

type PanelKind = "refund" | "dispute" | "remove";
type Panel = { bookingId: string; kind: PanelKind } | null;

/**
 * Once money has moved, the composition is fixed — swapping or removing a
 * booking would strand a payment. Mirrors the iOS rule.
 */
function isBeyondActionable(b: BundleBooking): boolean {
  if (b.status === "payment_confirmed") return true;
  const ps = (b.payment_status ?? "unpaid").toLowerCase();
  return ["paid", "released", "refunded", "disputed"].includes(ps);
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
  busyId,
  panel,
  onPay,
  onConfirm,
  onOpenPanel,
  onClosePanel,
  onRefund,
  onDispute,
  onSwap,
  onRemove,
}: {
  booking: BundleBooking;
  busyId: string | null;
  panel: Panel;
  onPay: (b: BundleBooking) => void;
  onConfirm: (b: BundleBooking) => void;
  onOpenPanel: (bookingId: string, kind: PanelKind) => void;
  onClosePanel: () => void;
  onRefund: (b: BundleBooking) => void;
  onDispute: (b: BundleBooking, reason: string) => void;
  onSwap: (b: BundleBooking) => void;
  onRemove: (b: BundleBooking) => void;
}) {
  const [reason, setReason] = useState("");
  const pay = booking.payment_status ?? "unpaid";
  const unit = priceUnitLabel(booking.price_unit);
  const status = statusLine(booking);
  const busy = busyId === booking.booking_id;
  const openPanel = panel?.bookingId === booking.booking_id ? panel.kind : null;

  // Mirror the backend's checkout guards so we never offer a button that must
  // fail: only an approved, not-yet-paid booking with a resolvable total.
  const payable =
    booking.status === "approved" && (pay === "unpaid" || pay === "processing");
  const blockedOnQuantity = payable && booking.price_pending_quantity;

  // Escrow actions only exist while the money is held on the platform.
  const held = pay === "paid";
  const youConfirmed = Boolean(booking.customer_confirmed_at);
  const canConfirm = held && !youConfirmed && eventHasPassed(booking.date_iso);
  const refundable = held && withinRefundWindow(booking.paid_at);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="serif text-lg text-ink">{booking.service_name || "Service"}</h3>
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

      {/* Payment */}
      {blockedOnQuantity ? (
        <p className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-xs text-ink-soft">
          This service is priced {unit || "per unit"}. Its total needs a guest count
          or date range before it can be paid — add those in the Jorna app.
        </p>
      ) : payable ? (
        <div className="mt-3 flex justify-end">
          <Button onClick={() => onPay(booking)} disabled={busy}>
            {busy ? "Opening checkout…" : `Pay ${money(booking.price)}`}
          </Button>
        </div>
      ) : null}

      {/* Composition — only while no money has moved */}
      {!isBeyondActionable(booking) ? (
        openPanel === "remove" ? (
          <div className="mt-3 rounded-lg bg-panel p-3">
            <p className="text-xs text-ink-soft">
              Remove {booking.service_name || "this service"} from the bundle? The
              rest of your bundle is unaffected.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="md" disabled={busy} onClick={() => onRemove(booking)}>
                {busy ? "Removing…" : "Remove"}
              </Button>
              <Button variant="ghost" size="md" onClick={onClosePanel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {booking.service_category ? (
              <Button variant="ghost" size="md" onClick={() => onSwap(booking)}>
                Swap service
              </Button>
            ) : null}
            <Button
              variant="quiet"
              size="md"
              onClick={() => onOpenPanel(booking.booking_id, "remove")}
            >
              Remove
            </Button>
          </div>
        )
      ) : null}

      {/* Escrow release */}
      {held ? (
        <div className="mt-3 border-t border-line-soft pt-3">
          {youConfirmed ? (
            <p className="text-xs text-ink-soft">
              You&apos;ve confirmed. The vendor still needs to confirm before the
              payment is released.
            </p>
          ) : !eventHasPassed(booking.date_iso) ? (
            <p className="text-xs text-ink-soft">
              You can confirm after the event
              {booking.date_iso && booking.date_iso !== "TBD"
                ? ` (${booking.date_iso})`
                : ""}
              . Funds are never released before then.
            </p>
          ) : null}

          {openPanel === "refund" ? (
            <div className="rounded-lg bg-panel p-3">
              <p className="text-xs text-ink-soft">
                Request a full refund of {money(booking.price)}? This cancels the
                booking with this vendor. Only the rest of your bundle is unaffected.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="md" disabled={busy} onClick={() => onRefund(booking)}>
                  {busy ? "Requesting…" : "Confirm refund"}
                </Button>
                <Button variant="ghost" size="md" onClick={onClosePanel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : openPanel === "dispute" ? (
            <div className="rounded-lg bg-panel p-3">
              <p className="text-xs text-ink-soft">
                Tell us what went wrong. This freezes only this booking&apos;s payment
                for our team to review — the rest of your bundle carries on.
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="What happened?"
                className="mt-2 w-full rounded-lg border border-card-edge bg-ground-2 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="md"
                  disabled={busy}
                  onClick={() => onDispute(booking, reason)}
                >
                  {busy ? "Submitting…" : "Submit report"}
                </Button>
                <Button variant="ghost" size="md" onClick={onClosePanel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {refundable ? (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => onOpenPanel(booking.booking_id, "refund")}
                >
                  Request refund
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="md"
                onClick={() => onOpenPanel(booking.booking_id, "dispute")}
              >
                Report a problem
              </Button>
              {canConfirm ? (
                <Button disabled={busy} onClick={() => onConfirm(booking)}>
                  {busy ? "Confirming…" : "Confirm & release"}
                </Button>
              ) : null}
            </div>
          )}
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<BundleBooking | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bundleBusy, setBundleBusy] = useState(false);

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

  /** Run an escrow action, then refresh so the new state is authoritative. */
  async function run(
    booking: BundleBooking,
    action: () => Promise<unknown>,
    success: string,
    failure: string,
  ) {
    setBusyId(booking.booking_id);
    setNotice(null);
    try {
      await action();
      setPanel(null);
      setNotice(success);
      await load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : failure);
    } finally {
      setBusyId(null);
    }
  }

  async function saveName() {
    if (!bundleId || !newName.trim()) return;
    setBundleBusy(true);
    try {
      await renameBundle(bundleId, newName.trim());
      setRenaming(false);
      await load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Couldn't rename this bundle.");
    } finally {
      setBundleBusy(false);
    }
  }

  async function removeBundle() {
    if (!bundleId) return;
    setBundleBusy(true);
    try {
      await deleteBundle(bundleId);
      router.push("/bundles");
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Couldn't delete this bundle.");
      setBundleBusy(false);
    }
  }

  async function pay(booking: BundleBooking) {
    setBusyId(booking.booking_id);
    setNotice(null);
    try {
      const { checkout_url } = await createCheckoutSession(booking.booking_id);
      window.location.href = checkout_url;
    } catch (err) {
      setNotice(
        err instanceof ApiError ? err.message : "Couldn't start checkout. Try again.",
      );
      setBusyId(null);
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
        {renaming ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Field
                label="Bundle name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <Button size="md" disabled={bundleBusy} onClick={saveName}>
              {bundleBusy ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="serif text-4xl text-maroon dark:text-gold">
              {bundle.event_name || bundle.name}
            </h1>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setNewName(bundle.event_name || bundle.name || "");
                  setRenaming(true);
                }}
              >
                Rename
              </Button>
              <Button
                variant="quiet"
                size="md"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        {confirmDelete ? (
          <div className="mt-3 rounded-xl bg-panel p-3">
            <p className="text-sm text-ink-soft">
              Delete this bundle and all of its booking requests? This can&apos;t be
              undone.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="md" disabled={bundleBusy} onClick={removeBundle}>
                {bundleBusy ? "Deleting…" : "Delete bundle"}
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

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
            busyId={busyId}
            panel={panel}
            onPay={pay}
            onOpenPanel={(bookingId, kind) => {
              setNotice(null);
              setPanel({ bookingId, kind });
            }}
            onClosePanel={() => setPanel(null)}
            onConfirm={(bk) =>
              run(
                bk,
                () => confirmBookingEvent(bk.booking_id),
                "Thanks — your confirmation is recorded. The payment releases once the vendor confirms too.",
                "Couldn't confirm this booking. Please try again.",
              )
            }
            onRefund={(bk) =>
              run(
                bk,
                () => refundBooking(bk.booking_id),
                "Refund requested. It should appear on your statement within a few days.",
                "Couldn't process the refund. Please try again.",
              )
            }
            onDispute={(bk, reason) =>
              run(
                bk,
                () => disputeBooking(bk.booking_id, reason),
                "Reported. This booking's payment is frozen while our team reviews it.",
                "Couldn't submit the report. Please try again.",
              )
            }
            onSwap={(bk) => {
              setNotice(null);
              setSwapping(bk);
            }}
            onRemove={(bk) =>
              run(
                bk,
                () => removeBookingFromBundle(bundleId!, bk.booking_id),
                "Removed from your bundle.",
                "Couldn't remove that booking. Please try again.",
              )
            }
          />
        ))}
      </section>

      {swapping ? (
        <ServiceSwapPanel
          booking={swapping}
          bundleId={bundleId!}
          eventName={bundle.event_name || bundle.name || "My Event"}
          onClose={() => setSwapping(null)}
          onSwapped={async () => {
            setSwapping(null);
            setNotice("Service swapped — your date, time, and guest count carried over.");
            await load();
          }}
        />
      ) : null}

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
