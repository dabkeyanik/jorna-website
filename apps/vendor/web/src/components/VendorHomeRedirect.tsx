"use client";

// Home is a pitch, and a signed-in vendor has already bought it. Everything it
// offers them — what Jorna is, why list here, a way to sign up — is either
// done or lives in the dashboard, so typing jornaevents.com sends them
// straight there rather than to marketing copy. (The in-app logo already
// points vendors at the dashboard — nav.tsx — this covers the address bar,
// bookmarks and external links.) Clients and signed-out visitors get Home
// as before.
//
// Unlike ClientOnlyRoute, this never blanks the page for a signed-out
// visitor, including in the static export: Home's pre-rendered HTML carries
// its real copy (it's the site's root and what search engines read), and
// rendering "Loading…" at build time would replace that with nothing.
// Content is held back only once there's reason to think the visitor might
// be a vendor — a stored token before /me settles, or a known user before
// the role check does — which only ever happens in a browser.

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { hasStoredSession, useAuth } from "@/lib/auth";
import { loadIsVendor } from "@/lib/role";

const noSubscribe = () => () => {};

export function VendorHomeRedirect({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const storedSession = useSyncExternalStore(noSubscribe, hasStoredSession, () => false);
  const [isVendor, setIsVendor] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    loadIsVendor().then((v) => !cancelled && setIsVendor(v));
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  useEffect(() => {
    if (isVendor === true) router.replace("/my-dashboard");
  }, [isVendor, router]);

  const deciding = user ? isVendor !== false : loading && storedSession;
  if (deciding) return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  return <>{children}</>;
}
