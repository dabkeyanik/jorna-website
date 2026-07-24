"use client";

// "Needs you" — the one screen that answers what's waiting on you.
//
// The rules live in lib/attention so the tab bar badge counts exactly what this
// page lists. Derived, not pushed: the backend keeps no notification history, so
// nothing can reach you with the tab closed — the page says so rather than
// implying otherwise.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { loadAttention, type AttentionItem } from "@/lib/attention";
import { PushOptIn } from "@/components/PushOptIn";
import { Card, LinkButton } from "@/components/ui";

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AttentionItem[] | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/activity");
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    // Force: this is the page you open *to* check, so it shouldn't show a
    // minute-old cache. It refreshes the badge's cache on the way through.
    setItems(await loadAttention({ force: true }));
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading || !user || items === null) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div className="mx-auto w-[min(680px,100%-2rem)] py-10">
      <h1 className="serif text-4xl text-maroon dark:text-gold">Needs you</h1>
      <p className="mt-2 mb-6 text-ink-soft">Everything waiting on you, in one place.</p>

      <PushOptIn />

      {items.length === 0 ? (
        <Card className="mt-8 p-6 text-center">
          <p className="text-ink-soft">You&apos;re all caught up.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <LinkButton href="/plan" size="md">
              Plan an event
            </LinkButton>
            <LinkButton href="/browse" variant="ghost" size="md">
              Browse vendors
            </LinkButton>
          </div>
        </Card>
      ) : (
        <div className="mt-8 grid gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-xl border border-card-edge bg-card px-4 py-3 transition hover:border-gold/50"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  {item.tone === "urgent" ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  ) : null}
                  <span className="text-sm font-semibold text-ink">{item.title}</span>
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">{item.detail}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-gold">{item.cta} ›</span>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-ink-faint">
        This list is worked out live from your bookings and messages — Jorna
        can&apos;t alert your browser while this tab is closed.
      </p>
    </div>
  );
}
