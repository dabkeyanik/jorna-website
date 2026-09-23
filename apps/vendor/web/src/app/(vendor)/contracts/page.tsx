"use client";

// Every contract this vendor has sent, and where each one stands. Until this
// existed the sidebar's Contracts item went straight to /contracts/new, so a
// contract's share link was only ever visible on the confirmation screen right
// after creating it — lose that tab and the only way to resend it was to make
// a new contract.
//
// There's no list-contracts endpoint: a contract *is* a VendorBooking with a
// contract_token, so this reads the same /bookings/vendor/{id} the dashboard
// and Bookings pages do and filters. Status comes from vendorPlan's
// contractStatus, not from anything decided here. Confirming a deposit or
// payment stays on /my-bookings, which owns those actions — this page points
// there rather than growing a second copy of them.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { getMyVendor, listVendorBookings } from "@/lib/jorna";
import type { VendorBooking, VendorDetail } from "@/lib/types";
import { contractNeedsVendor, contractStatus, type ContractStatus } from "@/lib/vendorPlan";
import { guestBookingLink } from "@/lib/contractLink";
import { Button, Card, LinkButton } from "@/components/ui";

const STATUS: Record<ContractStatus, { label: string; tone: string }> = {
  awaiting_details: { label: "Sent — not opened yet", tone: "bg-panel text-ink-soft" },
  awaiting_signature: { label: "Awaiting signature", tone: "bg-[#8b7bd8]/15 text-[#6a5bc0] dark:text-[#b3a8ee]" },
  deposit_due: { label: "Signed — deposit due", tone: "bg-gold/15 text-ink" },
  confirm_deposit: { label: "Confirm deposit", tone: "bg-maroon/10 text-maroon dark:text-gold" },
  balance_due: { label: "Signed — balance due", tone: "bg-gold/15 text-ink" },
  confirm_payment: { label: "Confirm payment", tone: "bg-maroon/10 text-maroon dark:text-gold" },
  paid: { label: "Paid in full", tone: "bg-green/15 text-green" },
  cancelled: { label: "Cancelled", tone: "bg-panel text-ink-faint" },
};

type Filter = "all" | "needs_you" | "waiting" | "paid" | "cancelled";

const FILTERS: { value: Filter; label: string; test: (s: ContractStatus) => boolean }[] = [
  { value: "all", label: "All", test: (s) => s !== "cancelled" },
  { value: "needs_you", label: "Needs you", test: contractNeedsVendor },
  {
    value: "waiting",
    label: "Waiting on client",
    test: (s) => s !== "paid" && s !== "cancelled" && !contractNeedsVendor(s),
  },
  { value: "paid", label: "Paid", test: (s) => s === "paid" },
  { value: "cancelled", label: "Cancelled", test: (s) => s === "cancelled" },
];

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function prettyDate(iso?: string | null): string | null {
  if (!iso || iso === "TBD") return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Needs-you first — it's the reason most visits happen — then soonest event.
function byUrgency(a: VendorBooking, b: VendorBooking): number {
  const na = contractNeedsVendor(contractStatus(a)) ? 0 : 1;
  const nb = contractNeedsVendor(contractStatus(b)) ? 0 : 1;
  if (na !== nb) return na - nb;
  return (a.date_iso ?? "").localeCompare(b.date_iso ?? "");
}

export default function ContractsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [contracts, setContracts] = useState<VendorBooking[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/contracts&role=vendor");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyVendor()
      .then(async (mine) => {
        if (cancelled) return;
        setVendor(mine);
        if (!mine) return;
        const res = await listVendorBookings(mine.vendor_id, { limit: 100 });
        if (!cancelled) setContracts(res.items.filter((b) => b.contract_token));
      })
      .catch((err) =>
        !cancelled &&
        setError(err instanceof ApiError ? err.message : "Couldn't load your contracts."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function copyLink(b: VendorBooking) {
    if (!b.contract_token) return;
    try {
      await navigator.clipboard.writeText(guestBookingLink(b.contract_token));
      setCopiedId(b.booking_id);
      setTimeout(() => setCopiedId((id) => (id === b.booking_id ? null : id)), 2000);
    } catch {
      /* clipboard can be denied — "View as client" still opens the link */
    }
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  if (!vendor && !error) {
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

  const live = contracts.filter((b) => contractStatus(b) !== "cancelled");
  const awaitingSignature = live.filter((b) => !b.signed_at).length;
  const needsYou = live.filter((b) => contractNeedsVendor(contractStatus(b))).length;
  const signedValueCents = live
    .filter((b) => b.signed_at)
    .reduce((sum, b) => sum + (b.amount_cents ?? 0), 0);

  const active = FILTERS.find((f) => f.value === filter) ?? FILTERS[0];
  const shown = contracts.filter((b) => active.test(contractStatus(b))).sort(byUrgency);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Selling</span>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">Contracts</h1>
          <p className="mt-2 text-ink-soft">
            {live.length} {live.length === 1 ? "contract" : "contracts"} · all time
          </p>
        </div>
        <LinkButton href="/contracts/new">+ New contract</LinkButton>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Awaiting signature</p>
          <p className="serif mt-1 text-2xl text-ink">{awaitingSignature}</p>
          <p className="mt-1 text-xs text-ink-faint">Sent, not signed yet</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Needs you</p>
          <p className="serif mt-1 text-2xl text-ink">{needsYou}</p>
          <p className="mt-1 text-xs text-ink-faint">Payments to confirm</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Signed value</p>
          <p className="serif mt-1 text-2xl text-maroon dark:text-gold">
            {money(signedValueCents)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">Across signed contracts</p>
        </Card>
      </div>

      <div role="tablist" aria-label="Filter contracts" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
              filter === f.value
                ? "border-maroon bg-maroon text-ground dark:border-gold dark:bg-gold dark:text-ground"
                : "border-card-edge text-ink-soft hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        {contracts.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-ink-soft">
              No contracts yet. Create one and send the link — your client fills in their
              details and signs, no account needed.
            </p>
            <LinkButton href="/contracts/new" className="mt-5">
              Create your first contract
            </LinkButton>
          </Card>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">Nothing here right now.</p>
        ) : (
          shown.map((b) => {
            const status = contractStatus(b);
            const meta = STATUS[status];
            const date = prettyDate(b.date_iso);
            return (
              <Card key={b.booking_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {b.guest_name || b.client_name || (
                        <span className="text-ink-faint">Client hasn&apos;t filled in details</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {[b.service_name, date].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.amount_cents != null ? (
                      <span className="serif text-lg text-ink">{money(b.amount_cents)}</span>
                    ) : null}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.tone}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
                  <p className="text-xs text-ink-faint">
                    {b.signed_at
                      ? `Signed ${prettyDate(b.signed_at)}${b.signer_name ? ` by ${b.signer_name}` : ""}`
                      : "Not signed yet"}
                    {b.deposit_amount_cents != null
                      ? ` · ${money(b.deposit_amount_cents)} deposit${
                          b.deposit_confirmed_received_at ? " received" : ""
                        }`
                      : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {contractNeedsVendor(status) ? (
                      <LinkButton href="/my-bookings">
                        {status === "confirm_deposit" ? "Confirm deposit" : "Confirm payment"}
                      </LinkButton>
                    ) : null}
                    {status !== "cancelled" && b.contract_token ? (
                      <>
                        <Button variant="ghost" onClick={() => copyLink(b)}>
                          {copiedId === b.booking_id ? "Copied!" : "Copy link"}
                        </Button>
                        {/* A plain anchor: the link is the client's page, opened
                            the way they'd open it, not an in-app navigation. */}
                        <a
                          href={guestBookingLink(b.contract_token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-full px-3 py-2.5 text-[0.95rem] font-semibold text-ink-soft transition hover:text-ink"
                        >
                          View as client
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
