"use client";

// The negotiation workspace as a wide panel over the Leads page — the
// design's "Contract negotiation" overlay. Full-screen on a phone. Not
// portalled, like the lead drawer, so it keeps .vendor-shell's tokens.

import { useOverlay } from "@jorna/shared/components/useOverlay";
import { VendorNegotiation } from "./VendorNegotiation";

export function NegotiationPanel({
  bookingId,
  onClose,
  onDone,
  onDetails,
}: {
  bookingId: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
  /** Open the lead drawer instead — copy link, void, archive. */
  onDetails?: () => void;
}) {
  const ref = useOverlay<HTMLDivElement>(Boolean(bookingId), onClose);
  if (!bookingId) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-[#2a0c19]/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Contract negotiation"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-ground shadow-[-20px_0_60px_rgba(42,12,25,0.18)] outline-none lg:w-[min(76rem,calc(100%-4rem))] lg:border-l lg:border-card-edge"
      >
        <VendorNegotiation
          bookingId={bookingId}
          onClose={onClose}
          onDone={onDone}
          headerActions={
            onDetails ? (
              <button
                type="button"
                onClick={onDetails}
                className="rounded-full border border-card-edge px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-gold"
              >
                Lead details
              </button>
            ) : null
          }
        />
      </div>
    </div>
  );
}
