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

import { listBundles } from "@/lib/jorna";
import type { BundleDetail } from "@/lib/types";
import { ATTENTION_KINDS, planForBundle, taskDetail } from "@/lib/planning";
import { centsMoney } from "@/lib/contract";

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
 * event-detail gaps, which were never in this badge.
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
        // Straight to the booking's row — the plan page scrolls to the hash.
        href: task.bookingId ? `${href}#booking-${task.bookingId}` : href,
        // The amount belongs on the button, and only planning's caller knows
        // it's a button rather than a checklist line. One payment on a
        // schedule asks for that payment, not the whole booking.
        cta:
          task.kind === "payment" && task.amount != null
            ? `Pay ${centsMoney(Math.round(task.amount * 100))}`
            : task.kind === "payment" && booking
              ? `Pay ${money(booking.price)}`
              : task.cta,
        tone: task.tone,
      });
    }
  }
  return items;
}

async function derive(): Promise<AttentionItem[]> {
  // Clients only — a vendor account sees VendorAccountGate, not this list.
  // Their own is on jornaevents.com.
  const bundles = await listBundles().catch(() => [] as BundleDetail[]);
  const found = clientItems(bundles);

  // Unread messages are their own badge on the Messages tab (see nav.tsx's
  // useAppNav), not a Needs-You item — a new message isn't a task with a
  // single next action the way "pay this booking" or "confirm this date" is.

  // Urgent first, but otherwise keep the order things were derived in.
  found.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "urgent" ? -1 : 1));
  return found;
}

// Deriving costs a request, so a badge that recomputed on every navigation
// would be wasteful. Cache briefly and dedupe concurrent callers, so the tab
// bar and /activity mounting together still cost one pass.
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
