"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The seller-side pages, linked from each other so a vendor isn't hunting
// through the header. basePath is applied by next/link, so hrefs stay app-relative.
const TABS = [
  { href: "/my-bookings", label: "Requests" },
  { href: "/my-services", label: "Services" },
  { href: "/my-earnings", label: "Earnings" },
  { href: "/vendor-profile", label: "Profile" },
];

export function VendorNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-7 flex flex-wrap gap-2 border-b border-line-soft pb-3">
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
