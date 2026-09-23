"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The seller-side pages, on phones only — and, since the 2026-09 sidebar
// redesign (see docs/DECISIONS.md), only rendered by the two vendor pages
// that didn't move into that shell: /my-calendar and /my-earnings. Every
// other seller destination (Dashboard, Bookings, Contracts, Clients,
// Settings) now lives behind VendorSidebar instead, which replaces this
// strip on those routes.
//
// The desktop header still carries the full set (VENDOR_DESKTOP_TABS), so a
// vendor on Calendar or Earnings can still reach the sidebar-shell pages from
// there; this row exists for phones, which don't have that header row.
//
// basePath is applied by next/link, so hrefs stay app-relative.
const TABS = [
  { href: "/my-dashboard", label: "Dashboard" },
  { href: "/my-bookings", label: "Bookings" },
  { href: "/my-calendar", label: "Calendar" },
  { href: "/my-earnings", label: "Earnings" },
  { href: "/vendor-profile", label: "Settings" },
];

export function VendorNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-7 flex flex-wrap gap-2 border-b border-line-soft pb-3 md:hidden">
      {TABS.map((t) => {
        const active = pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              active
                ? "bg-maroon text-ground dark:bg-gold dark:text-[#2A0C19]"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
