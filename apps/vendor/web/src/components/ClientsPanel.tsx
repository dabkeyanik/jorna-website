"use client";

// The vendor's client CRM — every client they've ever booked, grouped by
// account when there is one, or by name+phone for a guest booking (no
// account to key on) — see the backend's contract_service.get_vendor_clients.
// Promoted to its own top-level page (app/(vendor)/clients/page.tsx) as part
// of the sidebar redesign; used to be a view tab inside /my-pipeline. Data-
// driven by its parent (same pattern as LeadsPanel) so the page can compute
// the stat tiles and search filter from the same fetch.

import type { VendorClient } from "@/lib/types";
import { Card } from "@jorna/shared/components/ui";

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function ClientsPanel({ clients }: { clients: VendorClient[] }) {
  return (
    <div>
      {clients.length === 0 ? (
        <p className="mt-6 text-ink-soft">No clients yet — they&apos;ll show up here once you have a booking.</p>
      ) : (
        <div className="mt-5 grid gap-2.5">
          {clients.map((c) => (
            <Card key={c.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  {c.name || "Unnamed client"}
                  {c.repeat_client ? (
                    <span className="rounded-full bg-gold/12 px-2 py-0.5 text-xs font-semibold text-maroon dark:text-gold">
                      Repeat
                    </span>
                  ) : null}
                  {c.is_guest ? (
                    <span className="rounded-full bg-ground-2 px-2 py-0.5 text-xs text-ink-faint">
                      Direct
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-ink-faint">
                  {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact on file"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="serif text-lg text-ink">{money(c.lifetime_value_cents)}</p>
                <p className="text-xs text-ink-faint">
                  {c.event_count} {c.event_count === 1 ? "event" : "events"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
