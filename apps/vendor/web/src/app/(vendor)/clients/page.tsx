"use client";

// The Clients destination, promoted out of /my-pipeline's "Clients" view tab
// as part of the sidebar redesign (see docs/DECISIONS.md) — the Figma
// prototype shows it as a top-level sidebar item with its own stat tiles and
// a search box, so it gets its own route rather than staying a query-param
// tab. Auth/vendor guard copied from the sibling vendor pages (my-bookings,
// vendor-profile).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { getMyVendor, getVendorClients } from "@/lib/jorna";
import type { VendorClient, VendorDetail } from "@/lib/types";
import { Card, LinkButton } from "@/components/ui";
import { ClientsPanel } from "@/components/ClientsPanel";

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export default function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [clients, setClients] = useState<VendorClient[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/clients&role=vendor");
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
        if (!cancelled) setClients(res.items);
      })
      .catch((err) =>
        !cancelled &&
        setError(err instanceof ApiError ? err.message : "Couldn't load your clients."),
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

  const repeatClients = clients.filter((c) => c.repeat_client).length;
  const lifetimeValueCents = clients.reduce((sum, c) => sum + c.lifetime_value_cents, 0);
  const q = query.trim().toLowerCase();
  const shown = q
    ? clients.filter((c) =>
        [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(q)),
      )
    : clients;

  return (
    <div>
      <header>
        <span className="eyebrow">Selling</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">Clients</h1>
        <p className="mt-2 text-ink-soft">
          {clients.length} {clients.length === 1 ? "client" : "clients"} · all time
        </p>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Total clients</p>
          <p className="serif mt-1 text-2xl text-ink">{clients.length}</p>
          <p className="mt-1 text-xs text-ink-faint">Since launch</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Repeat clients</p>
          <p className="serif mt-1 text-2xl text-ink">{repeatClients}</p>
          <p className="mt-1 text-xs text-ink-faint">Booked 2+ events</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Lifetime bookings</p>
          <p className="serif mt-1 text-2xl text-maroon dark:text-gold">
            {money(lifetimeValueCents)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">Across all clients</p>
        </Card>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients…"
        className="mt-6 w-full max-w-sm rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
      />

      <div className="mt-7">
        <ClientsPanel clients={shown} />
      </div>
    </div>
  );
}
