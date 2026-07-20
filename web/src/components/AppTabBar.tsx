"use client";

// Bottom tab bar mirroring the iOS app.
//
//   Client: Home · Build · Bundles · Messages · Profile
//   Vendor: Home · Bookings · Messages · Profile
//
// Role is "has a vendor profile" (getMyVendor != null), the same signal iOS
// uses (vendorID != nil). Only shown to a signed-in user; the whole app lives
// under basePath "/app", which next/link applies to these hrefs.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getMyVendor } from "@/lib/jorna";

type Tab = { href: string; label: string; icon: React.ReactNode; match: string[] };

const I = {
  home: (
    <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />
  ),
  build: (
    <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3L12 3ZM18 14l.9 2.1 2.1.9-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z" />
  ),
  bundles: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5" />,
  calendar: (
    <path d="M4 6.5h16v14H4v-14ZM4 10h16M8 3v4M16 3v4" />
  ),
  messages: <path d="M4 5h16v11H9l-5 4V5Z" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0" />,
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

const CLIENT_TABS: Tab[] = [
  { href: "/browse", label: "Home", icon: icon(I.home), match: ["/browse", "/vendor"] },
  { href: "/plan", label: "Build", icon: icon(I.build), match: ["/plan"] },
  { href: "/bundles", label: "Bundles", icon: icon(I.bundles), match: ["/bundles", "/bundle", "/book", "/events", "/event"] },
  { href: "/messages", label: "Messages", icon: icon(I.messages), match: ["/messages"] },
  { href: "/profile", label: "Profile", icon: icon(I.profile), match: ["/profile"] },
];

const VENDOR_TABS: Tab[] = [
  { href: "/browse", label: "Home", icon: icon(I.home), match: ["/browse", "/vendor"] },
  { href: "/my-bookings", label: "Bookings", icon: icon(I.calendar), match: ["/my-bookings"] },
  { href: "/messages", label: "Messages", icon: icon(I.messages), match: ["/messages"] },
  { href: "/profile", label: "Profile", icon: icon(I.profile), match: ["/profile", "/my-services", "/my-availability", "/my-earnings", "/vendor-profile"] },
];

export function AppTabBar() {
  const { user, loading } = useAuth();
  const pathname = usePathname() ?? "";
  const [isVendor, setIsVendor] = useState<boolean | null>(null);

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

  // Signed-out visitors (marketing "Try it now", browsing, login) get no tabs.
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
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.68rem] font-semibold transition ${
                active ? "text-gold" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
