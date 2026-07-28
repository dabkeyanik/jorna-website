"use client";

// The app's primary navigation, defined once and rendered twice: as links in
// the header on desktop (SiteHeader), and as the bottom tab bar on phones
// (AppTabBar). Only one is visible at a time — the split is CSS, so both mount.
//
//   Client: Home · Builder · Marketplace · Dashboard · Needs you · Messages · Profile
//   Vendor: Home · Dashboard · Needs you · Messages · Profile
//
// Role is "has a vendor profile" (getMyVendor != null), the same signal iOS uses
// (vendorID != nil). Shown only to a signed-in user; the whole app lives under
// basePath "/app", which next/link applies to these hrefs.
//
// The badge counts exactly what /activity lists — both read lib/attention, whose
// short TTL cache means navigating around doesn't re-derive it each time.

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { loadAttention } from "@/lib/attention";
import { loadIsVendor } from "@/lib/role";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: string[];
}

const I = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  build: (
    <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3L12 3ZM18 14l.9 2.1 2.1.9-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z" />
  ),
  marketplace: (
    <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5v9.5h16V9.5M4 9.5a2.5 2.5 0 0 0 5 0M9 9.5a2.5 2.5 0 0 0 5 0M14 9.5a2.5 2.5 0 0 0 5 0" />
  ),
  dashboard: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5" />,
  messages: <path d="M4 5h16v11H9l-5 4V5Z" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0" />,
  needsYou: (
    <path d="M12 3a6 6 0 0 0-6 6c0 4-2 5-2 5h16s-2-1-2-5a6 6 0 0 0-6-6ZM10 19a2 2 0 0 0 4 0" />
  ),
};

export const icon = (d: React.ReactNode, className = "size-6") => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {d}
  </svg>
);

export const NEEDS_YOU: NavItem = {
  href: "/activity",
  label: "Needs you",
  icon: icon(I.needsYou),
  match: ["/activity"],
};

export const CLIENT_TABS: NavItem[] = [
  { href: "/home", label: "Home", icon: icon(I.home), match: ["/home", "/browse"] },
  { href: "/plan", label: "Builder", icon: icon(I.build), match: ["/plan"] },
  {
    href: "/marketplace",
    label: "Marketplace",
    icon: icon(I.marketplace),
    match: ["/marketplace", "/vendor"],
  },
  {
    href: "/bundles",
    label: "Dashboard",
    icon: icon(I.dashboard),
    match: ["/bundles", "/bundle", "/book", "/events", "/event"],
  },
  NEEDS_YOU,
  { href: "/messages", label: "Messages", icon: icon(I.messages), match: ["/messages"] },
  { href: "/profile", label: "Profile", icon: icon(I.profile), match: ["/profile"] },
];

export const VENDOR_TABS: NavItem[] = [
  { href: "/home", label: "Home", icon: icon(I.home), match: ["/home", "/browse", "/vendor"] },
  {
    href: "/my-dashboard",
    label: "Dashboard",
    icon: icon(I.dashboard),
    // Every seller page hangs off the dashboard now, reached through VendorNav,
    // so they all keep this tab current. They used to light Profile, back when
    // Profile was the only tab that owned them — two tabs matching the same
    // path would light both.
    match: [
      "/my-dashboard",
      "/my-bookings",
      "/my-calendar",
      "/my-services",
      "/my-availability",
      "/my-earnings",
      "/vendor-profile",
    ],
  },
  NEEDS_YOU,
  { href: "/messages", label: "Messages", icon: icon(I.messages), match: ["/messages"] },
  { href: "/profile", label: "Profile", icon: icon(I.profile), match: ["/profile"] },
];

/**
 * The items to show, the badge count, and which one is current.
 * `items` is null for a signed-out visitor — browsing, "Get started", login.
 */
export function useAppNav(): {
  items: NavItem[] | null;
  attention: number;
  isActive: (item: NavItem) => boolean;
} {
  const { user, loading } = useAuth();
  const pathname = usePathname() ?? "";
  const [isVendor, setIsVendor] = useState<boolean | null>(null);
  const [attention, setAttention] = useState(0);

  useEffect(() => {
    if (!user) {
      setIsVendor(null);
      return;
    }
    let cancelled = false;
    loadIsVendor().then((v) => !cancelled && setIsVendor(v));
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Re-check on navigation so the badge follows you as you act on things. Cheap:
  // lib/attention's TTL cache makes most of these a no-op, so this is roughly
  // one derivation a minute, not one per page.
  useEffect(() => {
    if (!user) {
      setAttention(0);
      return;
    }
    let cancelled = false;
    loadAttention()
      .then((items) => !cancelled && setAttention(items.length))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  return {
    items: loading || !user ? null : isVendor ? VENDOR_TABS : CLIENT_TABS,
    attention,
    isActive: (item) =>
      item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)),
  };
}

/** The count bubble on Needs you. Nothing when there's nothing waiting. */
export function NavBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={`min-w-[1.05rem] rounded-full bg-maroon px-1 text-center text-[0.6rem] font-bold leading-[1.05rem] text-ground dark:bg-gold ${className}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
