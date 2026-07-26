"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button, LinkButton } from "./ui";

// Slim top bar. Primary navigation lives in the bottom tab bar (AppTabBar,
// mirroring iOS); the header just carries the wordmark, the escape back to the
// marketing site, and the auth affordance.
export function SiteHeader() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-line-soft bg-ground/85 backdrop-blur">
      <div className="mx-auto flex w-[min(1080px,100%-2rem)] items-center justify-between py-3">
        <div className="flex items-baseline gap-3">
          {/* Straight to Home, not to "/" — that is the app entry point, which
              now redirects signed-out visitors to sign-in. Browsing needs no
              account, so clicking the wordmark must not demand one. */}
          <Link href="/browse" className="serif text-2xl text-maroon dark:text-gold">
            Jorna
          </Link>
          {/* Plain anchor: next/link would keep the "/app" basePath and stay
              inside the app instead of returning to the marketing page. That is
              the whole point here, so the no-html-link-for-pages rule — which
              reads "/" as the app's own entry route — is wrong about this one. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="hidden text-xs text-ink-faint transition hover:text-ink sm:inline"
          >
            ← main site
          </a>
        </div>
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
