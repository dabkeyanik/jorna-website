"use client";

// "Needs you" — the one screen that answers what's waiting on you.
//
// Deliberately DERIVED, not pushed. The backend keeps no notification history
// (notify_* sends an FCM push + email and persists nothing), so there is no feed
// to read. Everything here is computed from data the app already fetches, which
// means no backend change, no migration — and no alerts when the tab is closed.
// Real web push is a separate decision (see E2 in WEB_PARITY_PLAN).
//
// Every item mirrors a backend guard, so an action offered here can't be one the
// server must reject.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  getMyVendor,
  getStripeStatus,
  getUnreadCount,
  listBundles,
  listVendorBookings,
} from "@/lib/jorna";
import { eventHasPassed, type BundleDetail, type VendorBooking } from "@/lib/types";
import { Card, LinkButton } from "@/components/ui";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

type Tone = "urgent" | "normal";

interface Item {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: Tone;
}

/** What the client still has to do, from their bundles. */
function clientItems(bundles: BundleDetail[]): Item[] {
  const items: Item[] = [];

  for (const bundle of bundles) {
    const where = bundle.event_name || bundle.name || "your bundle";
    const href = `/bundle?id=${bundle.bundle_id}`;

    for (const b of bundle.bookings ?? []) {
      const pay = b.payment_status ?? "unpaid";
      const service = b.service_name || "a service";
      const vendor = b.vendor_name || "the vendor";

      // Money is held and the event is over — the client's confirm is the only
      // thing between the vendor and their payout. Gated on the booking's LAST
      // day, like the backend's event_confirmable_date.
      if (pay === "paid" && !b.customer_confirmed_at && eventHasPassed(b.date_end || b.date_iso)) {
        items.push({
          id: `confirm-${b.booking_id}`,
          title: `Confirm ${service} happened`,
          detail: `${vendor} · ${where} — this releases their payment.`,
          href,
          cta: "Confirm",
          tone: "urgent",
        });
        continue;
      }

      // Approved and waiting on payment. Mirrors the checkout guard: a total
      // still pending a quantity can't be paid, so don't offer a Pay button.
      if (b.status === "approved" && (pay === "unpaid" || pay === "processing")) {
        if (b.price_pending_quantity) {
          items.push({
            id: `quantity-${b.booking_id}`,
            title: `${service} needs a guest count or dates`,
            detail: `${vendor} · ${where} — its total can't be worked out until then, so it can't be paid yet.`,
            href,
            cta: "View",
            tone: "normal",
          });
        } else {
          items.push({
            id: `pay-${b.booking_id}`,
            title: `Pay for ${service}`,
            detail: `${vendor} · ${where}`,
            href,
            cta: `Pay ${money(b.price)}`,
            tone: "normal",
          });
        }
      }
    }
  }
  return items;
}

/** What the vendor still has to do, from their booking requests. */
function vendorItems(bookings: VendorBooking[]): Item[] {
  const items: Item[] = [];

  for (const b of bookings) {
    const service = b.service_name || "a service";
    const client = b.client_name || "A client";

    // Someone is waiting on an answer.
    if (b.status === "pending") {
      items.push({
        id: `request-${b.booking_id}`,
        title: `${client} wants to book ${service}`,
        detail: b.date_iso && b.date_iso !== "TBD" ? `For ${b.date_iso}` : "Date to be confirmed",
        href: "/my-bookings",
        cta: "Answer",
        tone: "urgent",
      });
      continue;
    }

    // Paid, but the vendor's half of the release is outstanding — this is their
    // own money waiting.
    if ((b.payment_status ?? "unpaid") === "paid" && !b.vendor_confirmed_at) {
      const atVenue = b.venue_latitude != null && b.venue_longitude != null;
      const canAct = atVenue || eventHasPassed(b.date_end || b.date_iso);
      if (canAct) {
        items.push({
          id: `release-${b.booking_id}`,
          title: atVenue
            ? `Check in at the venue for ${service}`
            : `Confirm ${service} happened`,
          detail: `${client} — your payout is waiting on this.`,
          href: "/my-bookings",
          cta: atVenue ? "Check in" : "Confirm",
          tone: "urgent",
        });
      }
    }
  }
  return items;
}

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/activity");
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    const found: Item[] = [];

    // A vendor's own money comes first: without Stripe onboarding a client
    // literally cannot pay them, and checkout refuses.
    const vendor = await getMyVendor().catch(() => null);
    if (vendor) {
      const [stripe, bookings] = await Promise.all([
        getStripeStatus(vendor.vendor_id).catch(() => null),
        listVendorBookings(vendor.vendor_id, { limit: 100 })
          .then((r) => r.items)
          .catch(() => [] as VendorBooking[]),
      ]);
      if (stripe && !stripe.stripe_onboarding_complete) {
        found.push({
          id: "stripe",
          title: "Finish your payment setup",
          detail: "Until this is done you can accept bookings, but clients can't pay you.",
          href: "/my-earnings",
          cta: "Set up",
          tone: "urgent",
        });
      }
      found.push(...vendorItems(bookings));
    }

    const bundles = await listBundles().catch(() => [] as BundleDetail[]);
    found.push(...clientItems(bundles));

    const unread = await getUnreadCount().catch(() => ({ unread_count: 0 }));
    if (unread.unread_count > 0) {
      found.push({
        id: "messages",
        title: `${unread.unread_count} unread ${unread.unread_count === 1 ? "message" : "messages"}`,
        detail: "In your event group chats.",
        href: "/messages",
        cta: "Read",
        tone: "normal",
      });
    }

    // Urgent first, but otherwise keep the order things were derived in.
    found.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "urgent" ? -1 : 1));
    setItems(found);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading || !user || items === null) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div className="mx-auto w-[min(680px,100%-2rem)] py-10">
      <h1 className="serif text-4xl text-maroon dark:text-gold">Needs you</h1>
      <p className="mt-2 text-ink-soft">
        Everything waiting on you, in one place.
      </p>

      {items.length === 0 ? (
        <Card className="mt-8 p-6 text-center">
          <p className="text-ink-soft">You&apos;re all caught up.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <LinkButton href="/plan" size="md">
              Plan an event
            </LinkButton>
            <LinkButton href="/browse" variant="ghost" size="md">
              Browse vendors
            </LinkButton>
          </div>
        </Card>
      ) : (
        <div className="mt-8 grid gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-xl border border-card-edge bg-card px-4 py-3 transition hover:border-gold/50"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  {item.tone === "urgent" ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  ) : null}
                  <span className="text-sm font-semibold text-ink">{item.title}</span>
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">{item.detail}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-gold">{item.cta} ›</span>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-ink-faint">
        This list is worked out live from your bookings and messages — Jorna
        can&apos;t alert your browser while this tab is closed.
      </p>
    </div>
  );
}
