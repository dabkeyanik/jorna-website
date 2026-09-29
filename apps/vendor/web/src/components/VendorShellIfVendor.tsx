"use client";

// The sidebar for a shared page (Messages), shown only when a vendor is the
// one looking — see useVendorShell in ChromeGate for why these routes can't
// just join the (vendor) route group.
//
// While the role is still unknown this renders a placeholder rather than the
// page itself: drawing the page bare and then wrapping it in the sidebar once
// the answer arrives would remount it, throwing away whatever it had loaded.

import { VendorSidebar } from "@/components/VendorSidebar";
import { useVendorShell } from "@/components/ChromeGate";

export function VendorShellIfVendor({ children }: { children: React.ReactNode }) {
  const shell = useVendorShell();
  if (shell === null) return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  return shell ? <VendorSidebar>{children}</VendorSidebar> : <>{children}</>;
}
