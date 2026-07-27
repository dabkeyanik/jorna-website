"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { celebrationByKey } from "@/lib/celebrations";
import { generateBundles, selectBundle } from "@/lib/jorna";
import { CATEGORY_LABELS, categoryLabel, type BundleOption } from "@/lib/types";
import { Button, Card, Chip, Field, Rule } from "@/components/ui";
import { BundleResults } from "@/components/BundleResults";
import { CityCombobox, type Coords } from "@/components/CityCombobox";

const BUDGETS = [
  { value: "budget-friendly", label: "Budget-friendly", hint: "Smart value" },
  { value: "mid-range", label: "Balanced", hint: "Best mix" },
  { value: "premium", label: "Premium", hint: "Top tier" },
];

const STYLES = ["elegant", "traditional", "modern", "luxury", "fun", "minimal"];
const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

// Inline icons (stroke = currentColor) — nothing fetched over the network.
const svg = "size-[18px] shrink-0";
const IconPin = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={svg}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
const IconCalendar = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={svg}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);
const IconUsers = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={svg}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.2a3 3 0 0 1 0 5.6M20.5 19a5.5 5.5 0 0 0-3.2-5" />
  </svg>
);

function SkeletonBundles() {
  return (
    <section className="mt-12">
      <h2 className="serif text-center text-3xl text-ink">Assembling three vendor teams…</h2>
      <p className="mt-2 text-center text-sm text-ink-soft">
        Matching services to your date, budget, and vibe.
      </p>
      <div className="mt-6 grid gap-4 pt-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-5">
            <div className="mx-auto h-6 w-28 animate-pulse rounded bg-line-soft" />
            <div className="mx-auto mt-4 h-9 w-32 animate-pulse rounded bg-line-soft" />
            <div className="my-4 h-px bg-line-soft" />
            <div className="space-y-3">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="size-9 animate-pulse rounded-full bg-line-soft" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-line-soft" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-line-soft" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 h-11 w-full animate-pulse rounded-full bg-line-soft" />
          </Card>
        ))}
      </div>
    </section>
  );
}

function PlanInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  // Arriving from a "Trending celebrations" tile on Home (/plan?event=wedding).
  // Only the category selection is seeded from it — see lib/celebrations.
  const celebration = celebrationByKey(params.get("event"));

  // Gate: send guests to sign in, then back here — keeping ?event= so the
  // preselection survives the round trip through sign-in.
  useEffect(() => {
    if (!loading && !user) {
      const next = celebration ? `/plan?event=${celebration.key}` : "/plan";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router, celebration]);

  // Arriving from a celebration on the dashboard (/plan?date=&city=&guests=).
  // Seeded in the initializers, like `needed` below, so the form is filled on
  // the first paint. These only prefill: the generated bundle still creates its
  // own event, because neither /chatbot/bundles nor PATCH /bundles takes an
  // event_id to attach to an existing one.
  const [location, setLocation] = useState(params.get("city") ?? "");
  // Set when a suggested city is picked, so we can send coordinates for
  // distance-based matching; null when the location was free-typed.
  const [coords, setCoords] = useState<Coords | null>(null);
  const [eventDate, setEventDate] = useState(params.get("date") ?? "");
  const [guests, setGuests] = useState(params.get("guests") ?? "");
  const [budget, setBudget] = useState("mid-range");
  const [styles, setStyles] = useState<string[]>([]);
  // Seeded in the initializer rather than an effect, so an arriving celebration's
  // categories are ticked on the first paint instead of flicking on after it.
  const [needed, setNeeded] = useState<string[]>(celebration?.categories ?? []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<BundleOption[] | null>(null);
  const [choosingLabel, setChoosingLabel] = useState<string | null>(null);

  /**
   * Keep one of the three options. The backend persisted all three as drafts
   * sharing a bundle_group_id; selecting keeps this one and discards the rest,
   * then we go to the bundle to book and pay.
   */
  async function choose(option: BundleOption) {
    if (!option.bundle_id) return;
    setChoosingLabel(option.label);
    setError(null);
    try {
      await selectBundle(option.bundle_id);
      router.push(`/bundle?id=${option.bundle_id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't select that bundle. Try again.",
      );
      setChoosingLabel(null);
    }
  }

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function generate() {
    if (needed.length === 0) {
      setError("Pick at least one category to include.");
      return;
    }
    setBusy(true);
    setError(null);
    setOptions(null);
    try {
      const res = await generateBundles({
        needed_categories: needed,
        booked_categories: [],
        location: location.trim() || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        event_date: eventDate || null,
        guest_count: guests ? Number(guests) : null,
        budget_tier: budget,
        style: styles,
      });
      setOptions(res.options);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't build your bundles. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <div className="py-20 text-center text-ink-soft">Loading…</div>;
  }

  const allSelected = needed.length === ALL_CATEGORIES.length;

  return (
    <div className="mx-auto w-[min(1080px,100%-2rem)] py-10">
      <header className="text-center">
        <span className="eyebrow">AI bundle builder</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
          {celebration ? `Build your ${celebration.label.toLowerCase()}` : "Build your celebration"}
        </h1>
        <p className="mx-auto mt-3 max-w-[52ch] text-ink-soft">
          Tell us about your event and we&apos;ll assemble three complete vendor teams —
          Budget, Balanced, and Top Rated — to compare and book.
        </p>
        <div className="mt-7">
          <Rule />
        </div>
      </header>

      <Card className="mx-auto mt-8 max-w-3xl p-6 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-3">
          <CityCombobox
            label="City & state"
            placeholder="Start typing a city…"
            icon={IconPin}
            value={location}
            onChange={(v, c) => {
              setLocation(v);
              setCoords(c);
            }}
          />
          <Field
            label="Event date"
            type="date"
            icon={IconCalendar}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
          <Field
            label="Guests"
            type="number"
            min={1}
            placeholder="200"
            icon={IconUsers}
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          />
        </div>

        <div className="mt-7">
          <p className="mb-2.5 text-sm font-medium text-ink-soft">Budget</p>
          <div className="grid grid-cols-3 gap-2.5">
            {BUDGETS.map((b) => {
              const active = budget === b.value;
              return (
                <button
                  key={b.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBudget(b.value)}
                  className={`rounded-xl border px-3 py-3 text-center transition ${
                    active
                      ? "border-gold bg-gold/12 ring-1 ring-gold/40"
                      : "border-card-edge bg-ground-2 hover:border-gold/50"
                  }`}
                >
                  <span
                    className={`block text-sm font-semibold ${active ? "text-maroon dark:text-gold" : "text-ink"}`}
                  >
                    {b.label}
                  </span>
                  <span className="mt-0.5 block text-[0.7rem] text-ink-faint">{b.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-7">
          <p className="mb-2.5 text-sm font-medium text-ink-soft">
            Vibe <span className="text-ink-faint">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <Chip key={s} active={styles.includes(s)} onClick={() => toggle(styles, setStyles, s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-sm font-medium text-ink-soft">
              What you need{" "}
              <span className="text-ink-faint">
                · {needed.length}/{ALL_CATEGORIES.length}
              </span>
              {celebration ? (
                <span className="ml-1 text-ink-faint">
                  · preselected for a {celebration.label.toLowerCase()}, change anything
                </span>
              ) : null}
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-gold hover:underline"
              onClick={() => setNeeded(allSelected ? [] : ALL_CATEGORIES)}
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((c) => (
              <Chip key={c} active={needed.includes(c)} onClick={() => toggle(needed, setNeeded, c)}>
                {categoryLabel(c)}
              </Chip>
            ))}
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
            {error}
          </p>
        ) : null}

        <Button size="lg" className="mt-7 w-full" disabled={busy} onClick={generate}>
          <span aria-hidden="true">✦</span>
          {busy ? "Building your bundles…" : "Build my bundles"}
        </Button>
      </Card>

      {busy ? (
        <SkeletonBundles />
      ) : options ? (
        <section className="mt-12">
          <h2 className="serif text-center text-3xl text-ink">Your three teams</h2>
          <p className="mt-2 text-center text-sm text-ink-soft">
            Compare, tweak, and choose — you can edit any bundle after picking it.
          </p>
          {options.every((o) => o.bundle.items.length === 0) ? (
            <p className="mt-8 text-center text-ink-soft">
              We couldn&apos;t find available vendors for those categories and date yet. Try a
              different date or fewer categories.
            </p>
          ) : (
            <BundleResults options={options} onChoose={choose} choosingLabel={choosingLabel} />
          )}
        </section>
      ) : null}
    </div>
  );
}

// useSearchParams needs a Suspense boundary to prerender in the static export.
export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanInner />
    </Suspense>
  );
}
