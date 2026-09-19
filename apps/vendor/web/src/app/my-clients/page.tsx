"use client";

// A vendor's own CRM: every client they've ever booked, grouped by account
// when there is one, or by name+phone for a guest booking (no account to
// key on) — see the backend's contract_service.get_vendor_clients.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { getMyVendor, getVendorClients } from "@/lib/jorna";
import type { VendorClient, VendorDetail } from "@/lib/types";
import { Card, LinkButton } from "@/components/ui";
import { VendorNav } from "@/components/VendorNav";

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export default function MyClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [clients, setClients] = useState<VendorClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/my-clients&role=vendor");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyVendor()
      .then(async (mine) => {
        if (cancelled) return;
        setVendor(mine);
        if (!mine) return;
        const res = await getVendorClients();
        if (cancelled) return;
        setClients(res.items);
      })
      .catch((err) =>
        !cancelled && setError(err instanceof ApiError ? err.message : "Couldn't load your clients."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  if (!vendor) {
    return (
      <div className="mx-auto w-[min(560px,100%-2rem)] py-20 text-center">
        <h1 className="serif text-3xl text-maroon dark:text-gold">
          You&apos;re not selling on Jorna yet
        </h1>
        <LinkButton href="/vendor-onboarding" className="mt-6">
          Set up your listing
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto w-[min(var(--container-wide),100%-2rem)] py-10">
      <VendorNav />
      <header>
        <span className="eyebrow">Selling</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">Clients</h1>
        <p className="mt-3 text-ink-soft">Everyone you&apos;ve booked, in one place.</p>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {clients.length === 0 ? (
        <p className="mt-8 text-ink-soft">No clients yet — they&apos;ll show up here once you have a booking.</p>
      ) : (
        <div className="mt-7 grid gap-2.5">
          {clients.map((c) => (
            <Card key={c.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  {c.name || "Unnamed client"}
                  {c.repeat_client ? (
                    <span className="rounded-full bg-gold/12 px-2 py-0.5 text-xs font-semibold text-maroon dark:text-gold">
                      Repeat
                    </span>
                  ) : null}
                  {c.is_guest ? (
                    <span className="rounded-full bg-ground-2 px-2 py-0.5 text-xs text-ink-faint">
                      Direct
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-ink-faint">
                  {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact on file"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="serif text-lg text-ink">{money(c.lifetime_value_cents)}</p>
                <p className="text-xs text-ink-faint">
                  {c.event_count} {c.event_count === 1 ? "event" : "events"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
