"use client";

// Hides the shared marketing/marketplace chrome (SiteHeader + SiteFooter) on
// the vendor-shell routes, which render VendorSidebar instead (see
// app/(vendor)/layout.tsx). The only conditional-chrome check in the app —
// kept to one pathname test rather than a deeper restructure, since every
// other route still wants the header/footer exactly as before.

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const VENDOR_SHELL_PREFIXES = [
  "/my-dashboard",
  "/my-bookings",
  "/contracts",
  "/clients",
  "/vendor-profile",
];

export function isVendorShellPath(pathname: string | null): boolean {
  return VENDOR_SHELL_PREFIXES.some(
    (p) => pathname === p || pathname?.startsWith(`${p}/`),
  );
}

export function ChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isVendorShellPath(pathname)) return null;
  return <>{children}</>;
}
