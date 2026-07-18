"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { createBooking, getService, listBundles } from "@/lib/jorna";
import {
  categoryLabel,
  priceUnitKind,
  priceUnitLabel,
  type BundleDetail,
  type ServiceItem,
} from "@/lib/types";
import { Button, Card, Field } from "@/components/ui";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

const NEW_BUNDLE = "__new__";

function BookInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const serviceId = params.get("service");

  const [service, setService] = useState<ServiceItem | null>(null);
  const [bundles, setBundles] = useState<BundleDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form
  const [eventName, setEventName] = useState("");
  const [dateIso, setDateIso] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [timeStart, setTimeStart] = useState("17:00");
  const [timeEnd, setTimeEnd] = useState("23:00");
  const [location, setLocation] = useState("");
  const [guests, setGuests] = useState("");
  const [bundleChoice, setBundleChoice] = useState(NEW_BUNDLE);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=/book${serviceId ? `?service=${serviceId}` : ""}`);
    }
  }, [authLoading, user, router, serviceId]);

  useEffect(() => {
    if (!serviceId || !user) return;
    let cancelled = false;
    Promise.all([
      getService(serviceId),
      listBundles().catch(() => [] as BundleDetail[]),
    ])
      .then(([s, b]) => {
        if (cancelled) return;
        setService(s);
        setBundles(b);
        // A venue carries its own address + map pin; prefill so the event is
        // anchored there (the venue is what check-in is measured against).
        if (s.location) setLocation(s.location);
      })
      .catch((err) =>
        !cancelled &&
        setError(err instanceof ApiError ? err.message : "Couldn't load this service."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [serviceId, user]);

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  if (error || !service) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">{error ?? "Service not found."}</p>
        <Link href="/browse" className="mt-4 inline-block text-sm text-gold hover:underline">
          Back to browse
        </Link>
      </div>
    );
  }

  const kind = priceUnitKind(service.price_unit);
  const unitLabel = priceUnitLabel(service.price_unit);
  const needsGuests = kind === "person";
  const perDay = kind === "day";

  // Show what they'll actually be charged, using the same arithmetic the backend
  // uses (rate x quantity; day counts the end date inclusively).
  function estimate(): number | null {
    const rate = service?.price ?? 0;
    if (kind === "person") {
      const g = Number(guests);
      return g > 0 ? rate * g : null;
    }
    if (kind === "day") {
      if (!dateIso) return null;
      const start = Date.parse(`${dateIso}T00:00:00Z`);
      const end = Date.parse(`${(multiDay && dateEnd) || dateIso}T00:00:00Z`);
      if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
      const days = Math.round((end - start) / 86400000) + 1;
      return rate * days;
    }
    if (kind === "hour") {
      const [sh, sm] = timeStart.split(":").map(Number);
      const [eh, em] = timeEnd.split(":").map(Number);
      if ([sh, sm, eh, em].some(Number.isNaN)) return null;
      let hours = eh + em / 60 - (sh + sm / 60);
      if (hours <= 0) hours += 24; // crosses midnight
      return hours > 0 && hours <= 24 ? rate * hours : null;
    }
    return rate;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service) return;
    if (needsGuests && !(Number(guests) > 0)) {
      setError("This service is priced per person — add a guest count so we can total it.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createBooking({
        service_id: service.service_id,
        event_name: eventName.trim() || "My Event",
        date_iso: dateIso,
        date_end: multiDay && dateEnd ? dateEnd : null,
        time_start: timeStart,
        time_end: timeEnd,
        location: location.trim(),
        guest_count: guests ? Number(guests) : null,
        venue_latitude: service.venue_latitude ?? null,
        venue_longitude: service.venue_longitude ?? null,
        bundle_id: bundleChoice === NEW_BUNDLE ? null : bundleChoice,
      });
      router.push(`/bundle?id=${res.bundle_id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't request this booking. Try again.",
      );
      setBusy(false);
    }
  }

  const total = estimate();

  return (
    <div className="mx-auto w-[min(680px,100%-2rem)] py-10">
      <Link
        href={`/vendor?id=${service.vendor_id}`}
        className="text-sm text-ink-soft hover:text-ink"
      >
        ← Back to vendor
      </Link>

      <header className="mt-5">
        <span className="eyebrow">Request a booking</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">{service.name}</h1>
        <p className="mt-2 text-ink-soft">
          {service.vendor_name}
          {service.category
            ? ` · ${categoryLabel(service.subcategory || service.category)}`
            : ""}
        </p>
        <p className="serif mt-2 text-xl text-ink">
          {money(service.price)}{" "}
          {unitLabel ? <span className="text-sm text-ink-faint">{unitLabel}</span> : null}
        </p>
      </header>

      <Card className="mt-7 p-6">
        <form onSubmit={submit} className="grid gap-4">
          <Field
            label="Event name"
            placeholder="Priya & Arjun's Wedding"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={multiDay ? "Start date" : "Date"}
              type="date"
              required
              value={dateIso}
              onChange={(e) => setDateIso(e.target.value)}
            />
            {multiDay ? (
              <Field
                label="End date"
                type="date"
                min={dateIso || undefined}
                required
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
              />
            ) : (
              <div className="flex items-end">
                <button
                  type="button"
                  className="pb-2.5 text-sm font-semibold text-gold hover:underline"
                  onClick={() => setMultiDay(true)}
                >
                  + Runs across multiple days
                </button>
              </div>
            )}
          </div>
          {multiDay ? (
            <button
              type="button"
              className="-mt-2 justify-self-start text-xs text-ink-faint hover:text-ink"
              onClick={() => {
                setMultiDay(false);
                setDateEnd("");
              }}
            >
              Single day instead
            </button>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Start time"
              type="time"
              required
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
            />
            <Field
              label="End time"
              type="time"
              required
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
            />
          </div>

          <Field
            label="Location"
            placeholder="Venue or address"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          <Field
            label={needsGuests ? "Guest count (required)" : "Guest count (optional)"}
            type="number"
            min={1}
            required={needsGuests}
            hint={
              needsGuests
                ? "This service is priced per person, so the total needs it."
                : undefined
            }
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          />

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">
              Add to
            </span>
            <select
              value={bundleChoice}
              onChange={(e) => setBundleChoice(e.target.value)}
              className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
            >
              <option value={NEW_BUNDLE}>A new bundle</option>
              {bundles.map((b) => (
                <option key={b.bundle_id} value={b.bundle_id}>
                  {b.event_name || b.name}
                </option>
              ))}
            </select>
          </label>

          {total !== null ? (
            <p className="rounded-lg bg-panel px-3 py-2 text-sm text-ink-soft">
              Estimated total: <strong className="text-ink">{money(total)}</strong>
              {perDay && multiDay ? " (end date included)" : ""}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Sending request…" : "Request booking"}
          </Button>
          <p className="text-center text-xs text-ink-faint">
            The vendor reviews your request first. You only pay once they accept —
            and the money is held in escrow until after the event.
          </p>
        </form>
      </Card>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <BookInner />
    </Suspense>
  );
}
