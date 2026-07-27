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
import { ATTENTION_KINDS, planForBundle, taskDetail } from "@/lib/planning";
import { vendorTasks } from "@/lib/vendorPlan";

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

/**
 * What the client still has to do, from their bundles.
 *
 * The rules themselves live in lib/planning, which the dashboard and the bundle
 * page also read — one set of rules, so the badge and the planning checklist
 * can't disagree. Only ATTENTION_KINDS are surfaced here: planning also derives
 * event-detail gaps and vendor-reply waits, and neither was ever in this badge.
 */
function clientItems(bundles: BundleDetail[]): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const bundle of bundles) {
    const where = bundle.event_name || bundle.name || "your bundle";
    const href = `/bundle?id=${bundle.bundle_id}`;
    const byId = new Map((bundle.bookings ?? []).map((b) => [b.booking_id, b]));

    for (const task of planForBundle(bundle).tasks) {
      if (!ATTENTION_KINDS.includes(task.kind)) continue;
      const booking = task.bookingId ? byId.get(task.bookingId) : undefined;
      items.push({
        id: task.id,
        title: task.title,
        detail: taskDetail(task, where),
        href,
        // The amount belongs on the button, and only planning's caller knows
        // it's a button rather than a checklist line.
        cta: task.kind === "payment" && booking ? `Pay ${money(booking.price)}` : task.cta,
        tone: task.tone,
      });
    }
  }
  return items;
}

/**
 * What the vendor still has to do.
 *
 * The rules live in lib/vendorPlan, which the vendor dashboard also reads, so
 * the badge and the dashboard's action list can't disagree. Stripe is derived
 * there too, which is why it no longer needs adding separately below.
 */
function vendorItems(bookings: VendorBooking[], stripeComplete: boolean | null): AttentionItem[] {
  return vendorTasks(bookings, stripeComplete).map((task) => ({
    id: task.id,
    title: task.title,
    detail: task.detail,
    // Stripe is the account's problem, not a booking's, so it points at the
    // page that fixes it; everything else at the bookings list.
    href: task.kind === "stripe" ? "/my-earnings" : "/my-bookings",
    cta: task.cta,
    // The feed has two tones, and an alarm is an urgent one.
    tone: task.tone === "normal" ? "normal" : "urgent",
  }));
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
    found.push(...vendorItems(bookings, stripe ? stripe.stripe_onboarding_complete : null));
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
