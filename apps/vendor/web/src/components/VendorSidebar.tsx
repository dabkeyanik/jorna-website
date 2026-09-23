"use client";

// The persistent shell for the vendor-facing app (see app/(vendor)/layout.tsx):
// a fixed left rail with the five sidebar destinations, ported from the Figma
// Make prototype "sprint-center" (2026-09-22) that made the vendor dashboard
// the app's primary surface instead of one destination in the shared header
// nav (see docs/DECISIONS.md for the full reasoning).
//
// The rail's dark chrome is deliberately NOT one of the app's `--color-*`
// tokens — both the prototype's light and dark dashboard screens show the
// identical dark maroon rail, so it's brand chrome, not something the
// light/dark toggle should touch. Hardcoded to values borrowed from the
// existing dark palette (globals.css's `[data-theme="dark"]` block) rather
// than picked fresh, so it stays visually consistent with the rest of the
// app's dark mode.
//
// SiteHeader's sign-out button and the app's (previously nonexistent)
// light/dark toggle both have to live somewhere now that SiteHeader is
// hidden on these routes (see ChromeGate) — both ended up here, in the
// bottom user card and the top-right of the logo row respectively.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getMyVendor } from "@/lib/jorna";
import { loadAttention } from "@/lib/attention";
import { getEffectiveTheme, toggleTheme, type Theme } from "@/lib/theme";
import { categoryLabel, type VendorDetail } from "@/lib/types";
import { Avatar } from "@/components/ui";
import { icon, I } from "@/components/nav";

const RAIL_BG = "#2a0c19";
const RAIL_BG_ACTIVE = "#3f1424";
const RAIL_BORDER = "rgba(224,180,87,0.16)";
const RAIL_INK = "#f3e6d6";
const RAIL_INK_SOFT = "#c9a891";
const RAIL_GOLD = "#e0b457";

interface SidebarItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (pathname: string) => boolean;
}

const prefix = (p: string) => (pathname: string) =>
  pathname === p || pathname.startsWith(`${p}/`);

const ITEMS: SidebarItem[] = [
  { href: "/my-dashboard", label: "Dashboard", icon: icon(I.dashboard), match: prefix("/my-dashboard") },
  { href: "/my-bookings", label: "Bookings", icon: icon(I.pipeline), match: prefix("/my-bookings") },
  { href: "/contracts", label: "Contracts", icon: icon(I.document), match: prefix("/contracts") },
  { href: "/clients", label: "Clients", icon: icon(I.clients), match: prefix("/clients") },
  { href: "/vendor-profile", label: "Settings", icon: icon(I.gear), match: prefix("/vendor-profile") },
];

export function VendorSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { logout } = useAuth();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [bookingsBadge, setBookingsBadge] = useState(0);
  // Undefined until mounted: the effective theme depends on localStorage +
  // matchMedia, neither readable during server-less-but-still-first-render,
  // so the toggle's icon/label render nothing until this settles rather than
  // guessing and flashing.
  const [theme, setThemeState] = useState<Theme | undefined>(undefined);

  useEffect(() => {
    setThemeState(getEffectiveTheme());
  }, []);

  useEffect(() => {
    // Once per mount, not once per page: this component lives in
    // app/(vendor)/layout.tsx, which Next keeps mounted across navigations
    // between vendor routes — so this is one request per vendor session in
    // the shell, not one per page view. Unlike the badge effect below, the
    // vendor's name/avatar/category rarely change mid-session, so there's no
    // pathname dependency to re-run it on navigation.
    let cancelled = false;
    getMyVendor()
      .then((v) => !cancelled && setVendor(v))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Re-checked on navigation, same as useAppNav's own attention effect
    // (nav.tsx) — so the Bookings badge follows you as you act on things.
    let cancelled = false;
    loadAttention()
      .then((items) => !cancelled && setBookingsBadge(items.length))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const name = [vendor?.f_name, vendor?.l_name].filter(Boolean).join(" ");

  return (
    <div className="lg:flex lg:min-h-[calc(100vh-1px)]">
      <aside
        style={{ background: RAIL_BG, borderColor: RAIL_BORDER }}
        className="flex shrink-0 flex-col border-b lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r"
      >
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <Link href="/my-dashboard" className="serif text-2xl" style={{ color: RAIL_GOLD }}>
            Jorna
          </Link>
          <button
            type="button"
            onClick={() => setThemeState(toggleTheme())}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{ color: RAIL_INK_SOFT, borderColor: RAIL_BORDER }}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition hover:brightness-125"
          >
            {theme === "dark" ? "☀" : "☾"}
            <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 px-3 py-2" aria-label="Vendor">
          {ITEMS.map((item) => {
            const active = item.match(pathname);
            const badge = item.href === "/my-bookings" ? bookingsBadge : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={{ background: active ? RAIL_BG_ACTIVE : "transparent" }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:brightness-125"
              >
                <span style={{ color: active ? RAIL_GOLD : RAIL_INK_SOFT }}>{item.icon}</span>
                <span style={{ color: active ? RAIL_GOLD : RAIL_INK }}>{item.label}</span>
                {badge > 0 ? (
                  <span
                    aria-hidden="true"
                    style={{ background: RAIL_GOLD, color: RAIL_BG }}
                    className="ml-auto min-w-[1.05rem] rounded-full px-1 text-center text-[0.6rem] font-bold leading-[1.05rem]"
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t px-4 py-4" style={{ borderColor: RAIL_BORDER }}>
          <div className="flex items-center gap-3">
            <Avatar src={vendor?.pfp_url} name={name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: RAIL_INK }}>
                {name || "Your business"}
              </p>
              {vendor?.category ? (
                <p className="truncate text-xs" style={{ color: RAIL_INK_SOFT }}>
                  {categoryLabel(vendor.subcategory || vendor.category)}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            style={{ color: RAIL_INK_SOFT }}
            className="mt-3 text-xs font-medium underline-offset-2 hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto w-[min(var(--container-wide),100%-2rem)] py-10">{children}</div>
      </div>
    </div>
  );
}
