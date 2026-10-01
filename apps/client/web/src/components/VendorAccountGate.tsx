"use client";

// This app is the buying half of Jorna; vendors work on jornaevents.com.
//
// Its seller pages (dashboard, bookings, calendar, earnings, listing,
// onboarding) have moved there and are gone from here. A vendor account that
// signs in on this site used to be routed to them. Now it's told where they
// are, once, for every page — rather than each client-only page guarding
// itself (the old ClientOnlyRoute), which left the pages without a guard
// showing a seller the buyer's app.
//
// Role is the same signal as everywhere else (a vendor profile exists), read
// through lib/role's cache. Signed-out visitors and the sign-in pages pass
// straight through — a vendor has to be able to sign out, or in as someone else.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { loadIsVendor } from "@/lib/role";
import { vendorSiteUrl } from "@/lib/vendorSite";
import { Button, Card } from "@jorna/shared/components/ui";

const OPEN_TO_ANYONE = ["/login", "/auth", "/forgot-password", "/reset-password"];

export function VendorAccountGate({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname() ?? "";
  // Keyed to the account it was checked for, so signing out of a vendor
  // account and into a client one never shows the client this notice.
  const [checked, setChecked] = useState<{ userId: string; isVendor: boolean } | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    loadIsVendor().then((isVendor) => !cancelled && setChecked({ userId: user.user_id, isVendor }));
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const isVendor = Boolean(user && checked?.userId === user.user_id && checked.isVendor);
  const open = OPEN_TO_ANYONE.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (open || !isVendor) return <>{children}</>;

  return (
    <div className="mx-auto w-[min(560px,100%-2rem)] py-20">
      <Card className="p-8 text-center">
        <h1 className="serif text-3xl text-maroon dark:text-gold">This is a vendor account</h1>
        <p className="mt-3 text-ink-soft">
          Your dashboard, bookings, contracts and listing are on jornaevents.com — this site is
          where clients plan and book. Sign in there with the same email and password.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <a
            href={vendorSiteUrl("/overview")}
            className="inline-flex items-center rounded-full bg-maroon px-5 py-2.5 font-semibold text-ground hover:brightness-110"
          >
            Go to jornaevents.com
          </a>
          <Button variant="ghost" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
