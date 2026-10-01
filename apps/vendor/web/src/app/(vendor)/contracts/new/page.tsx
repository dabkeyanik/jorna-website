"use client";

// The contract builder: a vendor writes the whole proposal — who, when,
// what's included, how it's paid, on what terms — then sends it or keeps it
// as a draft. The client gets a link with no account behind it
// (/booking-link; backend DECISIONS.md #13), reads it and signs.
//
// One step at a time (Client → Event → Items → Payments → Terms → Review)
// because a proposal with several packages, add-ons and a payment plan was
// too much for one form. The arithmetic lives in lib/contractDraft, where
// it's unit-tested; this page is the steps around it.
//
// ?lead=<id> starts from a lead and converts it on send. ?edit=<booking_id>
// reopens an unsigned contract; saving bumps its revision, so a client who
// had the old one open has to review the new one before signing.
// ?request=<booking_id> accepts a signed-in client's marketplace request
// with this proposal (backend DECISIONS #17): when and where are the
// client's, so those steps only show them.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@jorna/shared/lib/api";
import {
  convertLead,
  createContract,
  getContract,
  getMyVendor,
  listLeads,
  listMyServices,
  listVendorBookings,
  proposeFromRequest,
  updateContract,
} from "@/lib/jorna";
import {
  addonLine,
  applyTemplate,
  balanceLastPayment,
  customLine,
  defaultClauses,
  describeDue,
  describeWhen,
  emptyDraft,
  fromContract,
  fromRequest,
  lineTotalCents,
  money,
  newKey,
  packageLine,
  presetSchedule,
  problemsByStep,
  scheduledCents,
  subtotalCents,
  toCents,
  toDocument,
  toTemplate,
  totalCents,
  type ClauseDraft,
  type Draft,
  type InstallmentDraft,
  type LineDraft,
  type SchedulePreset,
  type Step,
} from "@/lib/contractDraft";
import { loadTemplates, saveTemplate, templateBody } from "@/lib/contractTemplates";
import { guestBookingLink } from "@/lib/contractLink";
import {
  priceUnitLabel,
  type Contract,
  type DueType,
  type SavedContractTemplate,
  type ServiceItem,
  type VendorBooking,
  type VendorDetail,
} from "@/lib/types";
import { Button, Card, Field, LinkButton } from "@jorna/shared/components/ui";

// Today as YYYY-MM-DD in the vendor's own timezone — the backend allows a
// day of slack for UTC, but the form shouldn't offer yesterday at all.
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STEPS: { id: Step; label: string }[] = [
  { id: "client", label: "Client" },
  { id: "event", label: "Event" },
  { id: "items", label: "Items" },
  { id: "payments", label: "Payments" },
  { id: "terms", label: "Terms" },
  { id: "review", label: "Review & send" },
];

const UNIT_WORD: Record<string, string> = {
  event: "each",
  person: "per guest",
  hour: "per hour",
  day: "per day",
  item: "each",
};

// Suggested clauses a vendor can drop in with one tap. Only a start — the
// text is theirs to edit, and the backend stores whatever they send.
const CLAUSE_IDEAS: Omit<ClauseDraft, "key">[] = [
  { title: "Cancellation", body: "The deposit is non-refundable. Cancelling within 30 days of the event forfeits payments made to date." },
  { title: "Equipment & power", body: "We bring all our own equipment. The venue provides standard power within 50 feet." },
  { title: "Travel", body: "Travel within 30 miles is included; beyond that is billed at $0.75 per mile." },
  { title: "Meals", body: "A hot meal and a place to eat for each member of our team on site for more than five hours." },
  { title: "Changes", body: "Date or scope changes are subject to availability and may change the price." },
];

const textareaClass =
  "w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";
const selectClass =
  "w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold";

function NewContractInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const leadId = params.get("lead");
  const editId = params.get("edit");
  const requestId = params.get("request");
  // A gallery card on /contracts opens the builder on one of the vendor's
  // saved templates.
  const templateId = params.get("template");

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [templates, setTemplates] = useState<SavedContractTemplate[]>([]);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [request, setRequest] = useState<VendorBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState<Step>("client");
  const [emailClient, setEmailClient] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);

  const [busy, setBusy] = useState<"send" | "draft" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Contract | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/contracts/new&role=vendor");
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
        setVendor(mine);
        const [svc, leads, tpl, existing, requests] = await Promise.all([
          listMyServices(mine.vendor_id).catch(() => null),
          leadId ? listLeads().catch(() => null) : Promise.resolve(null),
          loadTemplates().catch(() => [] as SavedContractTemplate[]),
          editId ? getContract(editId) : Promise.resolve(null),
          requestId ? listVendorBookings(mine.vendor_id, { limit: 100 }) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        // Private (hidden) packages are exactly what contracts are for;
        // archived ones are retired and the backend refuses them.
        if (svc) setServices(svc.items.filter((x) => x.status !== "archived"));
        setTemplates(tpl);

        if (existing) {
          setEditing(existing);
          setDraft(fromContract(existing));
          setStep("items");
          return;
        }
        const asked = requests?.items.find((b) => b.booking_id === requestId) ?? null;
        if (requestId) {
          if (!asked || !["pending", "negotiation_ongoing"].includes(asked.status) || asked.contract_token) {
            setLoadError("This request can't be accepted from here any more — it may already be answered.");
            return;
          }
          setRequest(asked);
          setStep("items");
        }
        const start = asked ? fromRequest(asked) : emptyDraft();
        start.clauses = defaultClauses(mine).map((c) => ({ ...c, key: newKey() }));
        if (mine.default_cancellation_window_hours != null) {
          start.cancellationDays = String(Math.round(mine.default_cancellation_window_hours / 24));
        }
        if (mine.default_overtime_rate_cents != null) {
          start.overtimeRate = String(mine.default_overtime_rate_cents / 100);
        }
        const lead = leads?.items.find((l) => l.lead_id === leadId);
        if (lead) {
          start.clientName = lead.name;
          start.clientEmail = lead.email ?? "";
          start.clientPhone = lead.phone ?? "";
          if (lead.event_date_iso && lead.event_date_iso >= todayIso()) start.dateIso = lead.event_date_iso;
        }
        const picked = templateId ? tpl.find((t) => t.template_id === templateId) : undefined;
        if (picked) {
          const usable = (svc?.items ?? []).filter((x) => x.status !== "archived");
          setDraft(applyTemplate(start, templateBody(picked), usable));
          setTemplateNotice(`Loaded “${picked.name}”. Check the items and payments before sending.`);
        } else {
          setDraft(start);
        }
      })
      .catch((err) =>
        !cancelled &&
        setLoadError(err instanceof ApiError ? err.message : "Couldn't load your listing."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, router, leadId, editId, requestId, templateId]);

  const issues = useMemo(() => problemsByStep(draft, todayIso()), [draft]);
  const issuesFor = (s: Step) => issues.filter((i) => i.step === s).map((i) => i.message);
  const total = totalCents(draft);
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const locked = Boolean(editing && (editing.signed_at || editing.status === "rejected"));

  // ── Items ──

  function addPackage(serviceId: string) {
    const svc = services.find((s) => s.service_id === serviceId);
    if (!svc) return;
    const patch: Partial<Draft> = { lines: [...draft.lines, packageLine(svc)] };
    // A package's own terms (backend 0063) beat the vendor-wide defaults the
    // form started from. Only the ones the package sets; the rest stay put.
    if (svc.cancellation_window_hours != null) {
      patch.cancellationDays = String(Math.round(svc.cancellation_window_hours / 24));
    }
    if (svc.overtime_rate_cents != null) patch.overtimeRate = String(svc.overtime_rate_cents / 100);
    set(patch);
  }

  function addAddon(svc: ServiceItem, addonId: string) {
    const line = addonLine(svc, addonId);
    if (line) set({ lines: [...draft.lines, line] });
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    set({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  }

  // ── Payments ──

  /** The deposit a preset starts from: the first package's own, else the
   *  vendor's default, else half. */
  function defaultDepositPercent(): number {
    const first = services.find((s) => s.service_id === draft.lines.find((l) => l.kind === "package")?.serviceId);
    return first?.deposit_percent ?? vendor?.default_deposit_percent ?? 50;
  }

  function applyPreset(preset: SchedulePreset) {
    set({ schedule: presetSchedule(preset, total, defaultDepositPercent()) });
  }

  function updateInstallment(key: string, patch: Partial<InstallmentDraft>) {
    set({ schedule: draft.schedule.map((i) => (i.key === key ? { ...i, ...patch } : i)) });
  }

  function goTo(next: Step) {
    // Arriving at Payments with nothing planned yet: start from the vendor's
    // usual deposit rather than an empty list.
    if (next === "payments" && draft.schedule.length === 0 && total > 0) {
      const pct = defaultDepositPercent();
      set({ schedule: presetSchedule(pct > 0 && pct < 100 ? "deposit_balance" : "full", total, pct) });
    }
    setError(null);
    setStep(next);
  }

  // ── Templates ──

  function pickTemplate(id: string) {
    const t = templates.find((x) => x.template_id === id);
    if (!t) return;
    setDraft((d) => applyTemplate(d, templateBody(t), services));
    setTemplateNotice(`Loaded “${t.name}”. Check the items and payments before sending.`);
  }

  async function saveAsTemplate() {
    if (!templateName.trim()) return;
    try {
      const t = await saveTemplate(templateName.trim(), toTemplate(draft));
      setTemplates((prev) => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)));
      setTemplateName("");
      setTemplateNotice(`Saved “${t.name}” to your templates.`);
    } catch (err) {
      setTemplateNotice(err instanceof ApiError ? err.message : "Couldn't save the template.");
    }
  }

  // ── Send / save ──

  async function submit(mode: "send" | "draft" | "save") {
    if (mode !== "draft" && issues.length) {
      setError(issues[0].message);
      setStep(issues[0].step);
      return;
    }
    setBusy(mode);
    setError(null);
    try {
      const doc = toDocument(draft);
      if (mode === "save" && editing) {
        await updateContract(editing.booking_id, doc);
        router.push(`/contracts/view?id=${editing.booking_id}`);
        return;
      }
      if (request) {
        setCreated(
          await proposeFromRequest(request.booking_id, {
            line_items: doc.line_items,
            discount_cents: doc.discount_cents,
            payment_schedule: doc.payment_schedule,
            terms_clauses: doc.terms_clauses,
            cancellation_window_hours: doc.cancellation_window_hours,
            overtime_rate_cents: doc.overtime_rate_cents,
            hold_days: Number(draft.holdDays) > 0 ? Number(draft.holdDays) : null,
            email_client: emailClient,
          }),
        );
        return;
      }
      const input = {
        ...doc,
        draft: mode === "draft",
        hold_days: Number(draft.holdDays) > 0 ? Number(draft.holdDays) : null,
        email_client: mode === "send" && emailClient && Boolean(doc.guest_email),
      };
      setCreated(leadId ? await convertLead(leadId, input) : await createContract(input));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the contract.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(guestBookingLink(created.contract_token));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* clipboard can be denied — the link is still visible to select by hand */
    }
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  if (loadError || !vendor) {
    return (
      <div className="py-20 text-center">
        <p role="alert" className="text-ink-soft">{loadError ?? "Couldn't load your listing."}</p>
      </div>
    );
  }

  if (locked && editing) {
    return (
      <div className="mx-auto w-[min(560px,100%-2rem)] py-20 text-center">
        <h1 className="serif text-3xl text-maroon dark:text-gold">This contract can&apos;t be edited</h1>
        <p className="mt-3 text-ink-soft">
          {editing.signed_at
            ? "It's signed — a signed agreement doesn't change."
            : "It was voided or declined."}
        </p>
        <LinkButton href={`/contracts/view?id=${editing.booking_id}`} className="mt-6">
          Back to the contract
        </LinkButton>
      </div>
    );
  }

  if (created) {
    const link = guestBookingLink(created.contract_token);
    const isDraft = created.contract_status === "draft";
    const emailed = !isDraft && emailClient && created.guest_email;
    return (
      <div className="mx-auto w-[min(640px,100%-2rem)]">
        <div className="text-center">
          <p className="eyebrow">{isDraft ? "Draft saved" : "Contract sent"}</p>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">
            {isDraft ? "Saved as a draft" : emailed ? "On its way" : "Send this link"}
          </h1>
          <p className="mt-3 text-ink-soft">
            {isDraft
              ? "It isn't holding your date and the link won't open until you send it from Contracts."
              : emailed
                ? `We emailed the link to ${created.guest_email}. You can share it yourself too.`
                : "Your client opens it, fills in their own details, and signs — no account needed on their end."}
          </p>
          {!isDraft && created.hold_expires_at ? (
            <p className="mt-2 text-sm text-ink-faint">
              Your date is held for them until{" "}
              {new Date(created.hold_expires_at).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              . If they haven&apos;t signed by then, it opens up again — you can resend from
              Contracts.
            </p>
          ) : null}
        </div>
        {!isDraft ? (
          <Card className="mt-8 p-5">
            <p className="break-all rounded-lg bg-ground-2 px-3 py-2.5 font-mono text-sm text-ink">
              {link}
            </p>
            <Button className="mt-3 w-full" onClick={copyLink}>
              {linkCopied ? "Copied!" : "Copy link"}
            </Button>
          </Card>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <LinkButton href={`/contracts/view?id=${created.booking_id}`} variant="ghost">
            View contract
          </LinkButton>
          <LinkButton href="/contracts" variant="ghost">
            All contracts
          </LinkButton>
        </div>
      </div>
    );
  }

  const stepIssues = issuesFor(step);
  const packagesInDraft = services.filter((s) =>
    draft.lines.some((l) => l.kind === "package" && l.serviceId === s.service_id),
  );

  return (
    <div className="mx-auto w-[min(720px,100%-2rem)]">
      <header>
        <Link
          href={editing ? `/contracts/view?id=${editing.booking_id}` : request ? "/my-bookings" : "/contracts"}
          className="eyebrow hover:text-gold"
        >
          ← {editing ? "Back to the contract" : request ? "Back to requests" : "All contracts"}
        </Link>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">
          {editing ? "Edit contract" : request ? `Accept ${request.client_name ? `${request.client_name}'s` : "this"} request` : "New contract"}
        </h1>
        <p className="mt-3 text-ink-soft">
          {request
            ? "Set what's included, the payment plan and your terms. They sign on a link we email them — the date is held for them until then."
            : editing
            ? editing.contract_status === "draft"
              ? "It's still a draft — nothing has gone to your client."
              : "Your client will see the new version. If they had it open, they'll need to review it again before signing."
            : "You set what's included, the price and how it's paid. Your client fills in their details and signs when you send it."}
        </p>
      </header>

      {!editing && templates.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <label htmlFor="template" className="text-sm text-ink-soft">
            Start from a template
          </label>
          <select
            id="template"
            defaultValue=""
            onChange={(e) => pickTemplate(e.target.value)}
            className="rounded-lg border border-card-edge bg-ground-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
          >
            <option value="" disabled>
              Choose…
            </option>
            {templates.map((t) => (
              <option key={t.template_id} value={t.template_id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {templateNotice ? <p className="mt-2 text-sm text-ink-soft">{templateNotice}</p> : null}

      <nav aria-label="Steps" className="mt-6 flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => {
          const hasIssue = issuesFor(s.id).length > 0 && i < stepIndex;
          return (
            <button
              key={s.id}
              type="button"
              aria-current={s.id === step ? "step" : undefined}
              onClick={() => goTo(s.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                s.id === step
                  ? "border-maroon bg-maroon text-ground dark:border-gold dark:bg-gold"
                  : hasIssue
                    ? "border-maroon/40 text-maroon dark:text-gold"
                    : "border-card-edge text-ink-soft hover:text-ink"
              }`}
            >
              {i + 1}. {s.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 grid gap-5">
        {request && (step === "client" || step === "event") ? (
          <Card className="grid gap-1 p-5 text-sm text-ink-soft">
            <p className="eyebrow">From their request</p>
            <p className="mt-1 text-base text-ink">{request.client_name || "Your client"}</p>
            <p>{describeWhen(request.date_iso, request.date_end, request.time_start, request.time_end)}</p>
            <p>{request.location}</p>
            {request.guest_count ? <p>{request.guest_count} guests</p> : null}
            {request.client_note ? <p className="mt-2 italic">“{request.client_note}”</p> : null}
            <p className="mt-3 text-xs text-ink-faint">
              These are theirs to change — they can ask for a new date from their plan.
            </p>
          </Card>
        ) : null}

        {step === "client" && !request ? (
          <Card className="grid gap-3 p-5 sm:grid-cols-2">
            <p className="text-sm text-ink-soft sm:col-span-2">
              Optional — your client can fill these in or correct them on the link. A name is what
              tells one contract from the next in your list.
            </p>
            <div className="sm:col-span-2">
              <Field
                label="Name"
                placeholder="Who this booking is for"
                value={draft.clientName}
                onChange={(e) => set({ clientName: e.target.value })}
              />
            </div>
            <Field
              label="Email (optional)"
              type="email"
              value={draft.clientEmail}
              onChange={(e) => set({ clientEmail: e.target.value })}
              hint="Add it and we can email them the link."
            />
            <Field
              label="Phone (optional)"
              type="tel"
              value={draft.clientPhone}
              onChange={(e) => set({ clientPhone: e.target.value })}
            />
          </Card>
        ) : null}

        {step === "event" && !request ? (
          <Card className="grid gap-3 p-5 sm:grid-cols-2">
            <Field
              label={draft.multiDay ? "Start date" : "Date"}
              type="date"
              min={todayIso()}
              value={draft.dateIso}
              onChange={(e) => set({ dateIso: e.target.value })}
            />
            {draft.multiDay ? (
              <Field
                label="End date"
                type="date"
                min={draft.dateIso || todayIso()}
                value={draft.dateEnd}
                onChange={(e) => set({ dateEnd: e.target.value })}
              />
            ) : (
              <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink-soft">
                <input type="checkbox" checked={draft.multiDay} onChange={(e) => set({ multiDay: e.target.checked })} />
                Runs over more than one day
              </label>
            )}
            <Field
              label="Start time"
              type="time"
              value={draft.timeStart}
              onChange={(e) => set({ timeStart: e.target.value })}
            />
            <Field
              label="End time"
              type="time"
              value={draft.timeEnd}
              onChange={(e) => set({ timeEnd: e.target.value })}
            />
            {draft.timeStart && draft.timeEnd && draft.timeEnd <= draft.timeStart ? (
              <p className="text-xs text-ink-faint sm:col-span-2">
                Ends the next morning — that&apos;s fine for a late night.
              </p>
            ) : null}
            <Field
              label="Venue (optional)"
              placeholder="Leave blank if your client will add it"
              value={draft.location}
              onChange={(e) => set({ location: e.target.value })}
            />
            <Field
              label="Guest count (optional)"
              type="number"
              min={1}
              value={draft.guestCount}
              onChange={(e) => set({ guestCount: e.target.value })}
            />
          </Card>
        ) : null}

        {step === "items" ? (
          <Card className="p-5">
            {services.length === 0 ? (
              <p className="text-sm text-ink-faint">
                You don&apos;t have any packages listed yet — add one on your listing first.
              </p>
            ) : null}

            <div className="grid gap-3">
              {draft.lines.map((l) => (
                <div key={l.key} className="rounded-xl border border-card-edge p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-ink-faint">
                      {l.kind === "package" ? "Package" : l.kind === "addon" ? "Add-on" : "Custom"}
                    </p>
                    <button
                      type="button"
                      aria-label={`Remove ${l.name || "line"}`}
                      onClick={() => set({ lines: draft.lines.filter((x) => x.key !== l.key) })}
                      className="text-sm text-ink-faint hover:text-maroon"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_7rem_8rem]">
                    <Field
                      label="Item"
                      value={l.name}
                      onChange={(e) => updateLine(l.key, { name: e.target.value })}
                      placeholder="e.g. Uplighting"
                    />
                    <Field
                      label="Qty"
                      type="number"
                      min={0}
                      step="any"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                    />
                    <Field
                      label={`Price ($ ${UNIT_WORD[l.unit]})`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={l.price}
                      onChange={(e) => updateLine(l.key, { price: e.target.value })}
                    />
                  </div>
                  <p className="mt-2 text-right text-sm text-ink">{money(lineTotalCents(l))}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3">
              {services.length > 0 ? (
                <select
                  aria-label="Add a package"
                  value=""
                  onChange={(e) => addPackage(e.target.value)}
                  className={selectClass}
                >
                  <option value="" disabled>
                    + Add a package
                  </option>
                  {services.map((s) => (
                    <option key={s.service_id} value={s.service_id}>
                      {s.name} — ${s.price}
                      {s.price_unit && s.price_unit !== "event" ? ` ${priceUnitLabel(s.price_unit)}` : ""}
                      {s.status === "hidden" ? " (private)" : ""}
                    </option>
                  ))}
                </select>
              ) : null}
              {packagesInDraft
                .filter((s) => s.add_ons?.length)
                .map((s) => (
                  <div key={s.service_id}>
                    <p className="text-xs text-ink-faint">Add-ons for {s.name}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {s.add_ons!.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => a.id && addAddon(s, a.id)}
                          className="rounded-full border border-card-edge px-3 py-1 text-sm text-ink-soft hover:border-gold hover:text-ink"
                        >
                          + {a.name} (${a.price}
                          {a.price_unit !== "event" ? ` ${priceUnitLabel(a.price_unit)}` : ""})
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              <div>
                <Button type="button" variant="ghost" size="md" onClick={() => set({ lines: [...draft.lines, customLine()] })}>
                  + Add a custom item
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-1 border-t border-line-soft pt-4 text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>{money(subtotalCents(draft))}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-ink-soft">
                <label htmlFor="discount">Discount ($)</label>
                <input
                  id="discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.discount}
                  onChange={(e) => set({ discount: e.target.value })}
                  className="w-32 rounded-lg border border-card-edge bg-ground-2 px-2.5 py-1.5 text-right text-ink outline-none focus:border-gold"
                />
              </div>
              <div className="flex justify-between text-base font-semibold text-ink">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
          </Card>
        ) : null}

        {step === "payments" ? (
          <Card className="p-5">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["full", "Pay in full"],
                  ["deposit_balance", "Deposit + balance"],
                  ["three", "Three payments"],
                ] as const
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-full border border-card-edge px-3 py-1.5 text-sm text-ink-soft hover:border-gold hover:text-ink"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3">
              {draft.schedule.map((i, idx) => (
                <div key={i.key} className="rounded-xl border border-card-edge p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-ink-faint">Payment {idx + 1}</p>
                    {draft.schedule.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove ${i.label || "payment"}`}
                        onClick={() => set({ schedule: draft.schedule.filter((x) => x.key !== i.key) })}
                        className="text-sm text-ink-faint hover:text-maroon"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Name" value={i.label} onChange={(e) => updateInstallment(i.key, { label: e.target.value })} />
                    <Field
                      label="Amount ($)"
                      type="number"
                      min={0}
                      step="0.01"
                      value={i.amount}
                      onChange={(e) => updateInstallment(i.key, { amount: e.target.value })}
                    />
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-ink-soft">Due</span>
                      <select
                        value={i.dueType}
                        onChange={(e) => updateInstallment(i.key, { dueType: e.target.value as DueType })}
                        className={selectClass}
                      >
                        <option value="on_signing">When they sign</option>
                        <option value="date">On a date</option>
                        <option value="before_event">Days before the event</option>
                      </select>
                    </label>
                    {i.dueType === "date" ? (
                      <Field
                        label="Due date"
                        type="date"
                        value={i.dueDate}
                        onChange={(e) => updateInstallment(i.key, { dueDate: e.target.value })}
                      />
                    ) : i.dueType === "before_event" ? (
                      <Field
                        label="Days before the event"
                        type="number"
                        min={0}
                        value={i.dueDays}
                        onChange={(e) => updateInstallment(i.key, { dueDays: e.target.value })}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="mt-3"
              onClick={() =>
                set({
                  schedule: [
                    ...draft.schedule,
                    { key: newKey(), label: "", amount: "", dueType: "before_event", dueDate: "", dueDays: "30" },
                  ],
                })
              }
            >
              + Add a payment
            </Button>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-4 text-sm">
              <span className={scheduledCents(draft) === total ? "text-ink-soft" : "text-maroon dark:text-gold"}>
                Scheduled {money(scheduledCents(draft))} of {money(total)}
              </span>
              {scheduledCents(draft) !== total && draft.schedule.length ? (
                <Button type="button" variant="ghost" size="md" onClick={() => set({ schedule: balanceLastPayment(draft) })}>
                  Put the difference on the last payment
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        {step === "terms" ? (
          <Card className="grid gap-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Cancellation window (days)"
                type="number"
                min={0}
                placeholder="e.g. 30"
                value={draft.cancellationDays}
                onChange={(e) => set({ cancellationDays: e.target.value })}
              />
              <Field
                label="Overtime rate ($/hr)"
                type="number"
                min={0}
                step="0.01"
                value={draft.overtimeRate}
                onChange={(e) => set({ overtimeRate: e.target.value })}
              />
            </div>

            {draft.clauses.map((c, idx) => (
              <div key={c.key} className="rounded-xl border border-card-edge p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-ink-faint">Clause {idx + 1}</p>
                  <button
                    type="button"
                    aria-label={`Remove ${c.title || "clause"}`}
                    onClick={() => set({ clauses: draft.clauses.filter((x) => x.key !== c.key) })}
                    className="text-sm text-ink-faint hover:text-maroon"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 grid gap-2">
                  <Field
                    label="Title"
                    value={c.title}
                    onChange={(e) =>
                      set({ clauses: draft.clauses.map((x) => (x.key === c.key ? { ...x, title: e.target.value } : x)) })
                    }
                  />
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-ink-soft">Text</span>
                    <textarea
                      rows={3}
                      value={c.body}
                      onChange={(e) =>
                        set({ clauses: draft.clauses.map((x) => (x.key === c.key ? { ...x, body: e.target.value } : x)) })
                      }
                      className={textareaClass}
                    />
                  </label>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              {CLAUSE_IDEAS.filter((idea) => !draft.clauses.some((c) => c.title === idea.title)).map((idea) => (
                <button
                  key={idea.title}
                  type="button"
                  onClick={() => set({ clauses: [...draft.clauses, { ...idea, key: newKey() }] })}
                  className="rounded-full border border-card-edge px-3 py-1 text-sm text-ink-soft hover:border-gold hover:text-ink"
                >
                  + {idea.title}
                </button>
              ))}
              <button
                type="button"
                onClick={() => set({ clauses: [...draft.clauses, { key: newKey(), title: "", body: "" }] })}
                className="rounded-full border border-dashed border-card-edge px-3 py-1 text-sm text-ink-soft hover:text-ink"
              >
                + Blank clause
              </button>
            </div>
          </Card>
        ) : null}

        {step === "review" ? (
          <>
            <Card className="p-5">
              <p className="eyebrow">What your client will see</p>
              <h2 className="serif mt-2 text-xl text-ink">{draft.clientName || "Your client"}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {describeWhen(draft.dateIso, draft.multiDay ? draft.dateEnd : null, draft.timeStart, draft.timeEnd)}
                {draft.location ? ` · ${draft.location}` : ""}
              </p>
              <table className="mt-4 w-full text-sm">
                <tbody>
                  {draft.lines.map((l) => (
                    <tr key={l.key} className="border-t border-line-soft">
                      <td className="py-1.5 text-ink">
                        {l.name}
                        {Number(l.quantity) !== 1 ? ` × ${l.quantity}` : ""}
                      </td>
                      <td className="py-1.5 text-right text-ink">{money(lineTotalCents(l))}</td>
                    </tr>
                  ))}
                  {toCents(draft.discount) ? (
                    <tr className="border-t border-line-soft">
                      <td className="py-1.5 text-ink-soft">Discount</td>
                      <td className="py-1.5 text-right text-ink-soft">−{money(toCents(draft.discount))}</td>
                    </tr>
                  ) : null}
                  <tr className="border-t border-line-soft font-semibold">
                    <td className="py-1.5 text-ink">Total</td>
                    <td className="py-1.5 text-right text-ink">{money(total)}</td>
                  </tr>
                </tbody>
              </table>
              <ul className="mt-4 grid gap-1 text-sm text-ink-soft">
                {draft.schedule.map((i) => (
                  <li key={i.key}>
                    {i.label || "Payment"}: {money(toCents(i.amount))} —{" "}
                    {describeDue({
                      due_type: i.dueType,
                      due_date: i.dueDate || null,
                      due_days: i.dueDays === "" ? null : Number(i.dueDays),
                    })}
                  </li>
                ))}
              </ul>
              {draft.clauses.length ? (
                <div className="mt-4 grid gap-2 text-sm">
                  {draft.clauses.map((c) => (
                    <p key={c.key} className="text-ink-soft">
                      <strong className="text-ink">{c.title}.</strong> {c.body}
                    </p>
                  ))}
                </div>
              ) : null}
            </Card>

            {issues.length ? (
              <Card className="p-5">
                <p className="text-sm font-medium text-maroon dark:text-gold">Before you can send it</p>
                <ul className="mt-2 grid gap-1 text-sm text-ink-soft">
                  {issues.map((i) => (
                    <li key={i.message}>
                      <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => goTo(i.step)}>
                        {i.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {!editing ? (
              <Card className="grid gap-3 p-5">
                <Field
                  label="Hold the date for (days)"
                  type="number"
                  min={1}
                  max={60}
                  placeholder={String(vendor.contract_hold_days ?? 7)}
                  value={draft.holdDays}
                  onChange={(e) => set({ holdDays: e.target.value })}
                  hint="If they haven't signed by then, the date opens up again. You can resend."
                />
                {request ? (
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input type="checkbox" checked={emailClient} onChange={(e) => setEmailClient(e.target.checked)} />
                    Email the link to {request.client_name || "your client"}
                  </label>
                ) : draft.clientEmail.trim() ? (
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input type="checkbox" checked={emailClient} onChange={(e) => setEmailClient(e.target.checked)} />
                    Email the link to {draft.clientEmail.trim()}
                  </label>
                ) : (
                  <p className="text-sm text-ink-faint">
                    No client email — you&apos;ll get a link to share yourself.
                  </p>
                )}
              </Card>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Save as a template, e.g. Standard DJ package"
                className="min-w-0 flex-1 rounded-lg border border-card-edge bg-ground-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
              />
              <Button type="button" variant="ghost" size="md" onClick={saveAsTemplate} disabled={!templateName.trim()}>
                Save template
              </Button>
            </div>
          </>
        ) : null}

        {stepIssues.length && step !== "review" ? (
          <ul className="grid gap-1 text-sm text-ink-faint">
            {stepIssues.map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {stepIndex > 0 ? (
            <Button type="button" variant="ghost" onClick={() => goTo(STEPS[stepIndex - 1].id)}>
              ← Back
            </Button>
          ) : (
            <span />
          )}
          {step !== "review" ? (
            <Button type="button" onClick={() => goTo(STEPS[stepIndex + 1].id)}>
              Next: {STEPS[stepIndex + 1].label}
            </Button>
          ) : editing ? (
            <Button type="button" size="lg" disabled={busy !== null} onClick={() => submit("save")}>
              {busy === "save" ? "Saving…" : "Save changes"}
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {request ? null : (
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => submit("draft")}>
                  {busy === "draft" ? "Saving…" : "Save as draft"}
                </Button>
              )}
              <Button type="button" size="lg" disabled={busy !== null || issues.length > 0} onClick={() => submit("send")}>
                {busy === "send" ? "Sending…" : request ? "Accept & send contract" : "Send & hold date"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewContractPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <NewContractInner />
    </Suspense>
  );
}
