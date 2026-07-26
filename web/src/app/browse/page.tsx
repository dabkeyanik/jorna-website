"use client";

// Home, mirroring the iOS home screen: a search bar on top that expands into the
// full vendor search, with the same eight category tiles underneath.
//
// The tiles carry iOS's canonical (category, subcategory) pairs verbatim — see
// CategoryView.Category.canonical — because several tiles are subcategories
// rather than categories ("DJ" is music_entertainment/dj), and a DJ tile must
// never list dhol players.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { CELEBRATIONS } from "@/lib/celebrations";
import { searchVendors } from "@/lib/jorna";
import { categoryLabel, type VendorSearchItem } from "@/lib/types";
import { Button, Chip, Field, Rule } from "@/components/ui";
import { VendorCard, VendorCardSkeleton } from "@/components/VendorCard";

const PAGE_SIZE = 12;
// /vendors/search has no text-query parameter, so a typed query is filtered
// client-side — exactly as the iOS home does over its loaded vendors. Pull the
// largest page the API allows (cap: 100) while a query is active, or "dhol"
// would only ever search the twelve rows already on screen.
const QUERY_POOL = 100;

const icon = (d: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-7"
    aria-hidden="true"
  >
    {d}
  </svg>
);

interface Tile {
  label: string;
  category: string;
  subcategory?: string;
  art: React.ReactNode;
}

const TILES: Tile[] = [
  { label: "Venue", category: "venue", art: icon(<path d="M3 21h18M5 21V8l7-4 7 4v13M10 21v-6h4v6" />) },
  { label: "Catering", category: "catering", art: icon(<path d="M4 17h16a8 8 0 0 0-16 0ZM12 5.5V8M3 20.5h18" />) },
  {
    label: "Decor",
    category: "floral_decor",
    art: icon(<path d="M12 3l1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8L12 3ZM18 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />),
  },
  {
    label: "Photographer",
    category: "photography",
    art: icon(<path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />),
  },
  {
    label: "DJ",
    category: "music_entertainment",
    subcategory: "dj",
    art: icon(<path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17.5 6.5 14 10" />),
  },
  {
    label: "Mehndi",
    category: "beauty",
    subcategory: "mehndi_artist",
    art: icon(<path d="M8 21v-4.5L6.2 14a1.4 1.4 0 0 1 2.2-1.7L10 14V4.5a1.4 1.4 0 0 1 2.8 0V11M12.8 11V6.2a1.4 1.4 0 0 1 2.8 0V12M15.6 12v-1.3a1.4 1.4 0 0 1 2.8 0V16a5 5 0 0 1-5 5H8" />),
  },
  {
    label: "Dhol",
    category: "music_entertainment",
    subcategory: "dhol",
    art: icon(<path d="M4 8c0-1.7 3.6-3 8-3s8 1.3 8 3v8c0 1.7-3.6 3-8 3s-8-1.3-8-3V8Zm0 0c0 1.7 3.6 3 8 3s8-1.3 8-3M7 12.5l10 3M17 12.5l-10 3" />),
  },
  {
    label: "Other",
    category: "other",
    art: icon(<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM7.5 12h.01M12 12h.01M16.5 12h.01" />),
  },
];

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

export default function BrowsePage() {
  // Collapsed = the landing view (search bar + tiles). Expanded = the full
  // search. Focusing the field or picking a tile opens it; the field itself
  // stays mounted across both so focus is never stolen mid-keystroke.
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState<string | undefined>(undefined);
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

  // Nothing is fetched until the search is opened — the landing view is tiles.
  useEffect(() => {
    if (!expanded) return;
    const t = setTimeout(() => load(0, true), 250);
    return () => clearTimeout(t);
  }, [expanded, load]);

  function openTile(tile: Tile) {
    setCategory(tile.category);
    setSubcategory(tile.subcategory);
    setExpanded(true);
  }

  function pickCategory(tile: Tile | null) {
    setCategory(tile?.category ?? "");
    setSubcategory(tile?.subcategory);
  }

  function collapse() {
    setQuery("");
    setCategory("");
    setSubcategory(undefined);
    setShowFilters(false);
    setExpanded(false);
    // Drop the results too, so reopening on a different category can't flash
    // the previous one's listings while the new fetch is in flight.
    setItems([]);
    setTotal(0);
  }

  const visible = searching ? items.filter((i) => matches(i, query.trim().toLowerCase())) : items;
  // Paging is meaningless while the query filters a locally held pool.
  const hasMore = !searching && items.length < total;
  const activeTile = TILES.find(
    (t) => t.category === category && t.subcategory === subcategory,
  );

  return (
    <div className="mx-auto w-[min(1080px,100%-2rem)] py-10">
      {!expanded ? (
        <header className="relative text-center">
          {/* The walkthrough of how Jorna works — bundles, escrow, check-in —
              used to be the site's front page. The root goes straight into the
              app now, so this is how anyone still finds it. A plain anchor: it
              lives outside the app, and next/link would prefix "/app". */}
          <a
            href="/welcome/"
            aria-label="How Jorna works"
            title="How Jorna works"
            className="absolute right-0 top-0 grid size-9 place-items-center rounded-full border border-card-edge bg-ground-2 text-base font-bold text-ink-soft transition hover:border-gold/60 hover:text-gold"
          >
            ?
          </a>
          <span className="eyebrow">Browse</span>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
            Find your vendors
          </h1>
          <p className="mx-auto mt-3 max-w-[52ch] text-ink-soft">
            Every venue, caterer, DJ, dhol player and mehndi artist on Jorna — search,
            or start from a category.
          </p>
        </header>
      ) : null}

      {/* The search row — mounted in both states. */}
      <div className={`flex gap-2 ${expanded ? "" : "mt-8"}`}>
        <label className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gold">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onFocus={() => setExpanded(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setExpanded(true);
            }}
            placeholder="Search DJs, Mehndi, Venues…"
            aria-label="Search vendors"
            className="w-full rounded-xl border border-card-edge bg-ground-2 py-3 pl-11 pr-3.5 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </label>
        {expanded ? (
          <>
            <Button
              variant={showFilters ? "primary" : "ghost"}
              onClick={() => setShowFilters((v) => !v)}
            >
              Filters
            </Button>
            <Button variant="quiet" onClick={collapse}>
              Cancel
            </Button>
          </>
        ) : null}
      </div>

      {!expanded ? (
        <>
          <div className="mt-10">
            <Rule />
          </div>

          <h2 className="serif mt-8 text-2xl text-maroon dark:text-gold">
            Explore categories
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TILES.map((tile) => (
              <button
                key={tile.label}
                type="button"
                onClick={() => openTile(tile)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-card-edge bg-ground-2 px-3 py-6 text-center transition hover:border-gold/60 hover:bg-gold/[0.06]"
              >
                <span className="text-gold">{tile.art}</span>
                <span className="text-sm font-semibold text-ink">{tile.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button variant="ghost" onClick={() => setExpanded(true)}>
              Browse every vendor
            </Button>
          </div>

          {/* Trending celebrations — the other iOS home section. These skip the
              category question: each one opens the builder with the categories
              that celebration usually needs already ticked, leaving the date,
              city, and guest count to fill in. */}
          <h2 className="serif mt-12 text-2xl text-maroon dark:text-gold">
            Trending celebrations
          </h2>
          <p className="mt-2 text-ink-soft">
            Start from an occasion and we&apos;ll preselect what it usually takes — then
            add your date, city, and guest count.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {CELEBRATIONS.map((c) => (
              <Link
                key={c.key}
                href={`/plan?event=${c.key}`}
                className="rounded-2xl border border-card-edge bg-ground-2 px-7 py-4 font-semibold text-ink transition hover:border-gold/60 hover:bg-gold/[0.06]"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Category row, so the category can change without going back. */}
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
                <span className="mb-2 block text-sm font-medium text-ink-soft">
                  Minimum rating
                </span>
                <div className="flex flex-wrap gap-2">
                  {RATINGS.map((r) => (
                    <Chip
                      key={r.value}
                      active={minRating === r.value}
                      onClick={() => setMinRating(r.value)}
                    >
                      {r.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-ink-soft">Sort by</span>
                <div className="flex flex-wrap gap-2">
                  {SORTS.map((s) => (
                    <Chip
                      key={s.value}
                      active={sortBy === s.value}
                      onClick={() => setSortBy(s.value)}
                    >
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
        </>
      )}
    </div>
  );
}
