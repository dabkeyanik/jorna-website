"use client";

// Marketplace — every vendor on Jorna: search, category chips, filters,
// pagination. This used to be an in-place "expanded" state of the Home tab's
// search bar; it's its own tab now, so Home's search bar, tiles, and "Browse
// every vendor" button link straight here instead of expanding in place.
//
// A category (and, for a few tiles, subcategory) can arrive via ?category=
// &subcategory= — that's how Home's tiles hand off into a preset filter.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { searchVendors } from "@/lib/jorna";
import { categoryLabel, type VendorSearchItem } from "@/lib/types";
import { TILES } from "@/lib/categoryTiles";
import { Button, Chip, Field } from "@/components/ui";
import { VendorCard, VendorCardSkeleton } from "@/components/VendorCard";

const PAGE_SIZE = 12;
// /vendors/search has no text-query parameter, so a typed query is filtered
// client-side — exactly as the iOS home does over its loaded vendors. Pull the
// largest page the API allows (cap: 100) while a query is active, or "dhol"
// would only ever search the twelve rows already on screen.
const QUERY_POOL = 100;

const SORTS = [
  { value: "rating", label: "Top rated" },
  { value: "price", label: "Price" },
];

const RATINGS = [
  { value: 0, label: "Any rating" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

/** Fields the typed query is matched against. iOS also matches a vendor's bio
 *  and subcategory; a search row carries neither, so those are simply absent. */
function matches(item: VendorSearchItem, q: string) {
  return [
    `${item.first_name} ${item.last_name}`,
    item.category,
    categoryLabel(item.category),
    item.service_name ?? "",
    item.location ?? "",
    ...(item.tags ?? []),
  ].some((field) => field.toLowerCase().includes(q));
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="size-5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function MarketplaceInner() {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [subcategory, setSubcategory] = useState<string | undefined>(
    searchParams.get("subcategory") ?? undefined,
  );
  const [showFilters, setShowFilters] = useState(false);

  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("rating");

  const [items, setItems] = useState<VendorSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searching = query.trim().length > 0;
  const pageSize = searching ? QUERY_POOL : PAGE_SIZE;

  const load = useCallback(
    async (nextOffset: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await searchVendors({
          category: category || undefined,
          subcategory,
          min_rating: minRating || undefined,
          max_price: maxPrice ? Number(maxPrice) : undefined,
          sort_by: sortBy,
          limit: pageSize,
          offset: nextOffset,
        });
        setTotal(res.total);
        setOffset(nextOffset);
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load vendors. Try again.");
      } finally {
        setLoading(false);
      }
    },
    [category, subcategory, minRating, maxPrice, sortBy, pageSize],
  );

  // Debounced so dragging through filters fires one fetch, not one per keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(0, true), 250);
    return () => clearTimeout(t);
  }, [load]);

  function pickCategory(tile: (typeof TILES)[number] | null) {
    setCategory(tile?.category ?? "");
    setSubcategory(tile?.subcategory);
  }

  const visible = searching ? items.filter((i) => matches(i, query.trim().toLowerCase())) : items;
  // Paging is meaningless while the query filters a locally held pool.
  const hasMore = !searching && items.length < total;
  const activeTile = TILES.find(
    (t) => t.category === category && t.subcategory === subcategory,
  );

  return (
    <div className="mx-auto w-[min(1080px,100%-2rem)] py-10">
      <header className="text-center">
        <span className="eyebrow">Marketplace</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
          Every vendor on Jorna
        </h1>
        <p className="mx-auto mt-3 max-w-[52ch] text-ink-soft">
          Search by name or service, or filter by category, rating, and price.
        </p>
      </header>

      <div className="mt-8 flex gap-2">
        <label className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gold">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search DJs, Mehndi, Venues…"
            aria-label="Search vendors"
            autoFocus
            className="w-full rounded-xl border border-card-edge bg-ground-2 py-3 pl-11 pr-3.5 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </label>
        <Button variant={showFilters ? "primary" : "ghost"} onClick={() => setShowFilters((v) => !v)}>
          Filters
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip active={!activeTile} onClick={() => pickCategory(null)}>
          All
        </Chip>
        {TILES.map((tile) => (
          <Chip
            key={tile.label}
            active={activeTile?.label === tile.label}
            onClick={() => pickCategory(tile)}
          >
            {tile.label}
          </Chip>
        ))}
      </div>

      {showFilters ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-card-edge bg-panel p-4 sm:grid-cols-3 sm:p-5">
          <div>
            <span className="mb-2 block text-sm font-medium text-ink-soft">Minimum rating</span>
            <div className="flex flex-wrap gap-2">
              {RATINGS.map((r) => (
                <Chip key={r.value} active={minRating === r.value} onClick={() => setMinRating(r.value)}>
                  {r.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-ink-soft">Sort by</span>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <Chip key={s.value} active={sortBy === s.value} onClick={() => setSortBy(s.value)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          <Field
            label="Max price"
            type="number"
            min={0}
            placeholder="Any"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-8 rounded-lg bg-maroon/10 px-3 py-2 text-center text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 && !error ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <VendorCardSkeleton key={i} />
          ))}
        </div>
      ) : null}

      {!error && !loading && visible.length === 0 ? (
        <p className="mt-12 text-center text-ink-soft">
          {searching
            ? `Nothing matches “${query.trim()}” here — try a category, or fewer filters.`
            : "No vendors match those filters yet — try widening them."}
        </p>
      ) : null}

      {visible.length > 0 ? (
        <>
          <p className="mt-6 text-sm text-ink-faint">
            {searching
              ? `${visible.length} ${visible.length === 1 ? "match" : "matches"}`
              : `${total} ${total === 1 ? "listing" : "listings"}`}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <VendorCard key={`${item.vendor_id}-${item.service_name ?? ""}`} item={item} />
            ))}
          </div>
        </>
      ) : null}

      {visible.length > 0 && loading ? (
        <p className="mt-8 text-center text-ink-soft">Loading…</p>
      ) : hasMore && items.length > 0 ? (
        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => load(offset + PAGE_SIZE, false)}>
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <MarketplaceInner />
    </Suspense>
  );
}
