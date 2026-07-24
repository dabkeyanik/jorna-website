"use client";

import { categoryLabel, type BundleOption } from "@/lib/types";
import { Avatar, Button, Card, Stars } from "./ui";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

/** The middle "Balanced" tier is the one we nudge people toward. */
function isRecommended(option: BundleOption) {
  return option.label.trim().toLowerCase() === "balanced";
}

function BundleCard({
  option,
  recommended,
  onChoose,
  choosing,
}: {
  option: BundleOption;
  recommended: boolean;
  onChoose?: (option: BundleOption) => void;
  choosing?: boolean;
}) {
  const { bundle } = option;
  const unfilled = bundle.unfilled_categories ?? [];
  const count = bundle.items.length;
  const rated = bundle.items.filter((i) => i.rating > 0);
  const avg = rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : 0;

  return (
    <Card
      className={`relative flex flex-col p-5 transition ${
        recommended
          ? "ring-2 ring-gold shadow-[0_20px_55px_-26px_rgba(169,121,31,0.55)]"
          : "hover:border-gold/40"
      }`}
    >
      {recommended ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-3 py-1 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-maroon-deep shadow-[var(--shadow-card)]">
          Recommended
        </span>
      ) : null}

      {/* Tier + pitch */}
      <div className="text-center">
        <h3 className="serif text-2xl text-maroon dark:text-gold">{option.label}</h3>
        <p className="mx-auto mt-1 max-w-[26ch] text-xs leading-relaxed text-ink-soft">
          {option.description}
        </p>
      </div>

      {/* Headline total */}
      <div className="mt-4 text-center">
        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">Estimated total</p>
        <p className="serif mt-0.5 text-[2rem] leading-none text-ink">
          {money(bundle.estimated_total_min)}
        </p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <span>
            {count} {count === 1 ? "vendor" : "vendors"}
          </span>
          {avg > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <Stars rating={avg} className="text-xs" />
              <span>avg</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="my-4 h-px bg-line-soft" />

      {/* Line-up */}
      <ul className="flex-1 space-y-3">
        {bundle.items.map((item) => (
          <li
            key={`${item.category}-${item.vendor_id ?? item.vendor_name}`}
            className="flex items-center gap-3"
          >
            <Avatar src={item.pfp_url} name={item.vendor_name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {item.service_name || categoryLabel(item.category)}
              </p>
              <p className="truncate text-xs text-ink-faint">
                {categoryLabel(item.category)} · {item.vendor_name}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-ink">{money(item.price_min)}</p>
              <Stars rating={item.rating} className="text-[0.7rem]" />
            </div>
          </li>
        ))}
      </ul>

      {unfilled.length > 0 ? (
        <p className="mt-4 rounded-lg bg-gold/10 px-3 py-2 text-xs leading-relaxed text-ink-soft">
          No available {unfilled.map(categoryLabel).join(", ")} for your date — you can add{" "}
          {unfilled.length === 1 ? "it" : "one"} later if a vendor opens up.
        </p>
      ) : null}

      {onChoose ? (
        <Button
          className="mt-5 w-full"
          variant={recommended ? "primary" : "ghost"}
          disabled={choosing || !option.bundle_id}
          onClick={() => onChoose(option)}
        >
          {choosing ? "Setting up…" : "Choose this bundle"}
        </Button>
      ) : null}
    </Card>
  );
}

export function BundleResults({
  options,
  onChoose,
  choosingLabel,
}: {
  options: BundleOption[];
  onChoose?: (option: BundleOption) => void;
  /** Label of the option currently being selected, so only its button spins. */
  choosingLabel?: string | null;
}) {
  return (
    // pt-4 leaves room for the "Recommended" ribbon to sit above its card.
    <div className="grid items-start gap-4 pt-4 md:grid-cols-3">
      {options.map((o) => (
        <BundleCard
          key={o.label}
          option={o}
          recommended={isRecommended(o)}
          onChoose={onChoose}
          choosing={choosingLabel === o.label}
        />
      ))}
    </div>
  );
}
