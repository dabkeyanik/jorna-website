"use client";

// "How it works" — split out of home/page.tsx's #how anchor section into its
// own page (2026-09), so SiteHeader's nav links somewhere real instead of a
// scroll position. Carries the 3-step explanation plus the two sections that
// make the process concrete: the illustrative bundle example (what step 2
// actually produces) and the celebration picker (how you'd actually start).
// See docs/DECISIONS.md for the Home-trim reasoning.

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { CELEBRATIONS } from "@jorna/shared/lib/celebrations";
import { LinkButton } from "@jorna/shared/components/ui";
import { Eyebrow } from "@/components/marketing/Eyebrow";
import { CELEBRATION_ICONS, IconCalendar, IconCelebration, IconShield, IconUsers } from "@jorna/shared/components/marketing/icons";
import { clientAppUrl } from "@/lib/clientApp";

const STEPS = [
  {
    n: "01",
    icon: IconCalendar,
    title: "Describe your celebration",
    body: "Your city, date, guest count, budget, and the vibe you want — elegant, traditional, modern, or a mix. It takes about two minutes.",
  },
  {
    n: "02",
    icon: IconUsers,
    title: "Compare three complete teams",
    body: "Jorna builds a Budget, Balanced, and Top Rated team for your event — venue, catering, photography, and every other category you need, side by side.",
  },
  {
    n: "03",
    icon: IconShield,
    title: "Book with terms in writing",
    body: "Pick a team, adjust it, then sign each vendor's contract. You pay them directly by Venmo or Zelle, and every payment is recorded on your booking.",
  },
];

interface ExampleBundle {
  tier: string;
  label: string;
  total: string;
  highlight?: boolean;
  rows: { category: string; name: string; price: string; unit: string }[];
}

// Illustrative, and says so — see the caption under the cards. The three
// tiers are what the builder really produces; the vendors in them aren't
// real listings.
const EXAMPLE_BUNDLES: ExampleBundle[] = [
  {
    tier: "Bundle 01",
    label: "Budget-Friendly",
    total: "$14,200",
    rows: [
      { category: "Venue", name: "A neighbourhood banquet hall", price: "$4,500", unit: "per event" },
      { category: "Catering", name: "Everyday South Asian menu", price: "$38", unit: "per person" },
      { category: "Photography", name: "Solo photographer, 6 hours", price: "$2,200", unit: "per event" },
      { category: "DJ", name: "DJ with basic sound", price: "$900", unit: "per event" },
      { category: "Mehndi", name: "Bridal mehndi artist", price: "$350", unit: "per event" },
    ],
  },
  {
    tier: "Bundle 02",
    label: "Balanced",
    total: "$26,800",
    highlight: true,
    rows: [
      { category: "Venue", name: "Mid-size hall with décor included", price: "$8,500", unit: "per event" },
      { category: "Catering", name: "Extended menu with live stations", price: "$62", unit: "per person" },
      { category: "Photography", name: "Photo and video, full day", price: "$3,800", unit: "per event" },
      { category: "DJ", name: "DJ, MC, and lighting", price: "$1,600", unit: "per event" },
      { category: "Mehndi", name: "Bridal plus guest mehndi", price: "$700", unit: "per event" },
    ],
  },
  {
    tier: "Bundle 03",
    label: "Top Rated",
    total: "$48,500",
    rows: [
      { category: "Venue", name: "Premium venue, highest rated", price: "$18,000", unit: "per event" },
      { category: "Catering", name: "Chef-led menu, tasting included", price: "$95", unit: "per person" },
      { category: "Photography", name: "Cinematic film and photography", price: "$7,200", unit: "per event" },
      { category: "DJ", name: "Full production and staging", price: "$3,200", unit: "per event" },
      { category: "Mehndi", name: "Award-winning bridal artist", price: "$1,400", unit: "per event" },
    ],
  },
];

export default function HowItWorksPage() {
  const { user, loading } = useAuth();
  const primary = user
    ? { href: clientAppUrl("/plan"), label: "Build a bundle" }
    : { href: "/login?mode=register", label: "Get started — it's free" };

  return (
    <div>
      <section className="border-b border-line-soft bg-gradient-to-b from-ground to-panel px-5 pb-16 pt-16 md:pb-24 md:pt-24">
        <div className="mx-auto w-[min(var(--container-wide),100%)]">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="serif max-w-2xl text-4xl text-maroon dark:text-gold md:text-6xl">
            Plan your entire celebration in three steps.
          </h1>
        </div>
      </section>

      <section className="px-5 py-20 md:py-28">
        <div className="mx-auto w-[min(var(--container-wide),100%)]">
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-card-edge bg-card p-7 shadow-[var(--shadow-card)]"
              >
                <div className="mb-6 flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-panel text-maroon dark:text-gold">
                    {step.icon}
                  </span>
                  <span className="serif text-4xl leading-none text-line">{step.n}</span>
                </div>
                <h3 className="serif text-xl text-ink">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ground-2 px-5 py-20 md:py-28">
        <div className="mx-auto w-[min(var(--container-wide),100%)]">
          <Eyebrow>What step two produces</Eyebrow>
          <h2 className="serif text-3xl text-maroon dark:text-gold md:text-4xl">
            Three complete vendor teams. Compare, choose, book.
          </h2>
          <p className="mt-4 max-w-[58ch] leading-relaxed text-ink-soft md:text-lg">
            Every bundle covers the same categories, so the comparison is fair. Each
            price carries its unit, so you always know what you&apos;re looking at.
          </p>

          <div className="mt-12 grid items-start gap-5 md:grid-cols-3 md:gap-6">
            {EXAMPLE_BUNDLES.map((bundle) => (
              <div
                key={bundle.tier}
                className={`flex flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5 ${
                  bundle.highlight
                    ? "bg-maroon text-ground shadow-[0_24px_48px_-16px_rgba(74,11,26,0.45)]"
                    : "border border-card-edge bg-card shadow-[var(--shadow-card)]"
                }`}
              >
                {bundle.highlight ? (
                  <p className="bg-gold py-2 text-center text-xs font-semibold uppercase tracking-[0.24em] text-ground">
                    Most popular
                  </p>
                ) : null}
                <div className="flex flex-1 flex-col p-6">
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                      bundle.highlight ? "text-ground/60" : "text-ink-faint"
                    }`}
                  >
                    {bundle.tier}
                  </p>
                  <h3 className={`serif mt-1 text-2xl ${bundle.highlight ? "text-ground" : "text-ink"}`}>
                    {bundle.label}
                  </h3>

                  <div className="mt-5 space-y-3">
                    {bundle.rows.map((row) => (
                      <div
                        key={row.category}
                        className={`flex items-start justify-between gap-3 border-b pb-3 ${
                          bundle.highlight ? "border-ground/15" : "border-line-soft"
                        }`}
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-xs uppercase tracking-[0.14em] ${
                              bundle.highlight ? "text-ground/60" : "text-ink-faint"
                            }`}
                          >
                            {row.category}
                          </p>
                          <p
                            className={`mt-0.5 text-sm font-medium ${
                              bundle.highlight ? "text-ground" : "text-ink"
                            }`}
                          >
                            {row.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-sm font-semibold tabular-nums ${
                              bundle.highlight ? "text-ground/90" : "text-maroon dark:text-gold"
                            }`}
                          >
                            {row.price}
                          </p>
                          <p className={`text-xs ${bundle.highlight ? "text-ground/50" : "text-ink-faint"}`}>
                            {row.unit}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-6">
                    <div className="flex items-baseline justify-between">
                      <span className={`text-sm ${bundle.highlight ? "text-ground/65" : "text-ink-faint"}`}>
                        Estimated total
                      </span>
                      <span
                        className={`text-2xl font-semibold tabular-nums ${
                          bundle.highlight ? "text-ground" : "text-ink"
                        }`}
                      >
                        {bundle.total}
                      </span>
                    </div>
                    <Link
                      href={clientAppUrl("/plan")}
                      className={`mt-5 flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold transition ${
                        bundle.highlight
                          ? "bg-ground text-maroon hover:brightness-95"
                          : "bg-maroon text-ground hover:brightness-110"
                      }`}
                    >
                      Build a team like this
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-[64ch] text-center text-sm text-ink-faint">
            An illustration of what the builder produces — the three tiers are real, the
            vendors and prices above are examples. Your bundle is built from live
            listings in your city, and totals depend on guest count and any rates you
            negotiate.
          </p>
        </div>
      </section>

      <section className="px-5 py-14">
        <div className="mx-auto w-[min(var(--container-wide),100%)]">
          <p className="eyebrow mb-6 text-ink-faint">Plan by celebration</p>
          <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
            {CELEBRATIONS.map((c) => (
              <Link
                key={c.key}
                href={`/plan?event=${c.key}`}
                className="flex flex-col items-center gap-2 rounded-xl border border-line-soft bg-card p-3 text-gold transition hover:border-gold/60 hover:bg-ground-2"
              >
                {CELEBRATION_ICONS[c.key] ?? IconCelebration}
                <span className="text-center text-xs font-medium text-ink-soft">{c.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-panel px-5 py-20">
        <div className="mx-auto w-[min(var(--container-wide),100%)]">
          <div className="rounded-2xl border border-card-edge bg-card px-8 py-14 text-center">
            <h2 className="serif text-3xl text-maroon dark:text-gold md:text-4xl">
              Ready to see your own three teams?
            </h2>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {loading ? null : (
                <>
                  <LinkButton href={primary.href} size="lg">
                    {primary.label}
                  </LinkButton>
                  <LinkButton href="/browse" variant="ghost" size="lg">
                    Browse vendors
                  </LinkButton>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
