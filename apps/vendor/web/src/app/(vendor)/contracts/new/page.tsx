"use client";

// The contract editor: the agreement as the couple will read it — a title,
// the parties, the event, what's included, how it's paid, the vendor's own
// terms sections and the signatures — edited in place, in an order the
// vendor chooses (plan step 7b; backend 0067 stores the order). The right
// rail keeps the total and the ways out: send it, copy its link, or keep it
// as a draft. The client gets a link with no account behind it
// (/booking-link; backend DECISIONS.md #13), reads it and signs.
//
// The arithmetic lives in lib/contractDraft, where it's unit-tested; this
// page is the document around it.
//
// ?lead=<id> starts from a lead and converts it on send (or copy — either
// moves it to Negotiation). ?edit=<booking_id> reopens an unsigned contract;
// saving bumps its revision, so a client who had the old one open has to
// review the new one before signing. ?request=<booking_id> accepts a
// signed-in client's marketplace request with this proposal (backend
// DECISIONS #17): when and where are the client's, so those blocks only
// show them. ?template=<id> starts from a saved template.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@jorna/shared/lib/api";
import {
  convertLead,
  createContract,
  getContract,
  getContractProposals,
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
  describeWhen,
  emptyDraft,
  fromContract,
  fromRequest,
  insertClause,
  layoutOf,
  lineTotalCents,
  money,
  moveBlock,
  newKey,
  packageLine,
  presetSchedule,
  problemsByStep,
  scheduledCents,
  subtotalCents,
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
import { loadTemplates, saveTemplate, templateBody, templatesOfKind } from "@/lib/contractTemplates";
import { guestBookingLink } from "@/lib/contractLink";
import {
  categoryLabel,
  priceUnitLabel,
  type BlockType,
  type ChangeProposal,
  type Contract,
  type DueType,
  type LayoutBlock,
  type SavedContractTemplate,
  type ServiceItem,
  type VendorBooking,
  type VendorDetail,
} from "@/lib/types";
import { Button, Field, LinkButton } from "@jorna/shared/components/ui";

// Today as YYYY-MM-DD in the vendor's own timezone — the backend allows a
// day of slack for UTC, but the form shouldn't offer yesterday at all.
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const BLOCK_LABEL: Record<BlockType, string> = {
  parties: "Parties",
  event: "Event details",
  items: "Packages & items",
  schedule: "Payment schedule",
  terms: "Terms section",
  signature: "Signatures",
};

// Where each problem is fixed — the issue list scrolls there.
const STEP_BLOCK: Record<Step, BlockType> = {
  client: "parties",
  event: "event",
  items: "items",
  payments: "schedule",
  terms: "terms",
  review: "signature",
};

const UNIT_WORD: Record<string, string> = {
  event: "each",
  person: "per guest",
  hour: "per hour",
  day: "per day",
  item: "each",
};

// Suggested sections a vendor can drop in with one tap. Only a start — the
// text is theirs to edit, and the backend stores whatever they send.
const CLAUSE_IDEAS: Omit<ClauseDraft, "key">[] = [
  { title: "Cancellation", body: "The deposit is non-refundable. Cancelling within 30 days of the event forfeits payments made to date." },
  { title: "Equipment & power", body: "We bring all our own equipment. The venue provides standard power within 50 feet." },
  { title: "Travel", body: "Travel within 30 miles is included; beyond that is billed at $0.75 per mile." },
  { title: "Meals", body: "A hot meal and a place to eat for each member of our team on site for more than five hours." },
  { title: "Changes", body: "Date or scope changes are subject to availability and may change the price." },
];

const inputClass =
  "w-full rounded-lg border border-card-edge bg-ground-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";
const smallButton =
  "rounded-full border border-card-edge px-3 py-1 text-xs font-semibold text-ink-soft transition hover:border-gold hover:text-ink";

/**
 * The payment plan the vendor hasn't touched yet: their usual deposit (the
 * first package's own, else their default, else half) and the balance, on
 * the current total. It follows the total until they edit the plan — the old
 * step builder got the same effect by drafting it on arrival at Payments.
 */
function usualSchedule(draft: Draft, services: ServiceItem[], vendor: VendorDetail | null): InstallmentDraft[] {
  const total = totalCents(draft);
  if (total <= 0) return [];
  const first = services.find((s) => s.service_id === draft.lines.find((l) => l.kind === "package")?.serviceId);
  const pct = first?.deposit_percent ?? vendor?.default_deposit_percent ?? 50;
  return presetSchedule(pct > 0 && pct < 100 ? "deposit_balance" : "full", total, pct);
}

function scrollToBlock(id: string) {
  document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** One block of the document, with its label and the controls that move it. */
function Block({
  block,
  index,
  count,
  issue,
  onMove,
  onAddBelow,
  onRemove,
  children,
}: {
  block: LayoutBlock;
  index: number;
  count: number;
  issue: boolean;
  onMove: (delta: -1 | 1) => void;
  onAddBelow: () => void;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  const label = BLOCK_LABEL[block.type];
  return (
    <section
      id={`block-${block.id}`}
      aria-label={label}
      className={`group relative scroll-mt-24 border-t border-line-soft py-6 first:border-t-0 ${issue ? "rounded-lg ring-1 ring-maroon/30 dark:ring-gold/40" : ""}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-faint">{label}</p>
        <span className="flex items-center gap-1 opacity-100 transition sm:opacity-40 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button
            type="button"
            aria-label={`Move ${label.toLowerCase()} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="rounded px-1.5 py-0.5 text-xs text-ink-faint hover:text-ink disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move ${label.toLowerCase()} down`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            className="rounded px-1.5 py-0.5 text-xs text-ink-faint hover:text-ink disabled:opacity-30"
          >
            ↓
          </button>
          <button type="button" onClick={onAddBelow} className="rounded px-1.5 py-0.5 text-xs text-ink-faint hover:text-ink">
            + Section below
          </button>
          {onRemove ? (
            <button type="button" onClick={onRemove} className="rounded px-1.5 py-0.5 text-xs text-ink-faint hover:text-maroon">
              Remove
            </button>
          ) : null}
        </span>
      </div>
      {children}
    </section>
  );
}

function NewContractInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const leadId = params.get("lead");
  const editId = params.get("edit");
  // Revise (backend DECISIONS #23): the client's proposed changes, already
  // in, as the start of the vendor's next version.
  const proposalId = params.get("proposal");
  const requestId = params.get("request");
  // A gallery card on /contracts opens the editor on a saved template.
  const templateId = params.get("template");

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [templates, setTemplates] = useState<SavedContractTemplate[]>([]);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [revising, setRevising] = useState<ChangeProposal | null>(null);
  /** ?proposal= named one that's no longer open. */
  const [staleProposal, setStaleProposal] = useState(false);
  const [request, setRequest] = useState<VendorBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [emailClient, setEmailClient] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);

  const [busy, setBusy] = useState<"send" | "copy" | "draft" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Contract | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Whether the payment plan is still the one drafted for the vendor — see
  // usualSchedule. Any edit to the plan itself makes it theirs.
  const [autoPlan, setAutoPlan] = useState(true);

  const set = (patch: Partial<Draft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      if ("schedule" in patch) return next;
      if (autoPlan && ("lines" in patch || "discount" in patch)) next.schedule = usualSchedule(next, services, vendor);
      return next;
    });

  /** An edit to the plan itself. */
  const setPlan = (schedule: InstallmentDraft[]) => {
    setAutoPlan(false);
    set({ schedule });
  };

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
        const [svc, leads, tpl, existing, requests, proposals] = await Promise.all([
          listMyServices(mine.vendor_id).catch(() => null),
          leadId ? listLeads().catch(() => null) : Promise.resolve(null),
          loadTemplates().catch(() => [] as SavedContractTemplate[]),
          editId ? getContract(editId) : Promise.resolve(null),
          requestId ? listVendorBookings(mine.vendor_id, { limit: 100 }) : Promise.resolve(null),
          editId && proposalId ? getContractProposals(editId).catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        // Private (hidden) packages are exactly what contracts are for;
        // archived ones are retired and the backend refuses them.
        const usable = (svc?.items ?? []).filter((x) => x.status !== "archived");
        setServices(usable);
        const agreements = templatesOfKind(tpl, "agreement");
        setTemplates(agreements);

        if (existing) {
          setEditing(existing);
          const open = proposals?.open_proposal?.proposal_id === proposalId ? proposals?.open_proposal : null;
          if (open) {
            setRevising(open);
            setDraft(fromContract({ ...existing, ...open.proposed }));
          } else {
            setDraft(fromContract(existing));
            if (proposalId) setStaleProposal(true);
          }
          setAutoPlan(false);
          return;
        }
        const asked = requests?.items.find((b) => b.booking_id === requestId) ?? null;
        if (requestId) {
          if (!asked || !["pending", "negotiation_ongoing"].includes(asked.status) || asked.contract_token) {
            setLoadError("This request can't be accepted from here any more — it may already be answered.");
            return;
          }
          setRequest(asked);
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
        const picked = templateId ? agreements.find((t) => t.template_id === templateId) : undefined;
        if (picked) {
          const applied = applyTemplate(start, templateBody(picked), usable);
          if (applied.schedule.length) setAutoPlan(false);
          else applied.schedule = usualSchedule(applied, usable, mine);
          setDraft(applied);
          setTemplateNotice(`Loaded “${picked.name}”. Check the items and payments before sending.`);
        } else {
          // A request arrives with its package already in.
          start.schedule = usualSchedule(start, usable, mine);
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
  }, [user, router, leadId, editId, proposalId, requestId, templateId]);

  const issues = useMemo(() => problemsByStep(draft, todayIso()), [draft]);
  const total = totalCents(draft);
  const layout = layoutOf(draft);
  const locked = Boolean(editing && (editing.signed_at || editing.status === "rejected"));
  const firstPackage = draft.lines.find((l) => l.kind === "package")?.name;
  const defaultTitle = `${firstPackage || (vendor?.category ? categoryLabel(vendor.subcategory || vendor.category) : "Services")} agreement`;
  const vendorName = [vendor?.f_name, vendor?.l_name].filter(Boolean).join(" ") || "Your business";

  const blockHasIssue = (b: LayoutBlock) =>
    issues.some((i) =>
      STEP_BLOCK[i.step] === b.type &&
      (b.type !== "terms" || draft.clauses.some((c) => c.key === b.id && (!c.title.trim() || !c.body.trim()))),
    );

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
    setPlan(presetSchedule(preset, total, defaultDepositPercent()));
  }

  function updateInstallment(key: string, patch: Partial<InstallmentDraft>) {
    setPlan(draft.schedule.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  // ── Terms ──

  function updateClause(key: string, patch: Partial<ClauseDraft>) {
    set({ clauses: draft.clauses.map((c) => (c.key === key ? { ...c, ...patch } : c)) });
  }

  function addSection(idea: Omit<ClauseDraft, "key"> = { title: "", body: "" }, at?: number) {
    setDraft((d) => ({ ...d, ...insertClause(d, idea, at) }));
  }

  // ── Templates ──

  function pickTemplate(id: string) {
    const t = templates.find((x) => x.template_id === id);
    if (!t) return;
    const body = templateBody(t);
    if (body.schedule?.length) setAutoPlan(false);
    setDraft((d) => {
      const applied = applyTemplate(d, body, services);
      return autoPlan && !body.schedule?.length ? { ...applied, schedule: usualSchedule(applied, services, vendor) } : applied;
    });
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

  // ── Send / copy / save ──

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(guestBookingLink(token));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* clipboard can be denied — the link is shown to select by hand */
    }
  }

  async function submit(mode: "send" | "copy" | "draft" | "save") {
    if (mode !== "draft" && issues.length) {
      setError(issues[0].message);
      scrollToBlock(layout.find((b) => b.type === STEP_BLOCK[issues[0].step])?.id ?? "parties");
      return;
    }
    setBusy(mode);
    setError(null);
    // Copying the link sends it too, just without the email — the hold
    // starts and a lead moves to Negotiation either way (DECISIONS #20).
    const email = mode === "send" && emailClient;
    try {
      const doc = toDocument(draft);
      if (mode === "save" && editing) {
        await updateContract(editing.booking_id, revising ? { ...doc, proposal_id: revising.proposal_id } : doc);
        router.push(`/contracts/view?id=${editing.booking_id}`);
        return;
      }
      let result: Contract;
      if (request) {
        result = await proposeFromRequest(request.booking_id, {
          line_items: doc.line_items,
          discount_cents: doc.discount_cents,
          payment_schedule: doc.payment_schedule,
          terms_clauses: doc.terms_clauses,
          document_title: doc.document_title,
          document_layout: doc.document_layout,
          cancellation_window_hours: doc.cancellation_window_hours,
          overtime_rate_cents: doc.overtime_rate_cents,
          hold_days: Number(draft.holdDays) > 0 ? Number(draft.holdDays) : null,
          email_client: email,
        });
      } else {
        const input = {
          ...doc,
          draft: mode === "draft",
          hold_days: Number(draft.holdDays) > 0 ? Number(draft.holdDays) : null,
          email_client: email && Boolean(doc.guest_email),
        };
        result = leadId ? await convertLead(leadId, input) : await createContract(input);
      }
      setCreated(result);
      if (mode === "copy") await copy(result.contract_token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the contract.");
    } finally {
      setBusy(null);
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
            ? "It's signed — a signed agreement doesn't change. Add an addendum to it instead."
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
    // Only what the backend says actually happened (email_sent), never what
    // the vendor asked for.
    const emailed = !isDraft && !linkCopied && created.email_sent === true;
    const emailFailed = !isDraft && !linkCopied && created.email_sent === false;
    return (
      <div className="mx-auto w-[min(640px,100%-2rem)]">
        <div className="text-center">
          <p className="eyebrow">{isDraft ? "Draft saved" : "Contract sent"}</p>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">
            {isDraft ? "Saved as a draft" : linkCopied ? "Link copied" : emailed ? "On its way" : "Send this link"}
          </h1>
          <p className="mt-3 text-ink-soft">
            {isDraft
              ? "It isn't holding your date and the link won't open until you send it from Contracts."
              : linkCopied
                ? "Paste it wherever you talk to your client. They fill in their own details and sign — no account needed."
                : emailed
                  ? `We emailed the link to ${created.guest_email}. You can share it yourself too.`
                  : emailFailed
                    ? `We couldn't email ${created.guest_email ?? "your client"}. Copy the link below and send it yourself — your client fills in their details and signs, no account needed.`
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
          <div className="mt-8 rounded-2xl border border-card-edge bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="break-all rounded-lg bg-ground-2 px-3 py-2.5 font-mono text-sm text-ink">{link}</p>
            <Button className="mt-3 w-full" onClick={() => copy(created.contract_token)}>
              {linkCopied ? "Copied!" : "Copy link"}
            </Button>
          </div>
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

  const packagesInDraft = services.filter((s) =>
    draft.lines.some((l) => l.kind === "package" && l.serviceId === s.service_id),
  );
  const scheduled = scheduledCents(draft);

  function renderBlock(b: LayoutBlock) {
    switch (b.type) {
      case "parties":
        return (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs text-ink-faint">Provider</p>
              <p className="serif mt-1 text-lg text-ink">{vendorName}</p>
              {vendor?.category ? <p className="text-sm text-ink-soft">{categoryLabel(vendor.subcategory || vendor.category)}</p> : null}
            </div>
            <div>
              <p className="text-xs text-ink-faint">Client</p>
              {request ? (
                <>
                  <p className="serif mt-1 text-lg text-ink">{request.client_name || "Your client"}</p>
                  <p className="text-xs text-ink-faint">From their Jorna account.</p>
                </>
              ) : (
                <div className="mt-1 grid gap-2">
                  <input
                    aria-label="Client name"
                    placeholder="Who this booking is for"
                    value={draft.clientName}
                    onChange={(e) => set({ clientName: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    aria-label="Client email"
                    type="email"
                    placeholder="Email (optional — we can send the link)"
                    value={draft.clientEmail}
                    onChange={(e) => set({ clientEmail: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    aria-label="Client phone"
                    type="tel"
                    placeholder="Phone (optional)"
                    value={draft.clientPhone}
                    onChange={(e) => set({ clientPhone: e.target.value })}
                    className={inputClass}
                  />
                  <p className="text-xs text-ink-faint">They can fill in or correct these on the link.</p>
                </div>
              )}
            </div>
          </div>
        );

      case "event":
        return request ? (
          <div className="grid gap-1 text-sm text-ink-soft">
            <p className="text-ink">{describeWhen(request.date_iso, request.date_end, request.time_start, request.time_end)}</p>
            <p>{request.location}</p>
            {request.guest_count ? <p>{request.guest_count} guests</p> : null}
            {request.client_note ? <p className="mt-2 italic">“{request.client_note}”</p> : null}
            <p className="mt-2 text-xs text-ink-faint">
              From their request — theirs to change; they can ask for a new date from their plan.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
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
            <Field label="Start time" type="time" value={draft.timeStart} onChange={(e) => set({ timeStart: e.target.value })} />
            <Field label="End time" type="time" value={draft.timeEnd} onChange={(e) => set({ timeEnd: e.target.value })} />
            {draft.timeStart && draft.timeEnd && draft.timeEnd <= draft.timeStart ? (
              <p className="text-xs text-ink-faint sm:col-span-2">Ends the next morning — that&apos;s fine for a late night.</p>
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
          </div>
        );

      case "items":
        return (
          <div>
            {services.length === 0 ? (
              <p className="text-sm text-ink-faint">You don&apos;t have any packages listed yet — add one on your listing first.</p>
            ) : null}
            {draft.lines.length ? (
              <div className="grid gap-2">
                <div
                  aria-hidden="true"
                  className="hidden grid-cols-[minmax(0,1fr)_5rem_7.5rem_6.5rem_3.5rem] gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-ink-faint sm:grid"
                >
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>
                {draft.lines.map((l) => (
                  <div
                    key={l.key}
                    className="grid grid-cols-2 items-center gap-2 rounded-lg border border-line-soft p-2 sm:grid-cols-[minmax(0,1fr)_5rem_7.5rem_6.5rem_3.5rem] sm:border-0 sm:p-0"
                  >
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <input
                        aria-label="Item"
                        value={l.name}
                        onChange={(e) => updateLine(l.key, { name: e.target.value })}
                        placeholder="e.g. Uplighting"
                        className={inputClass}
                      />
                      <p className="mt-0.5 text-[0.68rem] text-ink-faint">
                        {l.kind === "package" ? "Package" : l.kind === "addon" ? "Add-on" : "Custom"} · {UNIT_WORD[l.unit]}
                      </p>
                    </div>
                    <input
                      aria-label="Qty"
                      type="number"
                      min={0}
                      step="any"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      aria-label={`Price ($ ${UNIT_WORD[l.unit]})`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={l.price}
                      onChange={(e) => updateLine(l.key, { price: e.target.value })}
                      className={inputClass}
                    />
                    <span className="text-right text-sm text-ink">{money(lineTotalCents(l))}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${l.name || "line"}`}
                      onClick={() => set({ lines: draft.lines.filter((x) => x.key !== l.key) })}
                      className="justify-self-end text-xs text-ink-faint hover:text-maroon"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              {services.length > 0 ? (
                <select
                  aria-label="Add a package"
                  value=""
                  onChange={(e) => addPackage(e.target.value)}
                  className={inputClass}
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
                        <button key={a.id} type="button" onClick={() => a.id && addAddon(s, a.id)} className={smallButton}>
                          + {a.name} (${a.price}
                          {a.price_unit !== "event" ? ` ${priceUnitLabel(a.price_unit)}` : ""})
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              <div>
                <button type="button" onClick={() => set({ lines: [...draft.lines, customLine()] })} className={smallButton}>
                  + Add a custom item
                </button>
              </div>
            </div>

            <div className="mt-5 ml-auto grid max-w-xs gap-1 border-t border-line-soft pt-3 text-sm">
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
                  className="w-28 rounded-lg border border-card-edge bg-ground-2 px-2.5 py-1.5 text-right text-ink outline-none focus:border-gold"
                />
              </div>
              <div className="flex justify-between text-base font-semibold text-ink">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
          </div>
        );

      case "schedule":
        return (
          <div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["full", "Pay in full"],
                  ["deposit_balance", "Deposit + balance"],
                  ["three", "Three payments"],
                ] as const
              ).map(([preset, label]) => (
                <button key={preset} type="button" onClick={() => applyPreset(preset)} className={smallButton}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              {draft.schedule.map((i, idx) => (
                <div
                  key={i.key}
                  className="grid grid-cols-2 items-end gap-2 rounded-lg border border-line-soft p-2.5 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_7.5rem_3.5rem]"
                >
                  <label className="col-span-2 block min-w-0 sm:col-span-1">
                    <span className="mb-1 block text-[0.68rem] text-ink-faint">Payment {idx + 1}</span>
                    <input aria-label="Name" value={i.label} onChange={(e) => updateInstallment(i.key, { label: e.target.value })} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[0.68rem] text-ink-faint">Amount ($)</span>
                    <input
                      aria-label="Amount ($)"
                      type="number"
                      min={0}
                      step="0.01"
                      value={i.amount}
                      onChange={(e) => updateInstallment(i.key, { amount: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[0.68rem] text-ink-faint">Due</span>
                    <select
                      aria-label="Due"
                      value={i.dueType}
                      onChange={(e) => updateInstallment(i.key, { dueType: e.target.value as DueType })}
                      className={inputClass}
                    >
                      <option value="on_signing">When they sign</option>
                      <option value="date">On a date</option>
                      <option value="before_event">Days before the event</option>
                    </select>
                  </label>
                  {i.dueType === "date" ? (
                    <label className="block">
                      <span className="mb-1 block text-[0.68rem] text-ink-faint">Due date</span>
                      <input
                        aria-label="Due date"
                        type="date"
                        value={i.dueDate}
                        onChange={(e) => updateInstallment(i.key, { dueDate: e.target.value })}
                        className={inputClass}
                      />
                    </label>
                  ) : i.dueType === "before_event" ? (
                    <label className="block">
                      <span className="mb-1 block text-[0.68rem] text-ink-faint">Days before</span>
                      <input
                        aria-label="Days before the event"
                        type="number"
                        min={0}
                        value={i.dueDays}
                        onChange={(e) => updateInstallment(i.key, { dueDays: e.target.value })}
                        className={inputClass}
                      />
                    </label>
                  ) : (
                    <span />
                  )}
                  {draft.schedule.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove ${i.label || "payment"}`}
                      onClick={() => setPlan(draft.schedule.filter((x) => x.key !== i.key))}
                      className="justify-self-end pb-2 text-xs text-ink-faint hover:text-maroon"
                    >
                      Remove
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <button
                type="button"
                className={smallButton}
                onClick={() =>
                  setPlan([
                    ...draft.schedule,
                    { key: newKey(), label: "", amount: "", dueType: "before_event", dueDate: "", dueDays: "30" },
                  ])
                }
              >
                + Add a payment
              </button>
              <span className={scheduled === total ? "text-ink-soft" : "text-maroon dark:text-gold"}>
                Scheduled {money(scheduled)} of {money(total)}
                {scheduled !== total && draft.schedule.length ? (
                  <button
                    type="button"
                    onClick={() => setPlan(balanceLastPayment(draft))}
                    className="ml-2 font-semibold text-gold underline-offset-4 hover:underline"
                  >
                    Put the difference on the last payment
                  </button>
                ) : null}
              </span>
            </div>
          </div>
        );

      case "terms": {
        const c = draft.clauses.find((x) => x.key === b.id);
        if (!c) return null;
        return (
          <div className="grid gap-2">
            <input
              aria-label="Title"
              value={c.title}
              placeholder="Section title"
              onChange={(e) => updateClause(c.key, { title: e.target.value })}
              className="serif w-full border-0 border-b border-transparent bg-transparent px-0 py-1 text-lg text-ink outline-none placeholder:text-ink-faint focus:border-gold"
            />
            <textarea
              aria-label="Section text"
              rows={Math.min(12, Math.max(3, Math.ceil(c.body.length / 80) + c.body.split("\n").length))}
              value={c.body}
              placeholder="What you're agreeing to, in plain words. Blank lines start a new paragraph."
              onChange={(e) => updateClause(c.key, { body: e.target.value })}
              className="w-full resize-y rounded-lg border border-transparent bg-transparent px-0 py-1 text-[0.95rem] leading-relaxed text-ink-soft outline-none transition placeholder:text-ink-faint hover:border-line-soft focus:border-gold focus:bg-ground-2 focus:px-3"
            />
          </div>
        );
      }

      case "signature":
        return (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="h-10 border-b border-ink/30" />
              <p className="mt-1 text-sm text-ink">{request?.client_name || draft.clientName || "Client"}</p>
              <p className="text-xs text-ink-faint">Types their name on the link to sign</p>
            </div>
            <div>
              <div className="serif flex h-10 items-end border-b border-ink/30 text-lg italic text-ink-soft">{vendorName}</div>
              <p className="mt-1 text-sm text-ink">{vendorName}</p>
              <p className="text-xs text-ink-faint">Sending it is your agreement to these terms</p>
            </div>
          </div>
        );
    }
  }

  const sendLabel = request ? "Accept & send contract" : "Send & hold date";
  const canEmail = request ? true : Boolean(draft.clientEmail.trim());

  return (
    <div>
      <header className="mb-6">
        <Link
          href={editing ? `/contracts/view?id=${editing.booking_id}` : request ? "/my-bookings" : "/contracts"}
          className="eyebrow hover:text-gold"
        >
          ← {editing ? "Back to the contract" : request ? "Back to requests" : "All contracts"}
        </Link>
        <h1 className="serif mt-2 text-3xl text-maroon dark:text-gold">
          {revising ? "Revise the contract" : editing ? "Edit contract" : request ? `Accept ${request.client_name ? `${request.client_name}'s` : "this"} request` : "New contract"}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {revising
            ? `${editing?.guest_name || "Your client"}'s proposed changes are already in. Keep what you like, change the rest — saving sends this version to them and restarts your hold.`
            : request
            ? "Set what's included, the payment plan and your terms. They sign on a link we email them — the date is held for them until then."
            : editing
              ? editing.contract_status === "draft"
                ? "It's still a draft — nothing has gone to your client."
                : "Your client will see the new version. If they had it open, they'll need to review it again before signing."
              : "Write it the way your client will read it. Move sections around with the arrows."}
        </p>
        {staleProposal ? (
          <p role="status" className="mt-3 rounded-lg bg-panel px-3 py-2 text-sm text-ink-soft">
            That proposal has already been answered, so this is the contract as it stands.
          </p>
        ) : null}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <article
          aria-label="Contract document"
          className="min-w-0 rounded-2xl border border-card-edge bg-card px-5 py-6 shadow-[var(--shadow-card)] sm:px-10 sm:py-10"
        >
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-gold">{vendorName}</p>
          <input
            aria-label="Agreement title"
            value={draft.title}
            placeholder={defaultTitle}
            onChange={(e) => set({ title: e.target.value })}
            maxLength={200}
            className="serif mt-2 w-full border-0 border-b border-transparent bg-transparent px-0 py-1 text-2xl sm:text-3xl text-ink outline-none placeholder:text-ink focus:border-gold"
          />
          <p className="mt-1 text-sm text-ink-faint">
            {describeWhen(draft.dateIso, draft.multiDay ? draft.dateEnd : null, draft.timeStart, draft.timeEnd)}
            {draft.location ? ` · ${draft.location}` : ""}
          </p>

          <div className="mt-6">
            {layout.map((b, idx) => (
              <Block
                key={b.id}
                block={b}
                index={idx}
                count={layout.length}
                issue={blockHasIssue(b)}
                onMove={(delta) => set({ layout: moveBlock(draft, b.id, delta) })}
                onAddBelow={() => addSection(undefined, idx + 1)}
                onRemove={
                  b.type === "terms"
                    ? () => set({ clauses: draft.clauses.filter((x) => x.key !== b.id) })
                    : undefined
                }
              >
                {renderBlock(b)}
              </Block>
            ))}
          </div>

          <div className="mt-2 border-t border-dashed border-line pt-4">
            <p className="text-xs text-ink-faint">Add a terms section</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CLAUSE_IDEAS.filter((idea) => !draft.clauses.some((c) => c.title === idea.title)).map((idea) => (
                <button key={idea.title} type="button" onClick={() => addSection(idea)} className={smallButton}>
                  + {idea.title}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addSection()}
                className="rounded-full border border-dashed border-card-edge px-3 py-1 text-xs font-semibold text-ink-soft hover:text-ink"
              >
                + Blank section
              </button>
            </div>
          </div>
        </article>

        <aside aria-label="Send" className="grid gap-4 lg:sticky lg:top-6">
          <div className="rounded-2xl border border-card-edge bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-faint">Contract total</p>
            <p className="serif mt-1 text-3xl text-ink" data-testid="rail-total">
              {money(total)}
            </p>
            <p className={`mt-1 text-xs ${scheduled === total ? "text-ink-faint" : "text-maroon dark:text-gold"}`}>
              {draft.schedule.length
                ? `${draft.schedule.length} payment${draft.schedule.length === 1 ? "" : "s"} · ${money(scheduled)} scheduled`
                : "No payments scheduled yet"}
            </p>

            {issues.length ? (
              <div className="mt-4 rounded-lg bg-panel p-3">
                <p className="text-xs font-semibold text-maroon dark:text-gold">Before you can send it</p>
                <ul className="mt-1.5 grid gap-1 text-xs text-ink-soft">
                  {issues.map((i) => (
                    <li key={i.message}>
                      <button
                        type="button"
                        className="text-left underline-offset-4 hover:underline"
                        onClick={() => scrollToBlock(layout.find((b) => b.type === STEP_BLOCK[i.step])?.id ?? "parties")}
                      >
                        {i.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="mt-3 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
                {error}
              </p>
            ) : null}

            {editing ? (
              <Button className="mt-4 w-full" disabled={busy !== null} onClick={() => submit("save")}>
                {busy === "save" ? "Saving…" : revising ? "Send new version" : "Save changes"}
              </Button>
            ) : (
              <div className="mt-4 grid gap-2">
                {canEmail ? (
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input type="checkbox" checked={emailClient} onChange={(e) => setEmailClient(e.target.checked)} />
                    <span className="min-w-0 truncate">
                      Email it to {request ? request.client_name || "your client" : draft.clientEmail.trim()}
                    </span>
                  </label>
                ) : (
                  <p className="text-xs text-ink-faint">No client email — copy the link and send it yourself.</p>
                )}
                <Button disabled={busy !== null || issues.length > 0} onClick={() => submit("send")}>
                  {busy === "send" ? "Sending…" : sendLabel}
                </Button>
                <Button variant="ghost" disabled={busy !== null || issues.length > 0} onClick={() => submit("copy")}>
                  {busy === "copy" ? "Creating link…" : "Copy link"}
                </Button>
                {request ? null : (
                  <Button variant="quiet" disabled={busy !== null} onClick={() => submit("draft")}>
                    {busy === "draft" ? "Saving…" : "Save as draft"}
                  </Button>
                )}
                <p className="text-xs text-ink-faint">Sending or copying the link holds your date for them.</p>
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-2xl border border-card-edge bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-faint">Policies</p>
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
            {!editing ? (
              <Field
                label="Hold the date for (days)"
                type="number"
                min={1}
                max={60}
                placeholder={String(vendor.contract_hold_days ?? 7)}
                value={draft.holdDays}
                onChange={(e) => set({ holdDays: e.target.value })}
                hint="If they haven't signed by then, the date opens up again."
              />
            ) : null}
          </div>

          <div className="grid gap-2 rounded-2xl border border-card-edge bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-faint">Templates</p>
            {!editing && templates.length > 0 ? (
              <label className="grid gap-1 text-sm text-ink-soft">
                <span>Start from a template</span>
                <select
                  defaultValue=""
                  onChange={(e) => pickTemplate(e.target.value)}
                  className={inputClass}
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
              </label>
            ) : null}
            <div className="flex gap-2">
              <input
                aria-label="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Standard DJ package"
                className={`${inputClass} min-w-0 flex-1`}
              />
              <Button type="button" variant="ghost" size="md" onClick={saveAsTemplate} disabled={!templateName.trim()}>
                Save template
              </Button>
            </div>
            {templateNotice ? <p className="text-xs text-ink-soft">{templateNotice}</p> : null}
          </div>
        </aside>
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
