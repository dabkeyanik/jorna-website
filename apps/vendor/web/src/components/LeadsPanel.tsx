"use client";

// The leads list on /leads (it was /my-dashboard's ?view=leads) — folded in from the old
// /my-pipeline route in the 2026-09 sidebar redesign. Informal, off-platform
// prospects a vendor wants to track before they're a real booking — "DM'd on
// Instagram, maybe October, no venue yet." A lead isn't a Booking (no
// committed date/price yet); converting one creates a real Contract and the
// lead stays around as CRM history of how that client was won. The Board
// view (my-dashboard's own page.tsx) renders the same, unconverted leads
// read-only in its Inquiry column — this panel is where they're actually
// created/edited/deleted.

import { useState } from "react";
import { ApiError } from "@jorna/shared/lib/api";
import { createLead, deleteLead, updateLead } from "@/lib/jorna";
import type { Lead, LeadStatus } from "@/lib/types";
import { Button, Card, Field, LinkButton } from "@jorna/shared/components/ui";

const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "quoted", "won", "lost"];

export function LeadsPanel({
  leads,
  onLeadsChange,
}: {
  leads: Lead[];
  onLeadsChange: (updater: (prev: Lead[]) => Lead[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      onLeadsChange((prev) => [lead, ...prev]);
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
      onLeadsChange((prev) => prev.map((l) => (l.lead_id === updated.lead_id ? updated : l)));
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
      onLeadsChange((prev) => prev.filter((l) => l.lead_id !== lead.lead_id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that lead.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-ink-soft">
          Prospects who reached out off-platform, before there&apos;s a real booking.
        </p>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ New lead"}</Button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <Card className="mt-4 p-5">
          <form onSubmit={submitLead} className="grid gap-3">
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Field
                label="Email (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
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
        <p className="mt-6 text-ink-soft">No leads yet — log one when someone reaches out off-platform.</p>
      ) : (
        <div className="mt-5 grid gap-2.5">
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
                  <LinkButton href={`/contracts/new?lead=${lead.lead_id}`} variant="ghost" size="md">
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
