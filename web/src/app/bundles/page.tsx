"use client";

// The planning dashboard — the client's Bundles tab.
//
// It used to be a grid of bundle cards showing a name, a status word, and a
// total, which told you nothing about whether the celebration was on track.
// This answers the question you actually open the tab with: what's booked, what
// still needs me, and what do I do next.
//
// A celebration, not a bundle, is the unit here. /events used to list events
// separately, which split one plan across two tabs — an event you'd created but
// not yet built a bundle for simply didn't appear next to the ones you had. So
// this reads both and joins them on event_id:
//
//   event + its bundles   → the normal case
//   event, no bundles     → shown with a Build a bundle button
//   bundle, no event      → shown on its own (bundles can exist event-less)
//
// The outstanding work comes from lib/planning, the same rules behind the
// "Needs you" badge, so the two can't tell you different things.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { createEvent, listBundles, listEvents } from "@/lib/jorna";
import {
  compareByDate,
  isDraftBundle,
  missingCategories,
  moneyForBundle,
  planForBundle,
  taskDetail,
  type MoneyBreakdown,
  type PlanTask,
} from "@/lib/planning";
import { categoryLabel, type BundleDetail, type EventItem } from "@/lib/types";
import { Button, Card, Field, LinkButton } from "@/components/ui";
import { CityCombobox } from "@/components/CityCombobox";

function money(n?: number | null) {
  return n == null ? null : `$${Math.round(n).toLocaleString()}`;
}

function prettyDate(iso?: string | null): string | null {
  if (!iso || iso === "TBD") return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Days until the event; negative once it's past. Null when there's no date. */
function daysAway(iso?: string | null): number | null {
  if (!iso || iso === "TBD") return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function countdown(iso?: string | null): string | null {
  const n = daysAway(iso);
  if (n == null) return null;
  if (n < 0) return "Past";
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 31) return `In ${n} days`;
  const months = Math.round(n / 30);
  return `In ${months} ${months === 1 ? "month" : "months"}`;
}

/** One celebration: an event, the bundles built for it, and what it still needs. */
interface Celebration {
  key: string;
  name: string;
  event: EventItem | null;
  bundles: BundleDetail[];
  dateIso: string | null;
  location: string | null;
  guestCount: number | null;
  tasks: PlanTask[];
  paid: number;
  live: number;
  spend: number;
  /** What the host set out to spend, when they told us. */
  budget: number | null;
  money: MoneyBreakdown;
  /** Categories they said they needed that nothing live covers. */
  missing: string[];
}

const ZERO_MONEY: MoneyBreakdown = {
  committed: 0,
  inEscrow: 0,
  released: 0,
  outstanding: 0,
  awaitingQuantity: 0,
  refunded: 0,
};

/**
 * Join events and bundles into celebrations.
 *
 * A bundle carries only a thin `event` summary, so an event the user created in
 * full (with a budget, say) is preferred as the source of the shared fields and
 * the bundle's copy is the fallback.
 */
function toCelebrations(events: EventItem[], bundles: BundleDetail[]): Celebration[] {
  const byKey = new Map<string, Celebration>();

  const blank = (key: string, name: string, event: EventItem | null): Celebration => ({
    key,
    name,
    event,
    bundles: [],
    dateIso: event?.date_iso ?? null,
    location: event?.location ?? null,
    guestCount: event?.guest_count ?? null,
    tasks: [],
    paid: 0,
    live: 0,
    spend: 0,
    budget: event?.budget ?? null,
    money: { ...ZERO_MONEY },
    missing: [],
  });

  for (const event of events) {
    byKey.set(event.event_id, blank(event.event_id, event.name, event));
  }

  for (const bundle of bundles) {
    const key = bundle.event_id ?? `bundle:${bundle.bundle_id}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = blank(key, bundle.event_name || bundle.name || "Untitled celebration", null);
      byKey.set(key, entry);
    }
    entry.bundles.push(bundle);

    // Fill anything the event didn't supply from the bundle's own summary.
    entry.dateIso ??= bundle.event?.date_iso ?? null;
    entry.location ??= bundle.event?.location ?? null;
    entry.guestCount ??= bundle.event?.guest_count ?? null;

    const plan = planForBundle(bundle);
    entry.tasks.push(...plan.tasks);
    entry.paid += plan.paidCount;
    entry.live += plan.liveCount;
    entry.spend += bundle.total_estimated_cost ?? 0;

    const cash = moneyForBundle(bundle);
    for (const k of Object.keys(entry.money) as (keyof MoneyBreakdown)[]) {
      entry.money[k] += cash[k];
    }
  }

  // An event's own gaps are derived per bundle, so two bundles on one event
  // would each report the same missing date. Keep one of each.
  for (const entry of byKey.values()) {
    const seen = new Set<string>();
    entry.tasks = entry.tasks.filter((t) => !seen.has(t.id) && seen.add(t.id));
    // Compared across all of a celebration's bundles: a photographer booked in
    // one of them isn't missing just because the other doesn't have one.
    entry.missing = missingCategories(entry.event?.services_needed, entry.bundles);
  }

  // Upcoming first, soonest at the top; then finished, most recent first; then
  // undated. See compareByDate — a plain ascending sort put last year's wedding
  // above the one three weeks away.
  return [...byKey.values()].sort(
    (a, b) => compareByDate(a.dateIso, b.dateIso) || a.name.localeCompare(b.name),
  );
}

/** Carry what's known about a celebration into the builder's form. */
function buildQuery(c: Celebration): string {
  const q = new URLSearchParams();
  if (c.dateIso && c.dateIso !== "TBD") q.set("date", c.dateIso);
  if (c.location) q.set("city", c.location);
  if (c.guestCount != null) q.set("guests", String(c.guestCount));
  const s = q.toString();
  return s ? `?${s}` : "";
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[0.64rem] uppercase tracking-[0.14em] text-ink-faint">{label}</p>
      <p className={value ? "text-ink" : "text-ink-faint"}>{value ?? "Not set"}</p>
    </div>
  );
}

function CelebrationCard({ celebration }: { celebration: Celebration }) {
  const { name, bundles, tasks, paid, live, spend, dateIso, budget } = celebration;
  const urgent = tasks.filter((t) => t.tone === "urgent").length;
  const when = countdown(dateIso);
  const total = money(spend);
  // Every bundle still a draft means nobody has been asked yet, which is a
  // truer headline than a task count.
  const allDraft = bundles.length > 0 && bundles.every(isDraftBundle);
  const overBudget = budget != null && celebration.money.committed > budget;
  // Scale against the budget when there is one, so the bar shows how much of it
  // is spoken for; against the committed total otherwise, and never past 100%.
  const barBase = Math.max(
    budget && !overBudget ? budget : celebration.money.committed,
    1,
  );

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="serif text-2xl text-ink">{name}</h2>
          {when ? (
            <p className="mt-1 text-sm text-ink-soft">
              {when}
              {prettyDate(dateIso) ? ` · ${prettyDate(dateIso)}` : ""}
            </p>
          ) : null}
        </div>
        {allDraft ? (
          <span className="shrink-0 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
            Draft
          </span>
        ) : tasks.length > 0 ? (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              urgent > 0
                ? "bg-maroon text-ground dark:bg-gold dark:text-ground"
                : "bg-gold/15 text-maroon dark:text-gold"
            }`}
          >
            {tasks.length} {tasks.length === 1 ? "thing needs you" : "things need you"}
          </span>
        ) : bundles.length > 0 ? (
          <span className="shrink-0 rounded-full bg-green/12 px-3 py-1 text-xs font-semibold text-green">
            On track
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <Fact label="Date" value={prettyDate(dateIso)} />
        <Fact label="Location" value={celebration.location} />
        <Fact
          label="Guests"
          value={celebration.guestCount != null ? String(celebration.guestCount) : null}
        />
        {/* Spend lives in the money row below, where it can be read against the
            budget; repeating it here as a bare "Estimated" said less. */}
        {live === 0 && total ? <Fact label="Estimated" value={total} /> : null}
      </div>

      {live > 0 ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs">
            <span className="text-ink-soft">
              {money(celebration.money.committed)} committed
              {celebration.budget ? (
                <span className={overBudget ? "text-maroon dark:text-gold" : "text-ink-faint"}>
                  {" "}
                  of {money(celebration.budget)} budget
                  {overBudget ? " — over" : ""}
                </span>
              ) : null}
            </span>
            <span className="text-ink-faint">
              {paid} of {live} {live === 1 ? "vendor" : "vendors"} paid
            </span>
          </div>

          {/* Released, then held, then what's still to pay. Against the budget
              when there is one, so the bar reads as "of what I meant to spend". */}
          <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-line-soft">
            {[
              { value: celebration.money.released, className: "bg-green" },
              { value: celebration.money.inEscrow, className: "bg-gold" },
              { value: celebration.money.outstanding, className: "bg-gold/35" },
            ].map((seg, i) =>
              seg.value > 0 ? (
                <div
                  key={i}
                  className={seg.className}
                  style={{ width: `${Math.min(100, (seg.value / barBase) * 100)}%` }}
                />
              ) : null,
            )}
          </div>

          {celebration.money.outstanding > 0 ? (
            <p className="mt-1.5 text-xs text-ink-faint">
              {money(celebration.money.outstanding)} still to pay
            </p>
          ) : null}
        </div>
      ) : null}

      {celebration.missing.length > 0 ? (
        <p className="mt-4 rounded-xl bg-gold/10 px-3 py-2.5 text-sm text-ink-soft">
          <span className="font-medium text-ink">Still to book:</span>{" "}
          {celebration.missing.map((c) => categoryLabel(c)).join(", ")} — you listed
          {celebration.missing.length === 1 ? " it" : " them"} when you set this up.
        </p>
      ) : null}

      {tasks.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {tasks.slice(0, 3).map((task) => (
            <li
              key={task.id}
              className="flex items-start gap-2.5 rounded-xl bg-panel px-3 py-2.5"
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                  task.tone === "urgent" ? "bg-maroon dark:bg-gold" : "bg-gold/60"
                }`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{task.title}</span>
                {taskDetail(task) ? (
                  <span className="block text-xs text-ink-soft">{taskDetail(task)}</span>
                ) : null}
              </span>
            </li>
          ))}
          {tasks.length > 3 ? (
            <li className="px-3 text-xs text-ink-faint">
              and {tasks.length - 3} more
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* One way in. This card used to offer "Open plan" and "Event details"
          side by side, which asked you to guess which held what — the plan now
          carries the event's details too, so there's one door. A celebration
          with several bundles opens the first; the plan links the rest. */}
      <div className="mt-5">
        {bundles.length === 0 ? (
          // Prefill only — the builder can't attach to an existing event, so
          // this carries the details across rather than pretending to link.
          <LinkButton href={`/plan${buildQuery(celebration)}`}>Build a bundle</LinkButton>
        ) : (
          <LinkButton href={`/bundle?id=${bundles[0].bundle_id}`}>
            {allDraft ? "Review draft" : "Open plan"}
          </LinkButton>
        )}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [celebrations, setCelebrations] = useState<Celebration[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [dateIso, setDateIso] = useState("");
  const [location, setLocation] = useState("");
  const [guests, setGuests] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/bundles");
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      // An events failure shouldn't empty the dashboard — bundles are the part
      // that always exists, so a missing event list just costs the join.
      const [bundles, events] = await Promise.all([
        listBundles(),
        listEvents().catch(() => [] as EventItem[]),
      ]);
      setCelebrations(toCelebrations(events, bundles));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your celebrations.");
      setCelebrations([]);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setError(err instanceof ApiError ? err.message : "Couldn't create that celebration.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  const totalTasks = (celebrations ?? []).reduce((n, c) => n + c.tasks.length, 0);

  return (
    <div className="mx-auto w-[min(880px,100%-2rem)] py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Your celebrations</span>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
            Dashboard
          </h1>
          {celebrations && celebrations.length > 0 ? (
            <p className="mt-2 text-ink-soft">
              {totalTasks === 0
                ? "Everything's up to date."
                : `${totalTasks} ${totalTasks === 1 ? "thing needs" : "things need"} you across ${
                    celebrations.length
                  } ${celebrations.length === 1 ? "celebration" : "celebrations"}.`}
            </p>
          ) : null}
        </div>
        {celebrations && celebrations.length > 0 && !creating ? (
          <Button variant="ghost" onClick={() => setCreating(true)}>
            New celebration
          </Button>
        ) : null}
      </header>

      {creating ? (
        <Card className="mt-7 p-6">
          <h2 className="serif text-xl text-ink">New celebration</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Or skip this — building a bundle sets one up for you.
          </p>
          <form onSubmit={submit} className="mt-4 grid gap-4">
            <Field
              label="Name"
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
              <CityCombobox
                label="Location"
                placeholder="Start typing a city…"
                required
                value={location}
                onChange={(v) => setLocation(v)}
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
                {busy ? "Creating…" : "Create celebration"}
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

      {celebrations === null ? (
        <p className="mt-10 text-center text-ink-soft">Loading…</p>
      ) : celebrations.length === 0 ? (
        // Nothing planned yet: one thing to do, and it's the builder.
        <Card className="mt-10 p-10 text-center">
          <h2 className="serif text-2xl text-ink">Start with a bundle</h2>
          <p className="mx-auto mt-3 max-w-[46ch] text-ink-soft">
            Tell Jorna about your celebration and it builds three complete vendor teams
            for you to compare — venue, catering, photography, and everything else it
            takes. Everything you book then lives here.
          </p>
          <LinkButton href="/plan" size="lg" className="mt-7">
            Build a bundle
          </LinkButton>
          <p className="mt-5 text-sm text-ink-faint">
            Rather set the date first?{" "}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="text-gold hover:underline"
            >
              Create a celebration
            </button>
            .
          </p>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4">
          {celebrations.map((c) => (
            <CelebrationCard key={c.key} celebration={c} />
          ))}
        </div>
      )}
    </div>
  );
}
