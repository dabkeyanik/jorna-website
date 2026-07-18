"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { generateBundles, selectBundle } from "@/lib/jorna";
import { CATEGORY_LABELS, categoryLabel, type BundleOption } from "@/lib/types";
import { Button, Card, Chip, Field } from "@/components/ui";
import { BundleResults } from "@/components/BundleResults";

const BUDGETS = [
  { value: "budget-friendly", label: "Budget-friendly" },
  { value: "mid-range", label: "Balanced" },
  { value: "premium", label: "Premium" },
];

const STYLES = ["elegant", "traditional", "modern", "luxury", "fun", "minimal"];
const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

export default function PlanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Gate: send guests to sign in, then back here.
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/plan");
  }, [loading, user, router]);

  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guests, setGuests] = useState("");
  const [budget, setBudget] = useState("mid-range");
  const [styles, setStyles] = useState<string[]>([]);
  const [needed, setNeeded] = useState<string[]>(ALL_CATEGORIES);

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

  return (
    <div className="mx-auto w-[min(1080px,100%-2rem)] py-10">
      <header className="text-center">
        <span className="eyebrow">AI bundle builder</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
          Build your celebration
        </h1>
        <p className="mx-auto mt-3 max-w-[52ch] text-ink-soft">
          Tell us about your event and we&apos;ll assemble three complete vendor teams —
          Budget, Balanced, and Top Rated — you can compare and book.
        </p>
      </header>

      <Card className="mx-auto mt-8 max-w-3xl p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="City & state"
            placeholder="Jersey City, NJ"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Field
            label="Event date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
          <Field
            label="Guests"
            type="number"
            min={1}
            placeholder="200"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          />
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-ink-soft">Budget</p>
          <div className="flex flex-wrap gap-2">
            {BUDGETS.map((b) => (
              <Chip key={b.value} active={budget === b.value} onClick={() => setBudget(b.value)}>
                {b.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-ink-soft">Vibe (optional)</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <Chip key={s} active={styles.includes(s)} onClick={() => toggle(styles, setStyles, s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-ink-soft">What you need</p>
            <button
              type="button"
              className="text-xs font-semibold text-gold hover:underline"
              onClick={() =>
                setNeeded(needed.length === ALL_CATEGORIES.length ? [] : ALL_CATEGORIES)
              }
            >
              {needed.length === ALL_CATEGORIES.length ? "Clear all" : "Select all"}
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

        <Button size="lg" className="mt-6 w-full" disabled={busy} onClick={generate}>
          {busy ? "Building your bundles…" : "Build my bundles"}
        </Button>
      </Card>

      {options ? (
        <section className="mt-12">
          <h2 className="serif mb-5 text-center text-3xl text-ink">Your three teams</h2>
          {options.every((o) => o.bundle.items.length === 0) ? (
            <p className="text-center text-ink-soft">
              We couldn&apos;t find available vendors for those categories and date yet.
              Try a different date or fewer categories.
            </p>
          ) : (
            <BundleResults
              options={options}
              onChoose={choose}
              choosingLabel={choosingLabel}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
