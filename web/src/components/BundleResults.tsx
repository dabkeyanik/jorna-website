"use client";

import { categoryLabel, type BundleOption } from "@/lib/types";
import { Card } from "./ui";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function BundleCard({ option }: { option: BundleOption }) {
  const { bundle } = option;
  const unfilled = bundle.unfilled_categories ?? [];
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="serif text-2xl text-maroon dark:text-gold">{option.label}</h3>
        <span className="serif text-xl text-ink">{money(bundle.estimated_total_min)}</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{option.description}</p>

      <div className="mt-4 flex-1 space-y-2.5">
        {bundle.items.map((item) => (
          <div
            key={`${item.category}-${item.vendor_id ?? item.vendor_name}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-panel px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {item.service_name || categoryLabel(item.category)}
              </p>
              <p className="truncate text-xs text-ink-faint">
                {categoryLabel(item.category)} · {item.vendor_name}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-ink">{money(item.price_min)}</p>
              {item.rating > 0 ? (
                <p className="text-xs text-gold">★ {item.rating.toFixed(1)}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {unfilled.length > 0 ? (
        <p className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-xs text-ink-soft">
          No available {unfilled.map(categoryLabel).join(", ")} for your date — you can
          add {unfilled.length === 1 ? "it" : "one"} later if a vendor opens up.
        </p>
      ) : null}
    </Card>
  );
}

export function BundleResults({ options }: { options: BundleOption[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {options.map((o) => (
        <BundleCard key={o.label} option={o} />
      ))}
    </div>
  );
}
