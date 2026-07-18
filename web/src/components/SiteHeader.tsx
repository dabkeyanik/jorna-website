"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button, LinkButton } from "./ui";

export function SiteHeader() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-line-soft bg-ground/85 backdrop-blur">
      <div className="mx-auto flex w-[min(1080px,100%-2rem)] items-center justify-between py-3">
        <Link href="/" className="serif text-2xl text-maroon dark:text-gold">
          Jorna
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/browse"
            className="px-2 text-sm font-semibold text-ink-soft transition hover:text-ink"
          >
            Browse
          </Link>
          {loading ? null : user ? (
            <>
              <Link
                href="/bundles"
                className="px-2 text-sm font-semibold text-ink-soft transition hover:text-ink"
              >
                My bundles
              </Link>
              <LinkButton href="/plan" size="md">
                Plan
              </LinkButton>
              <Button variant="ghost" onClick={logout}>
                Sign out
              </Button>
            </>
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
