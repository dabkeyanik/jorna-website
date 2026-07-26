"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button, LinkButton } from "./ui";

// Slim top bar. Primary navigation lives in the bottom tab bar (AppTabBar,
// mirroring iOS); the header just carries the wordmark and the auth affordance.
export function SiteHeader() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-line-soft bg-ground/85 backdrop-blur">
      <div className="mx-auto flex w-[min(1080px,100%-2rem)] items-center justify-between py-3">
        {/* The wordmark goes Home — the ordinary thing a logo does. It points at
            /browse rather than "/", which is the app entry that only redirects
            here anyway.

            There used to be a "← main site" link beside it, back when the root
            was the marketing page. The root is the app now, so leaving is no
            longer a thing the header needs to offer: the walkthrough is on the
            "?" on Home and in the footer. */}
        <Link href="/browse" className="serif text-2xl text-maroon dark:text-gold">
          Jorna
        </Link>
        <nav className="flex items-center gap-2">
          {loading ? null : user ? (
            <Button variant="ghost" onClick={logout}>
              Sign out
            </Button>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost">
                Sign in
              </LinkButton>
              <LinkButton href="/plan">Try it now</LinkButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
