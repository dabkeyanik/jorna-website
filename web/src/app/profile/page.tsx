"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getMyVendor } from "@/lib/jorna";
import type { VendorDetail } from "@/lib/types";
import { Button, Card, LinkButton } from "@/components/ui";

function Row({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border border-card-edge bg-card px-4 py-3 transition hover:border-gold/50"
    >
      <span>
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-faint">{sub}</span>
      </span>
      <span className="text-ink-faint">›</span>
    </Link>
  );
}

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/profile");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyVendor()
      .then((v) => !cancelled && setVendor(v))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  const name = [user.f_name, user.l_name].filter(Boolean).join(" ") || user.username;

  return (
    <div className="mx-auto w-[min(680px,100%-2rem)] py-10">
      <header className="flex items-center gap-4">
        {user.pfp_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.pfp_url} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <div className="grid size-16 place-items-center rounded-full bg-panel serif text-2xl text-gold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="serif text-3xl text-maroon dark:text-gold">{name}</h1>
          <p className="text-sm text-ink-soft">{user.email}</p>
        </div>
        <Link
          href="/account"
          className="shrink-0 text-sm font-semibold text-gold hover:underline"
        >
          Settings
        </Link>
      </header>

      {/* Planning side — everyone has this */}
      <section className="mt-8">
        <p className="eyebrow mb-3">Your celebrations</p>
        <div className="grid gap-2">
          <Row href="/events" title="Events" sub="Your celebrations and what's booked for each" />
          <Row href="/bundles" title="Bundles" sub="Vendor teams you've built" />
          <Row href="/browse" title="Browse vendors" sub="Find and book more" />
          <Row href="/blocked" title="Blocked" sub="People you've blocked" />
        </div>
      </section>

      {/* Selling side */}
      <section className="mt-8">
        <p className="eyebrow mb-3">Selling</p>
        {vendor ? (
          <div className="grid gap-2">
            <Row href="/my-bookings" title="Requests" sub="Accept or decline booking requests" />
            <Row href="/my-services" title="Services" sub="What clients can book, and your prices" />
            <Row href="/my-availability" title="Hours" sub="Your weekly availability" />
            <Row href="/my-earnings" title="Earnings" sub="Payouts, escrow, and payment setup" />
            <Row href="/vendor-profile" title="Vendor profile" sub="How clients see you" />
          </div>
        ) : (
          <Card className="p-5">
            <p className="text-sm text-ink-soft">
              Offer your services on Jorna — get discovered by people who are
              actively planning, and get paid safely through escrow.
            </p>
            <LinkButton href="/vendor-profile" className="mt-4">
              Start selling
            </LinkButton>
          </Card>
        )}
      </section>

      <div className="mt-10">
        <Button variant="ghost" onClick={logout}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
