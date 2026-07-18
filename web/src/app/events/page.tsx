"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { createEvent, listEvents } from "@/lib/jorna";
import type { EventItem } from "@/lib/types";
import { Button, Card, Field } from "@/components/ui";

function money(n?: number | null) {
  return n == null ? null : `$${Math.round(n).toLocaleString()}`;
}

export default function EventsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [dateIso, setDateIso] = useState("");
  const [location, setLocation] = useState("");
  const [guests, setGuests] = useState("");
  const [budget, setBudget] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/events");
  }, [authLoading, user, router]);

  async function load() {
    try {
      setEvents(await listEvents());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createEvent({
        name: name.trim(),
        date_iso: dateIso,
        location: location.trim(),
        guest_count: guests ? Number(guests) : null,
        budget: budget ? Number(budget) : null,
      });
      setCreating(false);
      setName("");
      setDateIso("");
      setLocation("");
      setGuests("");
      setBudget("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that event.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div className="mx-auto w-[min(880px,100%-2rem)] py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Your events</span>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
            Celebrations
          </h1>
        </div>
        {!creating ? (
          <Button onClick={() => setCreating(true)}>New event</Button>
        ) : null}
      </header>

      {creating ? (
        <Card className="mt-7 p-6">
          <h2 className="serif text-xl text-ink">New event</h2>
          <form onSubmit={submit} className="mt-4 grid gap-4">
            <Field
              label="Event name"
              placeholder="Priya & Arjun's Wedding"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Date"
                type="date"
                required
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
              />
              <Field
                label="Location"
                placeholder="Jersey City, NJ"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Guests (optional)"
                type="number"
                min={1}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
              />
              <Field
                label="Budget (optional)"
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            {error ? (
              <p className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create event"}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {error && !creating ? (
        <p className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-10 text-center text-ink-soft">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-10 text-center text-ink-soft">
          No events yet. Create one, or just build a bundle and we&apos;ll set one up
          for you.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {events.map((ev) => (
            <Link key={ev.event_id} href={`/event?id=${ev.event_id}`}>
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-gold/50">
                <h2 className="serif text-xl text-ink">{ev.name}</h2>
                <p className="mt-1.5 text-sm text-ink-soft">
                  {[ev.date_iso, ev.location].filter(Boolean).join(" · ") || "No date set"}
                </p>
                <p className="mt-2 text-xs text-ink-faint">
                  {[
                    ev.guest_count ? `${ev.guest_count} guests` : null,
                    money(ev.budget) ? `${money(ev.budget)} budget` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
