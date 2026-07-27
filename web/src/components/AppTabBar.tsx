"use client";

// Bottom tab bar mirroring the iOS app, plus two web-only tabs: "Marketplace"
// (search/filter/browse, split out of the Home landing page — vendors don't
// shop for other vendors, so it's client-only) and "Needs you".
//
//   Client: Home · Marketplace · Build · Bundles · Needs you · Messages · Profile
//   Vendor: Home · Bookings · Needs you · Messages · Profile
//
// Role is "has a vendor profile" (getMyVendor != null), the same signal iOS
// uses (vendorID != nil). Only shown to a signed-in user; the whole app lives
// under basePath "/app", which next/link applies to these hrefs.
//
// The badge counts exactly what /activity lists — both read lib/attention, whose
// short TTL cache means navigating around doesn't re-derive it each time.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getMyVendor } from "@/lib/jorna";
import { loadAttention } from "@/lib/attention";

type Tab = { href: string; label: string; icon: React.ReactNode; match: string[] };

const I = {
  home: (
    <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />
  ),
  build: (
    <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3L12 3ZM18 14l.9 2.1 2.1.9-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z" />
  ),
  bundles: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5" />,
  marketplace: (
    <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5v9.5h16V9.5M4 9.5a2.5 2.5 0 0 0 5 0M9 9.5a2.5 2.5 0 0 0 5 0M14 9.5a2.5 2.5 0 0 0 5 0" />
  ),
  calendar: (
    <path d="M4 6.5h16v14H4v-14ZM4 10h16M8 3v4M16 3v4" />
  ),
  messages: <path d="M4 5h16v11H9l-5 4V5Z" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0" />,
  needsYou: <path d="M12 3a6 6 0 0 0-6 6c0 4-2 5-2 5h16s-2-1-2-5a6 6 0 0 0-6-6ZM10 19a2 2 0 0 0 4 0" />,
};

const icon = (d: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-6"
    aria-hidden="true"
  >
    {d}
  </svg>
);

const NEEDS_YOU: Tab = {
  href: "/activity",
  label: "Needs you",
  icon: icon(I.needsYou),
  match: ["/activity"],
};

const CLIENT_TABS: Tab[] = [
  { href: "/browse", label: "Home", icon: icon(I.home), match: ["/browse"] },
  {
    href: "/marketplace",
    label: "Marketplace",
    icon: icon(I.marketplace),
    match: ["/marketplace", "/vendor"],
  },
  { href: "/plan", label: "Build", icon: icon(I.build), match: ["/plan"] },
  { href: "/bundles", label: "Bundles", icon: icon(I.bundles), match: ["/bundles", "/bundle", "/book", "/events", "/event"] },
  NEEDS_YOU,
  { href: "/messages", label: "Messages", icon: icon(I.messages), match: ["/messages"] },
  { href: "/profile", label: "Profile", icon: icon(I.profile), match: ["/profile"] },
];

const VENDOR_TABS: Tab[] = [
  { href: "/browse", label: "Home", icon: icon(I.home), match: ["/browse", "/vendor"] },
  { href: "/my-bookings", label: "Bookings", icon: icon(I.calendar), match: ["/my-bookings"] },
  NEEDS_YOU,
  { href: "/messages", label: "Messages", icon: icon(I.messages), match: ["/messages"] },
  { href: "/profile", label: "Profile", icon: icon(I.profile), match: ["/profile", "/my-services", "/my-availability", "/my-earnings", "/vendor-profile"] },
];

export function AppTabBar() {
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
    getMyVendor()
      .then((v) => !cancelled && setIsVendor(v != null))
      .catch(() => !cancelled && setIsVendor(false));
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

  // Signed-out visitors (browsing, "Get started", login) get no tabs.
  if (loading || !user) return null;

  const tabs = isVendor ? VENDOR_TABS : CLIENT_TABS;

  const isActive = (t: Tab) =>
    t.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

  return (
    <nav
      className="sticky bottom-0 z-30 border-t border-line-soft bg-ground/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex w-[min(560px,100%)] items-stretch justify-around">
        {tabs.map((t) => {
          const active = isActive(t);
          const badge = t.href === NEEDS_YOU.href ? attention : 0;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              aria-label={badge > 0 ? `${t.label}, ${badge} waiting` : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.68rem] font-semibold transition ${
                active ? "text-gold" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              <span className="relative">
                {t.icon}
                {badge > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-2 -top-1 min-w-[1.05rem] rounded-full bg-maroon px-1 text-center text-[0.6rem] font-bold leading-[1.05rem] text-ground dark:bg-gold"
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </span>
              <span className="whitespace-nowrap">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
