"use client";

// /app/ is not a page — it is the door the marketing site's "Try it now" button
// opens. It used to repeat the marketing pitch (same headline, same lede, a
// second "Try it now — build a bundle" button), so reaching anything actually
// took two clicks through near-identical screens. Now it only routes:
//
//   signed in  → /browse, the same Home the tab bar's Home tab goes to
//   signed out → /login, which sends them to /plan afterwards — the bundle
//                builder the button promised
//
// replace() rather than push() so Back from Home returns to the marketing page
// instead of landing here and bouncing forward again.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function AppEntry() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return; // still reading the stored session
    router.replace(user ? "/browse" : "/login");
  }, [loading, user, router]);

  return <p className="py-24 text-center text-ink-soft">Taking you in…</p>;
}
