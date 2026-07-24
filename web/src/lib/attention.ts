"use client";

// What's waiting on you, derived from data the app already fetches.
//
// There is no notification feed to read: the backend's notify_* sends an FCM
// push + an email and persists nothing, so this is computed, not stored. Lives
// here rather than in the page because the tab bar badge and /activity must show
// the same number — two copies of these rules would drift.
//
// Every rule mirrors a backend guard, so an item never points at an action the
// server must reject.

import {
  getMyVendor,
  getStripeStatus,
  getUnreadCount,
  listBundles,
  listVendorBookings,
} from "@/lib/jorna";
import { eventHasPassed, type BundleDetail, type VendorBooking } from "@/lib/types";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export type Tone = "urgent" | "normal";

export interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: Tone;
}

/** What the client still has to do, from their bundles. */
function clientItems(bundles: BundleDetail[]): AttentionItem[] {
  const items: AttentionItem[] = [];

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
function vendorItems(bookings: VendorBooking[]): AttentionItem[] {
  const items: AttentionItem[] = [];

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

async function derive(): Promise<AttentionItem[]> {
  const found: AttentionItem[] = [];

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
  return found;
}

// Deriving costs 2 requests for a client and 4 for a vendor, so a badge that
// recomputed on every navigation would be wasteful. Cache briefly and dedupe
// concurrent callers, so the tab bar and /activity mounting together still cost
// one pass.
const TTL_MS = 60_000;
let cache: { at: number; items: AttentionItem[] } | null = null;
let inflight: Promise<AttentionItem[]> | null = null;

export function clearAttentionCache() {
  cache = null;
}

export function loadAttention(opts: { force?: boolean } = {}): Promise<AttentionItem[]> {
  if (!opts.force && cache && Date.now() - cache.at < TTL_MS) {
    return Promise.resolve(cache.items);
  }
  if (inflight) return inflight;
  inflight = derive()
    .then((items) => {
      cache = { at: Date.now(), items };
      return items;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
