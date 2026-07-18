"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { listBundles } from "@/lib/jorna";
import type { BundleDetail } from "@/lib/types";
import { Card, LinkButton } from "@/components/ui";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function BundlesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bundles, setBundles] = useState<BundleDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/bundles");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listBundles()
      .then((b) => !cancelled && setBundles(b))
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Couldn't load your bundles.");
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div className="mx-auto w-[min(1080px,100%-2rem)] py-10">
      <header className="text-center">
        <span className="eyebrow">Your bundles</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
          Your celebrations
        </h1>
      </header>

      {error ? (
        <p className="mt-8 rounded-lg bg-maroon/10 px-3 py-2 text-center text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-10 text-center text-ink-soft">Loading…</p>
      ) : bundles.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-ink-soft">You haven&apos;t built a bundle yet.</p>
          <LinkButton href="/plan" className="mt-5">
            Build my first bundle
          </LinkButton>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {bundles.map((b) => (
            <Link key={b.bundle_id} href={`/bundle?id=${b.bundle_id}`}>
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-gold/50">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="serif text-xl text-ink">
                    {b.event_name || b.name}
                  </h2>
                  <span className="shrink-0 rounded-full border border-card-edge px-2.5 py-1 text-xs capitalize text-ink-faint">
                    {b.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  {b.booking_count} {b.booking_count === 1 ? "vendor" : "vendors"}
                  {b.event?.date_iso ? ` · ${b.event.date_iso}` : ""}
                </p>
                <p className="serif mt-3 text-lg text-ink">
                  {money(b.total_estimated_cost)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
