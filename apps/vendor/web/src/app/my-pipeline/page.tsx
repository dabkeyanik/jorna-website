"use client";

// The vendor's booking pipeline, kanban-style: Inquiry -> Awaiting client ->
// Confirmed -> Deposit received -> Done. Every stage is derived client-side
// from data already fetched (see lib/vendorPlan.ts's pipelineStage) — there
// is no backend "stage" field to keep in sync.
//
// Also the single home for the vendor's Leads and Clients views (folded in
// from the old /my-leads and /my-clients routes) — both are alternate
// slices of data this page already needs (leads) or is small enough to fetch
// on demand (clients), so they're view tabs here rather than separate nav
// destinations. Board keeps its own read-only preview of open leads in the
// Inquiry column; the Leads tab is where they're actually created/edited.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { getMyVendor, listLeads, listVendorBookings } from "@/lib/jorna";
import {
  isDeadVendorBooking,
  pipelineStage,
  pipelineStats,
  type PipelineStage,
} from "@/lib/vendorPlan";
import type { Lead, VendorBooking, VendorDetail } from "@/lib/types";
import { Button, Card, LinkButton } from "@/components/ui";
import { VendorNav } from "@/components/VendorNav";
import { LeadsPanel } from "@/components/LeadsPanel";
import { ClientsPanel } from "@/components/ClientsPanel";

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

const STAGES: { value: PipelineStage; label: string }[] = [
  { value: "inquiry", label: "Inquiry" },
  { value: "awaiting_client", label: "Awaiting client" },
  { value: "confirmed", label: "Confirmed" },
  { value: "deposit_received", label: "Deposit received" },
  { value: "done", label: "Done" },
];

type View = "board" | "leads" | "clients";

const VIEWS: { value: View; label: string }[] = [
  { value: "board", label: "Board" },
  { value: "leads", label: "Leads" },
  { value: "clients", label: "Clients" },
];

function BookingCard({ b }: { b: VendorBooking }) {
  const name = b.client_name || b.guest_name || "A client";
  return (
    <Card className="p-3.5">
      <p className="text-sm font-medium text-ink">{name}</p>
      <p className="text-xs text-ink-faint">
        {[b.service_name, b.date_iso].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-maroon dark:text-gold">
        {b.amount_cents != null ? money(b.amount_cents) : `$${b.price}`}
      </p>
      {b.deposit_percent != null ? (
        <p className="mt-1 text-xs text-ink-faint">
          {b.deposit_confirmed_received_at
            ? "Deposit confirmed"
            : b.deposit_marked_paid_at
              ? "Deposit marked paid — confirm on Bookings"
              : `Deposit due: ${b.deposit_amount_cents != null ? money(b.deposit_amount_cents) : `${b.deposit_percent}%`}`}
        </p>
      ) : null}
    </Card>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Card className="p-3.5">
      <p className="text-sm font-medium text-ink">{lead.name}</p>
      {lead.event_date_iso ? <p className="text-xs text-ink-faint">{lead.event_date_iso}</p> : null}
      {lead.note ? <p className="mt-1.5 text-xs text-ink-soft">&ldquo;{lead.note}&rdquo;</p> : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-ground-2 px-2 py-0.5 text-xs text-ink-faint">
          Lead · no booking yet
        </span>
        <LinkButton href="/contracts/new" variant="ghost" size="md">
          Set up booking →
        </LinkButton>
      </div>
    </Card>
  );
}

function MyPipelineInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const view: View = (params.get("view") as View | null) ?? "board";

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const mine = await getMyVendor().catch(() => null);
    if (!mine) {
      setVendor(null);
      return;
    }
    setVendor(mine);
    const [b, l] = await Promise.all([
      listVendorBookings(mine.vendor_id, { limit: 100 }).then((r) => r.items).catch(() => []),
      listLeads().then((r) => r.items).catch(() => []),
    ]);
    setBookings(b);
    // The full list, converted included: the Leads tab shows conversion
    // history, the Board below filters this down to open leads itself.
    setLeads(l);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/my-pipeline&role=vendor");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    load()
      .catch((err) =>
        !cancelled && setError(err instanceof ApiError ? err.message : "Couldn't load your pipeline."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, load]);

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

  const openLeads = leads.filter((lead) => !lead.converted_booking_id);
  const live = bookings.filter((b) => !isDeadVendorBooking(b));
  const stats = pipelineStats(live);
  const byStage: Record<PipelineStage, VendorBooking[]> = {
    inquiry: [],
    awaiting_client: [],
    confirmed: [],
    deposit_received: [],
    done: [],
  };
  for (const b of live) byStage[pipelineStage(b)].push(b);

  return (
    <div className="mx-auto w-[min(var(--container-wide),100%-2rem)] py-10">
      <VendorNav />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Selling</span>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">Pipeline</h1>
        </div>
        <LinkButton href="/contracts/new" size="lg">
          + New booking
        </LinkButton>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.value}
            href={v.value === "board" ? "/my-pipeline" : `/my-pipeline?view=${v.value}`}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
              view === v.value
                ? "border-gold bg-gold/15 text-maroon dark:text-gold"
                : "border-card-edge bg-ground-2 text-ink-soft hover:border-gold/50"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {view === "leads" ? (
        <div className="mt-7">
          <LeadsPanel leads={leads} onLeadsChange={setLeads} />
        </div>
      ) : view === "clients" ? (
        <div className="mt-7">
          <ClientsPanel />
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Open inquiries</p>
              <p className="serif mt-1 text-2xl text-ink">{stats.openInquiries + openLeads.length}</p>
              <p className="mt-1 text-xs text-ink-faint">Leads not yet booked</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Awaiting client</p>
              <p className="serif mt-1 text-2xl text-ink">{stats.awaitingClient}</p>
              <p className="mt-1 text-xs text-ink-faint">Link sent, not signed yet</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Deposits still owed</p>
              <p className="serif mt-1 text-2xl text-maroon dark:text-gold">
                {money(stats.depositsOwedCents)}
              </p>
              <p className="mt-1 text-xs text-ink-faint">Across open bookings</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Confirmed events</p>
              <p className="serif mt-1 text-2xl text-green">{stats.confirmedEvents}</p>
            </Card>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-5">
            {STAGES.map((stage) => {
              const items = byStage[stage.value];
              const isInquiry = stage.value === "inquiry";
              const count = isInquiry ? items.length + openLeads.length : items.length;
              return (
                <div key={stage.value}>
                  <div className="mb-3 flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      {stage.label}
                    </p>
                    <span className="rounded-full bg-ground-2 px-2 py-0.5 text-xs text-ink-faint">
                      {count}
                    </span>
                  </div>
                  <div className="grid gap-2.5">
                    {isInquiry && openLeads.map((lead) => <LeadCard key={lead.lead_id} lead={lead} />)}
                    {items.map((b) => (
                      <BookingCard key={b.booking_id} b={b} />
                    ))}
                    {count === 0 ? <p className="text-xs text-ink-faint">Nothing here.</p> : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <Button variant="ghost" onClick={() => router.push("/my-bookings")}>
              Manage bookings & confirm payments →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function MyPipelinePage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <MyPipelineInner />
    </Suspense>
  );
}
