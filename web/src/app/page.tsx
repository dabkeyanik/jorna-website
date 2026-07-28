"use client";

// /app/ is not a page — it's the door the site's root opens.
//
// It used to repeat the marketing pitch, then briefly routed by auth state
// (signed in → Home, signed out → sign-in). Both are gone: everyone lands on
// Home. Browsing needs no account, so showing the product first and asking for
// one only when someone tries to book beats a sign-in wall on arrival.
//
// That also means no waiting on the session to load before deciding — this
// redirects immediately. The root shim points straight at /app/home/, so this
// only catches anyone arriving at /app/ directly.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppEntry() {
  const router = useRouter();

  useEffect(() => {
    // replace() so Back returns where they came from rather than bouncing
    // forward through here again.
    router.replace("/home");
  }, [router]);

  return <p className="py-24 text-center text-ink-soft">Taking you in…</p>;
}
