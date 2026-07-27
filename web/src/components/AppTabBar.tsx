"use client";

// The phone half of the primary navigation. On anything wider the same items
// sit in the header instead (SiteHeader) and this hides — a thumb-reachable bar
// is what a phone wants, and a row of links across the top is what everything
// else does.
//
// The items themselves, the role that picks them, and the badge all live in
// components/nav.

import Link from "next/link";
import { NavBadge, NEEDS_YOU, useAppNav } from "./nav";

export function AppTabBar() {
  const { items, attention, isActive } = useAppNav();
  if (!items) return null;

  return (
    <nav
      className="sticky bottom-0 z-30 border-t border-line-soft bg-ground/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex w-[min(560px,100%)] items-stretch justify-around">
        {items.map((t) => {
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
                <NavBadge count={badge} className="absolute -right-2 -top-1" />
              </span>
              <span className="whitespace-nowrap">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
