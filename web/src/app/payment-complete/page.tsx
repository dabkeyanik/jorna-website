"use client";

// Where Stripe sends the customer back after hosted Checkout (the backend builds
// this URL when the web client passes client=web). The webhook is what really
// marks a booking paid; we additionally call sync-payment here as a safety net
// for a delayed webhook. It's idempotent.

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { syncBookingPayment } from "@/lib/jorna";
import { LinkButton } from "@/components/ui";

type Phase = "working" | "paid" | "cancelled" | "pending";

function PaymentCompleteInner() {
  const { user, loading } = useAuth();
  const params = useSearchParams();
  const bookingId = params.get("booking_id");
  const status = params.get("status");

  const [phase, setPhase] = useState<Phase>(status === "cancel" ? "cancelled" : "working");
  const done = useRef(false);

  useEffect(() => {
    if (loading || done.current) return;
    if (status === "cancel") {
      setPhase("cancelled");
      return;
    }
    if (!bookingId || !user) {
      setPhase("pending");
      return;
    }
    done.current = true;
    syncBookingPayment(bookingId)
      .then(() => setPhase("paid"))
      // A failure here doesn't mean the payment failed — the webhook may simply
      // not have landed yet. Say so instead of alarming the customer.
      .catch(() => setPhase("pending"));
  }, [bookingId, status, user, loading]);

  const copy: Record<Phase, { title: string; body: string }> = {
    working: { title: "Confirming your payment…", body: "One moment." },
    paid: {
      title: "Payment received",
      body: "Your money is held safely in escrow and is only released to the vendor after the event, once you both confirm.",
    },
    cancelled: {
      title: "Checkout cancelled",
      body: "No charge was made. You can pay whenever you're ready.",
    },
    pending: {
      title: "Payment is processing",
      body: "We haven't been able to confirm it just yet. This usually settles within a minute — your bundle will update automatically.",
    },
  };

  const { title, body } = copy[phase];

  return (
    <div className="mx-auto w-[min(560px,100%-2rem)] py-20 text-center">
      <h1 className="serif text-4xl text-maroon dark:text-gold">{title}</h1>
      <p className="mx-auto mt-4 max-w-[46ch] text-ink-soft">{body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/bundles">Back to your bundles</LinkButton>
        <LinkButton href="/browse" variant="ghost">
          Keep browsing
        </LinkButton>
      </div>
    </div>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <PaymentCompleteInner />
    </Suspense>
  );
}
