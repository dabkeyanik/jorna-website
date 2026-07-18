"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { deleteEvent, listBundles, listEvents } from "@/lib/jorna";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  categoryLabel,
  type BundleDetail,
  type EventItem,
} from "@/lib/types";
import { Button, Card, LinkButton } from "@/components/ui";

function money(n?: number | null) {
  return n == null ? null : `$${Math.round(n).toLocaleString()}`;
}

function EventInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const eventId = params.get("id");

  const [event, setEvent] = useState<EventItem | null>(null);
  const [bundles, setBundles] = useState<BundleDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=/event${eventId ? `?id=${eventId}` : ""}`);
    }
  }, [authLoading, user, router, eventId]);

  useEffect(() => {
    if (!eventId || !user) return;
    let cancelled = false;
    // No GET /events/{id} — the list is the source of detail. Bundles carry the
    // event link (a booking has no event_id of its own), so the event's vendors
    // are assembled by matching bundles on event_id.
    Promise.all([listEvents(), listBundles().catch(() => [] as BundleDetail[])])
      .then(([events, allBundles]) => {
        if (cancelled) return;
        const found = events.find((e) => e.event_id === eventId) ?? null;
        setEvent(found);
        setBundles(
          allBundles.filter(
            (b) => b.event_id === eventId || b.event?.event_id === eventId,
          ),
        );
      })
      .catch((err) =>
        !cancelled &&
        setError(err instanceof ApiError ? err.message : "Couldn't load this event."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [eventId, user]);

  async function removeEvent() {
    if (!eventId) return;
    setBusy(true);
    try {
      await deleteEvent(eventId);
      router.push("/events");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this event.");
      setBusy(false);
    }
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  if (error || !event) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">{error ?? "Event not found."}</p>
        <LinkButton href="/events" variant="ghost" className="mt-5">
          Back to your events
        </LinkButton>
      </div>
    );
  }

  const allBookings = bundles.flatMap((b) => b.bookings);
  const total = bundles.reduce((sum, b) => sum + (b.total_estimated_cost || 0), 0);

  return (
    <div className="mx-auto w-[min(880px,100%-2rem)] py-10">
      <Link href="/events" className="text-sm text-ink-soft hover:text-ink">
        ← Your events
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="serif text-4xl text-maroon dark:text-gold">{event.name}</h1>
          <p className="mt-2 text-ink-soft">
            {[event.date_iso, event.location].filter(Boolean).join(" · ") ||
              "No date set"}
          </p>
          <p className="mt-1 text-sm text-ink-faint">
            {[
              event.guest_count ? `${event.guest_count} guests` : null,
              money(event.budget) ? `${money(event.budget)} budget` : null,
              `${allBookings.length} ${allBookings.length === 1 ? "vendor" : "vendors"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button variant="quiet" size="md" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </header>

      {confirmDelete ? (
        <div className="mt-4 rounded-xl bg-panel p-3">
          <p className="text-sm text-ink-soft">
            Delete this event? Your bundles and bookings aren&apos;t deleted — they
            just stop being grouped under it.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="md" disabled={busy} onClick={removeEvent}>
              {busy ? "Deleting…" : "Delete event"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {total > 0 ? (
        <p className="serif mt-4 text-2xl text-ink">{money(total)}</p>
      ) : null}

      <section className="mt-9">
        <h2 className="serif text-2xl text-ink">Bundles</h2>
        {bundles.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-card-edge bg-panel p-6 text-center">
            <p className="text-ink-soft">
              Nothing booked under this event yet.
            </p>
            <LinkButton href="/plan" className="mt-4">
              Build a bundle
            </LinkButton>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {bundles.map((b) => (
              <Card key={b.bundle_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/bundle?id=${b.bundle_id}`}
                      className="serif text-lg text-ink hover:text-gold"
                    >
                      {b.event_name || b.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {b.booking_count}{" "}
                      {b.booking_count === 1 ? "vendor" : "vendors"} · {b.status}
                    </p>
                  </div>
                  <p className="serif text-lg text-ink">
                    {money(b.total_estimated_cost)}
                  </p>
                </div>

                <div className="mt-3 grid gap-2">
                  {b.bookings.map((bk) => {
                    const pay = bk.payment_status ?? "unpaid";
                    const state =
                      pay !== "unpaid" && pay !== "processing"
                        ? (PAYMENT_STATUS_LABELS[pay] ?? pay)
                        : (BOOKING_STATUS_LABELS[bk.status] ?? bk.status);
                    return (
                      <div
                        key={bk.booking_id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line-soft bg-panel px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">
                            {bk.service_name || "Service"}
                          </p>
                          <p className="truncate text-xs text-ink-faint">
                            {bk.vendor_name}
                            {bk.service_category
                              ? ` · ${categoryLabel(bk.service_subcategory || bk.service_category)}`
                              : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs text-ink-soft">{state}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function EventPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <EventInner />
    </Suspense>
  );
}
