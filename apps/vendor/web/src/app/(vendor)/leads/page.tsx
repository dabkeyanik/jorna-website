"use client";

// Leads: everything before a contract is signed. For now this is the leads
// list that used to be /my-dashboard's "Leads" view (and what /clients
// redirects to); the Inquiries / Negotiations pipeline from the redesign plan
// replaces it in step 2, along with a header "New lead" that opens the
// contract editor (for now the panel's own "+ New lead" adds one).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@jorna/shared/lib/api";
import { getMyVendor, listLeads } from "@/lib/jorna";
import type { Lead } from "@/lib/types";
import { LeadsPanel } from "@/components/LeadsPanel";
import { PageHeader } from "@/components/vendor/ui";

export default function LeadsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/leads&role=vendor");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyVendor()
      .then(async (mine) => {
        if (cancelled) return;
        if (!mine) {
          router.replace("/vendor-onboarding");
          return;
        }
        const res = await listLeads();
        if (!cancelled) setLeads(res.items);
      })
      .catch((err) =>
        !cancelled && setError(err instanceof ApiError ? err.message : "Couldn't load your leads."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, router]);

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Leads"
        subtitle="Couples you're talking to who haven't signed yet."
      />
      {error ? (
        <p role="alert" className="mb-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}
      <LeadsPanel leads={leads} onLeadsChange={setLeads} />
    </div>
  );
}
