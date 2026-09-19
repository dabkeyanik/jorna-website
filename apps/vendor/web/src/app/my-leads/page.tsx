"use client";

// Informal, off-platform prospects a vendor wants to track before they're a
// real booking — "DM'd on Instagram, maybe October, no venue yet." A lead
// isn't a Booking (no committed date/price yet); converting one creates a
// real Contract and the lead stays around as CRM history of how that client
// was won. Leads also show up read-only in the Inquiry column of
// /my-pipeline — this page is where they're actually created/edited.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { createLead, deleteLead, getMyVendor, listLeads, updateLead } from "@/lib/jorna";
import type { Lead, LeadStatus, VendorDetail } from "@/lib/types";
import { Button, Card, Field, LinkButton } from "@/components/ui";
import { VendorNav } from "@/components/VendorNav";

const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "quoted", "won", "lost"];

export default function MyLeadsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/my-leads&role=vendor");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyVendor()
      .then(async (mine) => {
        if (cancelled) return;
        setVendor(mine);
        if (!mine) return;
        const res = await listLeads();
        if (cancelled) return;
        setLeads(res.items);
      })
      .catch((err) =>
        !cancelled && setError(err instanceof ApiError ? err.message : "Couldn't load your leads."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Add a name first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const lead = await createLead({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        event_date_iso: eventDate.trim() || null,
        note: note.trim() || null,
      });
      setLeads((prev) => [lead, ...prev]);
      setName("");
      setPhone("");
      setEmail("");
      setEventDate("");
      setNote("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that lead.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(lead: Lead, status: LeadStatus) {
    setBusyId(lead.lead_id);
    try {
      const updated = await updateLead(lead.lead_id, { status });
      setLeads((prev) => prev.map((l) => (l.lead_id === updated.lead_id ? updated : l)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that lead.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(lead: Lead) {
    setBusyId(lead.lead_id);
    try {
      await deleteLead(lead.lead_id);
      setLeads((prev) => prev.filter((l) => l.lead_id !== lead.lead_id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that lead.");
    } finally {
      setBusyId(null);
    }
  }

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
    <div className="mx-auto w-[min(720px,100%-2rem)] py-10">
      <VendorNav />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Selling</span>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">Leads</h1>
          <p className="mt-3 text-ink-soft">Prospects who reached out off-platform, before there&apos;s a real booking.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ New lead"}</Button>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <Card className="mt-6 p-5">
          <form onSubmit={submitLead} className="grid gap-3">
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Field label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Field
              label="Tentative date (optional)"
              placeholder="e.g. fall 2027, or a real date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <Field
              label="Note (optional)"
              placeholder="Reached out on Instagram. 200+ guests, venue TBD."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" disabled={busy} className="justify-self-start">
              {busy ? "Saving…" : "Save lead"}
            </Button>
          </form>
        </Card>
      ) : null}

      {leads.length === 0 && !showForm ? (
        <p className="mt-8 text-ink-soft">No leads yet — log one when someone reaches out off-platform.</p>
      ) : (
        <div className="mt-7 grid gap-2.5">
          {leads.map((lead) => (
            <Card key={lead.lead_id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{lead.name}</p>
                  <p className="text-xs text-ink-faint">
                    {[lead.event_date_iso, lead.phone, lead.email].filter(Boolean).join(" · ")}
                  </p>
                  {lead.note ? (
                    <p className="mt-1.5 text-sm text-ink-soft">&ldquo;{lead.note}&rdquo;</p>
                  ) : null}
                  {lead.converted_booking_id ? (
                    <p className="mt-1.5 text-xs text-green">Converted to a booking</p>
                  ) : null}
                </div>
                <select
                  value={lead.status}
                  disabled={busyId === lead.lead_id || Boolean(lead.converted_booking_id)}
                  onChange={(e) => changeStatus(lead, e.target.value as LeadStatus)}
                  className="shrink-0 rounded-lg border border-card-edge bg-ground-2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              {!lead.converted_booking_id ? (
                <div className="mt-3 flex gap-2">
                  <LinkButton href="/contracts/new" variant="ghost" size="md">
                    Set up booking →
                  </LinkButton>
                  <Button
                    variant="ghost"
                    size="md"
                    disabled={busyId === lead.lead_id}
                    onClick={() => remove(lead)}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
