"use client";

// Home, mirroring the iOS home screen: a search bar and eight category tiles
// that hand off into the Marketplace tab (search bar → /marketplace, a tile →
// /marketplace?category=…&subcategory=…), plus trending celebrations that open
// the bundle builder directly.

import Link from "next/link";
import { CELEBRATIONS } from "@/lib/celebrations";
import { TILES, tileHref } from "@/lib/categoryTiles";
import { LinkButton, Rule } from "@/components/ui";

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
  return (
    <div className="mx-auto w-[min(1080px,100%-2rem)] py-10">
      <header className="relative text-center">
        {/* The walkthrough of how Jorna works — bundles, escrow, check-in —
            used to be the site's front page. The root goes straight into the
            app now, so this is how anyone still finds it. A plain anchor: it
            lives outside the app, and next/link would prefix "/app". */}
        <a
          href="/help/"
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

      {/* A search field in appearance only — tapping it hands off to the
          Marketplace tab, which owns the real search, filters, and results. */}
      <Link
        href="/marketplace"
        aria-label="Search vendors"
        className="relative mt-8 flex items-center rounded-xl border border-card-edge bg-ground-2 py-3 pl-11 pr-3.5 text-ink-faint transition hover:border-gold/60"
      >
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gold">
          <SearchIcon />
        </span>
        Search DJs, Mehndi, Venues…
      </Link>

      <div className="mt-10">
        <Rule />
      </div>

      <h2 className="serif mt-8 text-2xl text-maroon dark:text-gold">Explore categories</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TILES.map((tile) => (
          <Link
            key={tile.label}
            href={tileHref(tile)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-card-edge bg-ground-2 px-3 py-6 text-center transition hover:border-gold/60 hover:bg-gold/[0.06]"
          >
            <span className="text-gold">{tile.art}</span>
            <span className="text-sm font-semibold text-ink">{tile.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center">
        <LinkButton href="/marketplace" variant="ghost">
          Browse every vendor
        </LinkButton>
      </div>

      {/* Trending celebrations — the other iOS home section. These skip the
          category question: each one opens the builder with the categories
          that celebration usually needs already ticked, leaving the date,
          city, and guest count to fill in. */}
      <h2 className="serif mt-12 text-2xl text-maroon dark:text-gold">Trending celebrations</h2>
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
    </div>
  );
}
