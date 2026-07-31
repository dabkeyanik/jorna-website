"use client";

// The vendor dashboard, ported from the Figma Make design ("Design Revision
// Request", 2026-07-27). It answers the three things a vendor opens the app
// for: what needs me, when is my next job, and where is my money.
//
// Ported rather than dropped in, the same way the marketing page was. The Make
// export writes every colour as an inline style="var(--maroon)"; the values
// match globals.css exactly but the names don't, so this is rebuilt on the
// app's own utilities. The design's left sidebar is dropped too — the app has
// a header nav and a phone tab bar already, and a third shell would make the
// vendor side feel like a different product.
//
// Three things in the design were not carried over, because the API can't back
// them:
//
//   - "Expires in 18 h" on a request. Nothing expires: there is no expiry,
//     deadline, or respond-by field anywhere in the schema.
//   - "Platform fee is 10%". No rate is published — only a per-booking
//     platform_fee_cents — so the real rate is derived from what was taken and
//     simply omitted when there's nothing to derive it from.
//   - Invented review authors and job addresses; these read from the API.
//
// The action list, the money, the jobs and the listing health all come from
// lib/vendorPlan, which lib/attention also reads — so this and the "Needs you"
// badge can't disagree.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  confirmBookingEvent,
  getEarnings,
  getMyAvailability,
  getMyVendor,
  getStripeStatus,
  getUnreadCount,
  getVendorReviews,
  listServices,
  listVendorBookings,
  setBookingStatus,
  startStripeOnboarding,
} from "@/lib/jorna";
import { clearAttentionCache } from "@/lib/attention";
import { checkInAtVenue, LocationError } from "@/lib/checkin";
import {
  centsToMoney,
  daysUntil,
  listingHealth,
  vendorJobs,
  vendorMoney,
  vendorRequests,
  vendorTasks,
  type HealthIssue,
  type VendorJob,
  type VendorMoney,
  type VendorTask,
} from "@/lib/vendorPlan";
import {
  categoryLabel,
  priceLine,
  WEEKDAYS,
  type AvailabilitySlot,
  type Earnings,
  type Review,
  type ServiceItem,
  type StripeStatus,
  type VendorBooking,
  type VendorDetail,
} from "@/lib/types";
import { Avatar, Button, Card, LinkButton, Stars } from "@/components/ui";
import { VendorNav } from "@/components/VendorNav";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function prettyDate(iso?: string | null): string | null {
  if (!iso || iso === "TBD") return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function clock(raw?: string | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function whenLabel(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return prettyDate(iso) ?? iso;
}

/** Everything the page reads, fetched in one pass. */
interface Snapshot {
  vendor: VendorDetail | null;
  bookings?: VendorBooking[];
  earnings?: Earnings | null;
  stripe?: StripeStatus | null;
  services?: ServiceItem[];
  availability?: AvailabilitySlot[];
  reviews?: Review[];
  unread?: number;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="eyebrow mb-3">{children}</h2>;
}

// ── Needs you ────────────────────────────────────────────────────────

function ActionRow({
  task,
  busy,
  onAct,
}: {
  task: VendorTask;
  busy: boolean;
  onAct: (task: VendorTask) => void;
}) {
  const alarm = task.tone === "alarm";
  return (
    <div
      className={`flex items-start gap-3.5 rounded-2xl p-4 ${
        alarm
          ? "border-[1.5px] border-maroon bg-maroon/[0.06] dark:border-gold dark:bg-gold/[0.08]"
          : "border border-card-edge bg-card shadow-[var(--shadow-card)]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2 shrink-0 rounded-full ${
          alarm ? "bg-maroon dark:bg-gold" : task.tone === "urgent" ? "bg-gold" : "bg-gold/50"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${
            alarm ? "text-maroon dark:text-gold" : "text-ink"
          }`}
        >
          {task.title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{task.detail}</p>
        <div className="mt-3">
          <Button
            variant={alarm ? "primary" : "ghost"}
            size="md"
            disabled={busy}
            onClick={() => onAct(task)}
          >
            {busy ? "Working…" : task.cta}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Money ────────────────────────────────────────────────────────────

function Bucket({
  label,
  cents,
  count,
  dot,
  value,
}: {
  label: string;
  cents: number;
  count?: number;
  dot: string;
  value: string;
}) {
  return (
    <div className="flex-1 rounded-2xl border border-card-edge bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
          {label}
        </p>
        <span aria-hidden="true" className={`mt-1 size-2 shrink-0 rounded-full ${dot}`} />
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${value}`}>
        {centsToMoney(cents)}
      </p>
      {count != null ? (
        <p className="mt-0.5 text-xs text-ink-faint">
          {count} {count === 1 ? "booking" : "bookings"}
        </p>
      ) : null}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function VendorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [notVendor, setNotVendor] = useState(false);
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [cash, setCash] = useState<VendorMoney | null>(null);
  const [feeHistory, setFeeHistory] = useState<
    { label: string; gross: number; fee: number; net: number }[]
  >([]);
  // The whole status, not just whether it's complete: what Stripe is waiting on
  // is the part a vendor can act on, and paymentsSetup needs it to say so.
  const [stripe, setStripe] = useState<StripeStatus | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/my-dashboard");
  }, [authLoading, user, router]);

  /**
   * Fetch without touching state, so the effect below can set it inside a
   * `.then` — a state setter called straight from an effect body is the
   * cascading-render pattern the lint rule is about.
   */
  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!user) return null;
    const me = await getMyVendor().catch(() => null);
    if (!me) return { vendor: null };

    // Each of these is a section of the page; one failing should cost that
    // section, not the dashboard.
    const [bookings, earnings, stripe, services, availability, reviews, unread] =
      await Promise.all([
        listVendorBookings(me.vendor_id, { limit: 100 })
          .then((r) => r.items)
          .catch(() => [] as VendorBooking[]),
        getEarnings(me.vendor_id).catch(() => null),
        getStripeStatus(me.vendor_id).catch(() => null),
        listServices({ vendor_id: me.vendor_id, limit: 100 })
          .then((r) => r.items)
          .catch(() => [] as ServiceItem[]),
        getMyAvailability().catch(() => [] as AvailabilitySlot[]),
        getVendorReviews(me.vendor_id)
          .then((r) => r.items)
          .catch(() => [] as Review[]),
        // Not a vendorTasks item: lib/attention already emits its own unread
        // row for the badge, and adding one there would count every message
        // twice. The dashboard was simply missing it.
        getUnreadCount()
          .then((r) => r.unread_count)
          .catch(() => 0),
      ]);

    return {
      vendor: me, bookings, earnings, stripe, services, availability, reviews, unread,
    };
  }, [user]);

  const apply = useCallback((snap: Snapshot | null) => {
    if (!snap) return;
    if (!snap.vendor) {
      setNotVendor(true);
      setLoading(false);
      return;
    }
    setVendor(snap.vendor);
    setBookings(snap.bookings ?? []);
    setCash(vendorMoney(snap.earnings ?? null));
    setFeeHistory(
      (snap.earnings?.history ?? []).map((h) => ({
        label: h.event_name || h.client_name || "Booking",
        gross: h.amount_cents ?? 0,
        fee: h.platform_fee_cents ?? 0,
        net: h.net_cents ?? 0,
      })),
    );
    setStripe(snap.stripe ?? null);
    setServices(snap.services ?? []);
    setAvailability(snap.availability ?? []);
    setReviews(snap.reviews ?? []);
    setUnread(snap.unread ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAll().then((snap) => {
      if (!cancelled) apply(snap);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAll, apply]);

  /** Re-read after an action, so the new state is the server's. */
  const reload = useCallback(async () => {
    apply(await fetchAll());
  }, [fetchAll, apply]);

  async function act(task: VendorTask) {
    setBusyId(task.id);
    setNotice(null);
    try {
      if (task.kind === "stripe" && vendor) {
        const { onboarding_url } = await startStripeOnboarding(vendor.vendor_id);
        window.location.href = onboarding_url;
        return;
      }
      if (task.kind === "confirm" && task.bookingId) {
        await confirmBookingEvent(task.bookingId);
        setNotice("Confirmed — your payout is released once the client confirms too.");
      } else if (task.kind === "check-in" && task.bookingId) {
        await checkInAtVenue(task.bookingId);
        setNotice("Checked in. Your client has been told you've arrived.");
      } else if (
        task.kind === "request" ||
        task.kind === "negotiation" ||
        task.kind === "date-change"
      ) {
        // Answered on /my-bookings, which owns the negotiation panel and the
        // date-change accept/decline. Requests don't reach here — the dashboard
        // filters them out in favour of its own Requests section — but the kind
        // stays listed so this can't silently do nothing if that changes back.
        router.push("/my-bookings");
        return;
      }
      clearAttentionCache();
      await reload();
    } catch (err) {
      setNotice(
        err instanceof LocationError || err instanceof ApiError
          ? err.message
          : "That didn't work. Try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function answer(bookingId: string, status: "approved" | "rejected") {
    setBusyId(bookingId);
    setNotice(null);
    try {
      await setBookingStatus(bookingId, status);
      setNotice(status === "approved" ? "Booking accepted." : "Request declined.");
      clearAttentionCache();
      await reload();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  if (notVendor) {
    return (
      <div className="mx-auto w-[min(560px,100%-2rem)] py-20 text-center">
        <h1 className="serif text-3xl text-maroon dark:text-gold">
          This is the vendor dashboard
        </h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-ink-soft">
          You don&apos;t have a vendor profile yet. Set one up to list services, take
          bookings, and get paid through escrow.
        </p>
        <LinkButton href="/vendor-profile" className="mt-6">
          Start selling
        </LinkButton>
      </div>
    );
  }

  // Everything vendorTasks knows, minus the requests. Their row here was a
  // link to /my-bookings while the Requests section below — on this same page —
  // has Accept and Decline on it, so the jump was a longer route to a button
  // already on screen. They stay in vendorTasks for the "Needs you" badge,
  // which has no Requests section to defer to.
  const tasks = vendorTasks(bookings, stripe).filter((t) => t.kind !== "request");
  const jobs = vendorJobs(bookings);
  const requests = vendorRequests(bookings);
  const health = listingHealth({ vendor, services, availability });
  const name = [vendor?.f_name, vendor?.l_name].filter(Boolean).join(" ");

  return (
    <div className="mx-auto w-[min(1080px,100%-2rem)] py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={vendor?.pfp_url} name={name} size={48} />
          <div className="min-w-0">
            <span className="eyebrow">Vendor dashboard</span>
            <h1 className="serif mt-1 text-3xl text-maroon dark:text-gold sm:text-4xl">
              {name || "Your business"}
            </h1>
            {vendor?.category ? (
              <p className="text-sm text-ink-faint">
                {categoryLabel(vendor.subcategory || vendor.category)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-6">
        <VendorNav />
      </div>

      {notice ? (
        <p className="mb-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {notice}
        </p>
      ) : null}

      {/* ── Needs you ── */}
      {tasks.length > 0 || unread > 0 ? (
        <section className="mt-8">
          <SectionLabel>Needs you</SectionLabel>
          <div className="grid gap-2.5">
            {tasks.map((task) => (
              <ActionRow
                key={task.id}
                task={task}
                busy={busyId === task.id}
                onAct={act}
              />
            ))}
            {/* Last, because a message is the one thing here nobody's money is
                waiting on. */}
            {unread > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-card-edge bg-card p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {unread} unread {unread === 1 ? "message" : "messages"}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    In your event group chats.
                  </p>
                </div>
                <LinkButton href="/messages" variant="ghost" size="md">
                  Read
                </LinkButton>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <p className="mt-8 rounded-2xl border border-card-edge bg-panel p-5 text-center text-ink-soft">
          Nothing needs you right now.
        </p>
      )}

      {/* ── Requests ──
          Above the money, because it is the one section that is a decision
          rather than a readout: a client is waiting, and the answer takes two
          seconds if the button is in front of them. */}
      {requests.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-3">
            <SectionLabel>Requests</SectionLabel>
            <span className="mb-3 text-sm font-semibold text-maroon dark:text-gold">
              {requests.length} pending
            </span>
          </div>
          <div className="grid gap-2.5">
            {requests.map((r) => {
              const price = priceLine(r);
              return (
                <Card key={r.booking_id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="serif text-lg text-ink">
                        {r.client_name || "A client"}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {[r.event_name, prettyDate(r.date_iso)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-maroon dark:text-gold">
                        {money(price.amount)}
                      </p>
                      {price.caption ? (
                        <p className="text-xs text-ink-faint">{price.caption}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                    {r.negotiable ? (
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 font-medium text-gold">
                        Negotiable
                      </span>
                    ) : null}
                    {r.guest_count ? <span>{r.guest_count} guests</span> : null}
                    {r.location ? <span className="truncate">{r.location}</span> : null}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="md"
                      disabled={busyId === r.booking_id}
                      onClick={() => answer(r.booking_id, "approved")}
                    >
                      {busyId === r.booking_id ? "Working…" : "Accept"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      disabled={busyId === r.booking_id}
                      onClick={() => answer(r.booking_id, "rejected")}
                    >
                      Decline
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── Money ── */}
      {cash ? (
        <section className="mt-10">
          <SectionLabel>Money</SectionLabel>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Bucket
              label="Released"
              cents={cash.releasedCents}
              dot="bg-green"
              value="text-green"
            />
            <Bucket
              label="In escrow"
              cents={cash.inEscrowCents}
              dot="bg-gold"
              value="text-gold"
            />
            <Bucket
              label="Upcoming"
              cents={cash.upcomingCents}
              count={cash.upcomingCount}
              dot="bg-ink-faint"
              value="text-ink-soft"
            />
          </div>

          {cash.disputedCents > 0 || cash.refundedCents > 0 ? (
            <p className="mt-2.5 rounded-xl border border-maroon/40 bg-maroon/[0.06] px-3.5 py-2.5 text-sm text-maroon dark:text-gold">
              {cash.disputedCents > 0
                ? `${centsToMoney(cash.disputedCents)} is under dispute and can't move yet.`
                : null}
              {cash.disputedCents > 0 && cash.refundedCents > 0 ? " " : null}
              {cash.refundedCents > 0
                ? `${centsToMoney(cash.refundedCents)} has been refunded.`
                : null}
            </p>
          ) : null}

          {feeHistory.length > 0 ? (
            <Card className="mt-2.5 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm font-semibold text-ink">Per-booking breakdown</p>
                <p className="text-xs text-ink-faint">Gross · fee · net</p>
              </div>
              {feeHistory.slice(0, 6).map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3"
                >
                  <p className="min-w-0 truncate text-sm text-ink">{row.label}</p>
                  <div className="flex shrink-0 items-baseline gap-1.5 text-sm tabular-nums">
                    <span className="text-ink-faint">{centsToMoney(row.gross)}</span>
                    <span className="text-xs text-ink-faint">−</span>
                    <span className="text-maroon dark:text-gold">
                      {centsToMoney(row.fee)}
                    </span>
                    <span className="text-xs text-ink-faint">=</span>
                    <span className="font-bold text-ink">{centsToMoney(row.net)}</span>
                  </div>
                </div>
              ))}
              <p className="border-t border-line-soft px-4 py-3 text-xs text-ink-faint">
                {/* Derived, not asserted: the API publishes no rate, only what it
                    took per booking. */}
                {cash.feePercent != null
                  ? `Jorna's fee has been ${cash.feePercent}% of gross so far. `
                  : null}
                Amounts are net to you. Money is held in escrow until you and the client
                both confirm.
              </p>
            </Card>
          ) : null}
        </section>
      ) : null}

      {/* ── Next jobs ── */}
      {jobs.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-3">
            <SectionLabel>Next jobs</SectionLabel>
            <Link
              href="/my-bookings"
              className="mb-3 text-sm font-medium text-maroon transition hover:text-gold dark:text-gold"
            >
              All bookings
            </Link>
          </div>
          <div className="grid gap-2.5">
            {jobs.slice(0, 6).map((job) => (
              <JobRow key={job.booking.booking_id} job={job} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Availability ──
          Only once there are hours to show. Empty, this was a card saying
          "you haven't set any weekly hours" directly above a listing-health row
          saying the same thing with the same button — and the health list is
          where it belongs, next to the other reasons a vendor isn't getting
          found. */}
      {availability.length > 0 ? (
        <section className="mt-10">
          <SectionLabel>Availability</SectionLabel>
          <Card className="overflow-hidden">
            <>
              {WEEKDAYS.map((day, i) => {
                const slots = availability.filter((s) => s.day_of_week === i);
                return (
                  <div
                    key={day}
                    className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0"
                  >
                    <span className="text-sm text-ink-soft">{day}</span>
                    {slots.length === 0 ? (
                      <span className="text-sm text-ink-faint">Unavailable</span>
                    ) : (
                      <span className="flex flex-wrap justify-end gap-1.5">
                        {slots.map((s, n) => (
                          <span
                            key={n}
                            className="rounded-full bg-panel px-2.5 py-0.5 text-xs tabular-nums text-ink"
                          >
                            {s.start_time} – {s.end_time}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}
              <div className="px-4 py-3">
                <LinkButton href="/my-availability" variant="ghost" size="md">
                  Edit hours
                </LinkButton>
              </div>
            </>
          </Card>
        </section>
      ) : null}

      {/* ── Listing health ── */}
      {health.length > 0 ? (
        <section className="mt-10">
          <SectionLabel>Why you might not be getting booked</SectionLabel>
          <div className="grid gap-2">
            {health.map((h) => (
              <HealthRow key={h.id} issue={h} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Reputation ── */}
      {vendor?.rating || reviews.length > 0 ? (
        <section className="mt-10">
          <SectionLabel>Reputation</SectionLabel>
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline gap-6">
              {vendor?.rating ? (
                <div>
                  <p className="serif text-4xl text-maroon dark:text-gold">
                    {vendor.rating.toFixed(1)}
                  </p>
                  <Stars rating={vendor.rating} />
                </div>
              ) : null}
              <div>
                <p className="text-xl font-bold text-ink">{reviews.length}</p>
                <p className="text-xs text-ink-faint">Reviews</p>
              </div>
              {vendor?.num_events ? (
                <div>
                  <p className="text-xl font-bold text-ink">{vendor.num_events}</p>
                  <p className="text-xs text-ink-faint">Events</p>
                </div>
              ) : null}
            </div>

            {reviews.slice(0, 3).map((r) => (
              <div key={r.review_id} className="mt-4 border-t border-line-soft pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-ink-faint">
                    {r.created_at ? prettyDate(r.created_at.slice(0, 10)) : null}
                  </span>
                </div>
                {r.comment ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    {r.comment}
                  </p>
                ) : null}
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {/* No "all your bookings" footer. The same link is on the section above,
          where it's next to the six jobs it's offering to extend, and again in
          VendorNav at the top of the page. Three routes to one list. */}
    </div>
  );
}

function JobRow({ job }: { job: VendorJob }) {
  const b = job.booking;
  const start = clock(b.time_start);
  const end = clock(b.time_end);
  const here = Boolean(b.vendor_checked_in_at);

  return (
    <div
      className={`overflow-hidden rounded-2xl shadow-[var(--shadow-card)] ${
        job.isToday
          ? "border border-maroon bg-maroon/[0.04] dark:border-gold dark:bg-gold/[0.06]"
          : "border border-card-edge bg-card"
      }`}
    >
      {job.isToday ? (
        <p className="bg-maroon px-4 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ground dark:bg-gold">
          Today
        </p>
      ) : null}
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="serif text-lg text-ink">{b.client_name || "A client"}</p>
            <p className="text-xs uppercase tracking-[0.1em] text-ink-faint">
              {b.service_name || "Service"}
            </p>
          </div>
          {here ? (
            <span className="rounded-full bg-green/12 px-2.5 py-0.5 text-xs font-medium text-green">
              Checked in
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-faint">{whenLabel(job.dateIso)}</p>
            <p className="text-sm font-semibold text-ink">
              {start ? `${start}${end ? ` – ${end}` : ""}` : "Time not set"}
            </p>
          </div>
          {b.location ? (
            <p className="text-sm leading-relaxed text-ink-soft">{b.location}</p>
          ) : null}
        </div>
        {b.guest_count && b.guest_count > 1 ? (
          <p className="mt-3 border-t border-line-soft pt-2.5 text-xs text-ink-faint">
            {b.guest_count} guests expected
          </p>
        ) : null}
      </div>
    </div>
  );
}

function HealthRow({ issue }: { issue: HealthIssue }) {
  const critical = issue.severity === "critical";
  return (
    <div
      className={`flex items-start gap-3 rounded-xl p-4 ${
        critical
          ? "border border-maroon bg-maroon/[0.05] dark:border-gold dark:bg-gold/[0.07]"
          : "border border-card-edge bg-card"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2 shrink-0 rounded-full ${
          critical ? "bg-maroon dark:bg-gold" : "bg-gold"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${
            critical ? "text-maroon dark:text-gold" : "text-ink"
          }`}
        >
          {issue.issue}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{issue.consequence}</p>
        <div className="mt-3">
          <LinkButton
            href={issue.href}
            variant={critical ? "primary" : "ghost"}
            size="md"
          >
            {issue.cta}
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
