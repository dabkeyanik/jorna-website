"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { searchVendors } from "@/lib/jorna";
import { CATEGORY_LABELS, categoryLabel, type VendorSearchItem } from "@/lib/types";
import { Button, Chip, Field } from "@/components/ui";
import { VendorCard } from "@/components/VendorCard";

const PAGE_SIZE = 12;
const CATEGORIES = Object.keys(CATEGORY_LABELS);

const SORTS = [
  { value: "rating", label: "Top rated" },
  { value: "price", label: "Price" },
];

const RATINGS = [
  { value: 0, label: "Any rating" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

export default function BrowsePage() {
  const [category, setCategory] = useState<string>("");
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("rating");

  const [items, setItems] = useState<VendorSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextOffset: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await searchVendors({
          category: category || undefined,
          min_rating: minRating || undefined,
          max_price: maxPrice ? Number(maxPrice) : undefined,
          sort_by: sortBy,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        setTotal(res.total);
        setOffset(nextOffset);
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Couldn't load vendors. Try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [category, minRating, maxPrice, sortBy],
  );

  // Re-run the search whenever a filter changes (debounced for the price field).
  useEffect(() => {
    const t = setTimeout(() => load(0, true), 250);
    return () => clearTimeout(t);
  }, [load]);

  const hasMore = items.length < total;

  return (
    <div className="mx-auto w-[min(1080px,100%-2rem)] py-10">
      <header className="text-center">
        <span className="eyebrow">Browse</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
          Find your vendors
        </h1>
        <p className="mx-auto mt-3 max-w-[52ch] text-ink-soft">
          Every venue, caterer, DJ, dhol player, mehndi artist and more on Jorna —
          filter by what you need.
        </p>
      </header>

      {/* Filters */}
      <div className="mt-8 rounded-2xl border border-card-edge bg-panel p-4">
        <div className="flex flex-wrap gap-2">
          <Chip active={category === ""} onClick={() => setCategory("")}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {categoryLabel(c)}
            </Chip>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Rating</span>
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
            >
              {RATINGS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Max price"
            type="number"
            min={0}
            placeholder="Any"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Results */}
      {error ? (
        <p className="mt-8 rounded-lg bg-maroon/10 px-3 py-2 text-center text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {!error && !loading && items.length === 0 ? (
        <p className="mt-12 text-center text-ink-soft">
          No vendors match those filters yet — try widening them.
        </p>
      ) : null}

      {items.length > 0 ? (
        <>
          <p className="mt-6 text-sm text-ink-faint">
            {total} {total === 1 ? "listing" : "listings"}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <VendorCard
                key={`${item.vendor_id}-${item.service_name ?? ""}`}
                item={item}
              />
            ))}
          </div>
        </>
      ) : null}

      {loading ? (
        <p className="mt-8 text-center text-ink-soft">Loading…</p>
      ) : hasMore ? (
        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => load(offset + PAGE_SIZE, false)}>
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
