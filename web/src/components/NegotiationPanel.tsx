"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  acceptOffer,
  counterOffer,
  getNegotiation,
  rejectOffer,
  startNegotiation,
} from "@/lib/jorna";
import type { Negotiation } from "@/lib/types";
import { Button } from "./ui";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * Price negotiation for one booking — works for either party.
 *
 * It's turn-based: `proposed_by` is whoever made the current offer, and only the
 * other party can counter or accept (the backend enforces this). Accepting sets
 * the booking's price and approves it, so the parent refreshes via onSettled.
 */
export function NegotiationPanel({
  bookingId,
  listedPrice,
  onSettled,
}: {
  bookingId: string;
  /** The current listed price (dollars), used as the offer field's starting point. */
  listedPrice: number;
  onSettled?: () => void;
}) {
  const { user } = useAuth();
  const [neg, setNeg] = useState<Negotiation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOffer, setShowOffer] = useState(false);
  const [amount, setAmount] = useState<string>("");

  const load = useCallback(async () => {
    try {
      setNeg(await getNegotiation(bookingId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the negotiation.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<Negotiation>, settled = false) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      setNeg(updated);
      setShowOffer(false);
      setAmount("");
      if (settled) onSettled?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function submitOffer() {
    const cents = Math.round(Number(amount) * 100);
    if (!(cents > 0)) {
      setError("Enter an amount greater than zero.");
      return;
    }
    void run(() =>
      neg
        ? counterOffer(neg.negotiation_id, cents)
        : startNegotiation(bookingId, cents),
    );
  }

  if (loading) return null;

  const mineIsCurrent = neg != null && neg.proposed_by === user?.user_id;
  const status = neg?.status ?? "none";

  return (
    <div className="rounded-lg bg-panel p-3">
      {status === "accepted" ? (
        <p className="text-xs text-green">
          Agreed at {money(neg!.current_offer_cents)}. The booking is approved at
          that price.
        </p>
      ) : status === "rejected" ? (
        <p className="text-xs text-ink-faint">Negotiation closed.</p>
      ) : (
        <>
          {neg ? (
            <div className="mb-2">
              <p className="text-xs text-ink-soft">
                Current offer{" "}
                <span className="font-semibold text-ink">
                  {money(neg.current_offer_cents)}
                </span>{" "}
                — {mineIsCurrent ? "you" : neg.proposed_by_name || "the other party"}
              </p>
            </div>
          ) : null}

          {showOffer || !neg ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-ink-faint">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={String(listedPrice)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-28 rounded-lg border border-card-edge bg-ground-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
                />
              </div>
              <Button size="md" disabled={busy} onClick={submitOffer}>
                {busy ? "Sending…" : neg ? "Counter" : "Send offer"}
              </Button>
              {neg ? (
                <Button variant="ghost" size="md" onClick={() => setShowOffer(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          ) : mineIsCurrent ? (
            <p className="text-xs text-ink-faint">
              Waiting for {neg.proposed_by_name || "the other party"} to respond.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="md"
                disabled={busy}
                onClick={() => void run(() => acceptOffer(neg!.negotiation_id), true)}
              >
                {busy ? "…" : `Accept ${money(neg!.current_offer_cents)}`}
              </Button>
              <Button variant="ghost" size="md" onClick={() => setShowOffer(true)}>
                Counter
              </Button>
              <Button
                variant="quiet"
                size="md"
                disabled={busy}
                onClick={() => void run(() => rejectOffer(neg!.negotiation_id))}
              >
                Decline
              </Button>
            </div>
          )}
        </>
      )}

      {error ? <p className="mt-2 text-xs text-maroon dark:text-gold">{error}</p> : null}
    </div>
  );
}
