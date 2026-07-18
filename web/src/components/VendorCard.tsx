"use client";

import Link from "next/link";
import { categoryLabel, type VendorSearchItem } from "@/lib/types";

function money(n?: number | null) {
  if (n == null) return null;
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * One search result. `/vendors/search` returns a row per vendor+service pair,
 * so a vendor with several services appears once per service — the card leads
 * with the service and attributes it to the vendor.
 */
export function VendorCard({ item }: { item: VendorSearchItem }) {
  const name = `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim();
  const price = money(item.service_price);

  return (
    <Link
      href={`/vendor?id=${item.vendor_id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-card-edge bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-gold/50"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-panel">
        {item.pfp_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.pfp_url}
            alt={item.service_name || name}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-faint">
            {categoryLabel(item.category)}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-ground/90 px-2.5 py-1 text-xs font-semibold text-maroon backdrop-blur dark:text-gold">
          {categoryLabel(item.category)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="serif text-lg leading-snug text-ink">
          {item.service_name || name}
        </h3>
        <p className="mt-0.5 text-sm text-ink-soft">{name}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="min-w-0">
            {item.location ? (
              <p className="truncate text-xs text-ink-faint">{item.location}</p>
            ) : null}
            {item.rating ? (
              <p className="text-sm text-gold">★ {item.rating.toFixed(1)}</p>
            ) : null}
          </div>
          {price ? (
            // /vendors/search returns the service's rate but not its price_unit,
            // so a per-person rate would read as a full total. Show it as a
            // starting price instead — the vendor page has the real unit.
            <p className="shrink-0 text-right">
              <span className="block text-[0.65rem] uppercase tracking-wide text-ink-faint">
                from
              </span>
              <span className="serif text-lg text-ink">{price}</span>
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
