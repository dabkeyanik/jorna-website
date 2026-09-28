// The contract builder's working copy: what the vendor is writing, in form
// terms (dollars as strings, blank allowed), plus the pure conversions to
// and from what the backend stores (backend 0065, its DECISIONS.md #16).
//
// Kept apart from the page so the arithmetic — totals, schedule presets, the
// "does the schedule add up" check — is unit-tested rather than trusted to a
// click-through. The backend re-checks all of it; this is so the vendor sees
// the problem while typing instead of after pressing Send.

import type {
  Clause,
  Contract,
  ContractCreateInput,
  DueType,
  InstallmentInput,
  LineItemInput,
  LineItemKind,
  LineUnit,
  ServiceItem,
  VendorBooking,
  VendorDetail,
} from "./types";

export interface LineDraft {
  key: string;
  kind: LineItemKind;
  serviceId: string | null;
  addonId: string | null;
  name: string;
  unit: LineUnit;
  /** Dollars, as typed. */
  price: string;
  quantity: string;
}

export interface InstallmentDraft {
  key: string;
  label: string;
  /** Dollars, as typed. */
  amount: string;
  dueType: DueType;
  dueDate: string;
  dueDays: string;
}

export interface ClauseDraft {
  key: string;
  title: string;
  body: string;
}

export interface Draft {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  dateIso: string;
  multiDay: boolean;
  dateEnd: string;
  timeStart: string;
  timeEnd: string;
  location: string;
  guestCount: string;
  lines: LineDraft[];
  /** Dollars, as typed. */
  discount: string;
  schedule: InstallmentDraft[];
  clauses: ClauseDraft[];
  /** Days, as typed — the backend keeps hours. */
  cancellationDays: string;
  /** Dollars per hour, as typed. */
  overtimeRate: string;
  holdDays: string;
}

let seq = 0;
/** A React key for a row the vendor added — never sent to the backend. */
export function newKey(): string {
  seq += 1;
  return `k${Date.now().toString(36)}${seq}`;
}

export function emptyDraft(): Draft {
  return {
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    dateIso: "",
    multiDay: false,
    dateEnd: "",
    timeStart: "",
    timeEnd: "",
    location: "",
    guestCount: "",
    lines: [],
    discount: "",
    schedule: [],
    clauses: [],
    cancellationDays: "",
    overtimeRate: "",
    holdDays: "",
  };
}

export function toCents(dollars: string): number {
  const n = Number(dollars);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function toDollars(cents: number): string {
  return (Math.round(cents) / 100).toString();
}

export function money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Items ────────────────────────────────────────────────────────────

/** A package's add-on and package units map onto a line's; a package's
 *  "performer" unit is counted like an item. */
function lineUnit(unit: string | null | undefined): LineUnit {
  return unit === "person" || unit === "hour" || unit === "day" ? unit : unit === "event" || !unit ? "event" : "item";
}

export function packageLine(service: ServiceItem): LineDraft {
  return {
    key: newKey(),
    kind: "package",
    serviceId: service.service_id,
    addonId: null,
    name: service.name,
    unit: lineUnit(service.price_unit),
    price: service.price.toString(),
    quantity: "1",
  };
}

export function addonLine(service: ServiceItem, addonId: string): LineDraft | null {
  const addon = service.add_ons?.find((a) => a.id === addonId);
  if (!addon) return null;
  return {
    key: newKey(),
    kind: "addon",
    serviceId: service.service_id,
    addonId,
    name: addon.name,
    unit: lineUnit(addon.price_unit),
    price: addon.price.toString(),
    quantity: "1",
  };
}

export function customLine(): LineDraft {
  return {
    key: newKey(),
    kind: "custom",
    serviceId: null,
    addonId: null,
    name: "",
    unit: "item",
    price: "",
    quantity: "1",
  };
}

export function lineTotalCents(line: LineDraft): number {
  const qty = Number(line.quantity);
  return Number.isFinite(qty) && qty > 0 ? Math.round(toCents(line.price) * qty) : 0;
}

export function subtotalCents(draft: Draft): number {
  return draft.lines.reduce((sum, l) => sum + lineTotalCents(l), 0);
}

export function totalCents(draft: Draft): number {
  return subtotalCents(draft) - toCents(draft.discount);
}

/** Whether the draft has a package — the backend needs one. */
export function hasPackage(draft: Draft): boolean {
  return draft.lines.some((l) => l.kind === "package");
}

// ── Schedule ─────────────────────────────────────────────────────────

export type SchedulePreset = "full" | "deposit_balance" | "three";

/**
 * A starting schedule for the current total. Amounts are split in cents and
 * the rounding remainder lands on the last payment, so the preset always
 * adds up exactly — the one thing the backend is strict about.
 */
export function presetSchedule(preset: SchedulePreset, total: number, depositPercent = 50): InstallmentDraft[] {
  const row = (label: string, cents: number, dueType: DueType, dueDays = ""): InstallmentDraft => ({
    key: newKey(),
    label,
    amount: toDollars(cents),
    dueType,
    dueDate: "",
    dueDays,
  });
  if (preset === "full") return [row("Payment in full", total, "on_signing")];
  if (preset === "deposit_balance") {
    const deposit = Math.round((total * depositPercent) / 100);
    return [
      row("Deposit", deposit, "on_signing"),
      row("Final balance", total - deposit, "before_event", "14"),
    ];
  }
  const first = Math.round(total / 3);
  return [
    row("Deposit", first, "on_signing"),
    row("Second payment", first, "before_event", "60"),
    row("Final balance", total - 2 * first, "before_event", "14"),
  ];
}

export function scheduledCents(draft: Draft): number {
  return draft.schedule.reduce((sum, i) => sum + toCents(i.amount), 0);
}

/** Put whatever the schedule is short (or over) by on its last payment. */
export function balanceLastPayment(draft: Draft): InstallmentDraft[] {
  if (draft.schedule.length === 0) return draft.schedule;
  const gap = totalCents(draft) - scheduledCents(draft);
  return draft.schedule.map((i, idx) =>
    idx === draft.schedule.length - 1 ? { ...i, amount: toDollars(toCents(i.amount) + gap) } : i,
  );
}

// ── Terms ────────────────────────────────────────────────────────────

/** The vendor's saved equipment/travel defaults, as clauses. */
export function defaultClauses(vendor: VendorDetail | null): ClauseDraft[] {
  const terms = vendor?.default_contract_terms;
  const out: ClauseDraft[] = [];
  if (terms?.equipment_power) out.push({ key: "equipment_power", title: "Equipment & power", body: terms.equipment_power });
  if (terms?.travel) out.push({ key: "travel", title: "Travel", body: terms.travel });
  for (const c of terms?.custom ?? []) {
    if (c.label && c.value) out.push({ key: newKey(), title: c.label, body: c.value });
  }
  return out;
}

// ── What goes to the backend ─────────────────────────────────────────

export type Step = "client" | "event" | "items" | "payments" | "terms" | "review";

/** Everything wrong with the draft that would stop it being sent, tagged
 *  with the step that fixes it, in the order the steps come in. */
export function problemsByStep(draft: Draft, today: string): { step: Step; message: string }[] {
  const out: { step: Step; message: string }[] = [];
  const add = (step: Step, message: string) => {
    if (!out.some((p) => p.message === message)) out.push({ step, message });
  };
  if (!draft.dateIso) add("event", "Pick the event date.");
  else if (draft.dateIso < today) add("event", "The event date is in the past.");
  if (draft.multiDay && draft.dateEnd && draft.dateEnd < draft.dateIso) add("event", "The end date is before the start date.");
  if (!draft.timeStart || !draft.timeEnd) add("event", "Add a start and end time.");
  if (!hasPackage(draft)) add("items", "Add at least one of your packages.");
  for (const l of draft.lines) {
    if (!l.name.trim()) add("items", "Every line needs a name.");
    if (!(Number(l.quantity) > 0)) add("items", `“${l.name || "A line"}” needs a quantity above zero.`);
  }
  const total = totalCents(draft);
  if (draft.lines.length && total <= 0) add("items", "The total after the discount must be more than $0.");
  if (draft.schedule.length === 0) add("payments", "Add at least one payment to the schedule.");
  else if (scheduledCents(draft) !== total) {
    add("payments", `The payments add up to ${money(scheduledCents(draft))}, but the total is ${money(total)}.`);
  }
  for (const i of draft.schedule) {
    if (!i.label.trim()) add("payments", "Every payment needs a name.");
    if (!(toCents(i.amount) > 0)) add("payments", `“${i.label || "A payment"}” needs an amount above $0.`);
    if (i.dueType === "date" && !i.dueDate) add("payments", `“${i.label || "A payment"}” needs a due date.`);
    if (i.dueType === "before_event" && (i.dueDays === "" || !(Number(i.dueDays) >= 0))) {
      add("payments", `“${i.label || "A payment"}” needs how many days before the event it's due.`);
    }
  }
  for (const c of draft.clauses) {
    if (!c.title.trim() || !c.body.trim()) add("terms", "Every clause needs a title and some text.");
  }
  return out;
}

export function problems(draft: Draft, today: string): string[] {
  return problemsByStep(draft, today).map((p) => p.message);
}

/** "Due when signed", "Due Jun 1, 2030", "Due 14 days before the event". */
export function describeDue(i: {
  due_type: DueType;
  due_date?: string | null;
  due_days?: number | null;
  due_on?: string | null;
}): string {
  const pretty = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  if (i.due_type === "on_signing") return i.due_on ? `Due ${pretty(i.due_on)} (on signing)` : "Due when signed";
  if (i.due_type === "date") return i.due_date ? `Due ${pretty(i.due_date)}` : "Due on a date";
  const days = i.due_days ?? 0;
  const rule = days === 0 ? "on the event day" : `${days} day${days === 1 ? "" : "s"} before the event`;
  return i.due_on ? `Due ${pretty(i.due_on)} (${rule})` : `Due ${rule}`;
}

/** The document half of a create/update — shared by both, so an edit sends
 *  exactly what a create would. */
export function toDocument(draft: Draft) {
  const lines: LineItemInput[] = draft.lines.map((l) => ({
    kind: l.kind,
    service_id: l.serviceId,
    addon_id: l.addonId,
    name: l.name.trim(),
    unit: l.unit,
    unit_price_cents: toCents(l.price),
    quantity: Number(l.quantity),
  }));
  const schedule: InstallmentInput[] = draft.schedule.map((i) => ({
    label: i.label.trim(),
    amount_cents: toCents(i.amount),
    due_type: i.dueType,
    due_date: i.dueType === "date" ? i.dueDate : null,
    due_days: i.dueType === "before_event" ? Number(i.dueDays) : null,
  }));
  const clauses: Clause[] = draft.clauses.map((c) => ({ key: c.key, title: c.title.trim(), body: c.body.trim() }));
  return {
    guest_name: draft.clientName.trim() || null,
    guest_email: draft.clientEmail.trim() || null,
    guest_phone: draft.clientPhone.trim() || null,
    location: draft.location.trim() || null,
    guest_count: Number(draft.guestCount) > 0 ? Number(draft.guestCount) : null,
    date_iso: draft.dateIso,
    date_end: draft.multiDay && draft.dateEnd ? draft.dateEnd : null,
    time_start: draft.timeStart,
    time_end: draft.timeEnd,
    line_items: lines,
    discount_cents: toCents(draft.discount) || 0,
    payment_schedule: schedule,
    terms_clauses: clauses,
    cancellation_window_hours: draft.cancellationDays ? Number(draft.cancellationDays) * 24 : null,
    overtime_rate_cents: draft.overtimeRate ? toCents(draft.overtimeRate) : null,
  } satisfies ContractCreateInput;
}

/** An existing contract back into the builder, for editing. A contract made
 *  before schedules has no payment_schedule — its single deposit becomes a
 *  two-payment schedule the vendor can adjust. */
export function fromContract(c: Contract): Draft {
  const lines: LineDraft[] = (c.line_items ?? []).map((l) => ({
    key: newKey(),
    kind: l.kind,
    serviceId: l.service_id,
    addonId: l.addon_id,
    name: l.name,
    unit: l.unit,
    price: toDollars(l.unit_price_cents),
    quantity: String(l.quantity),
  }));
  const schedule: InstallmentDraft[] = c.payment_schedule?.length
    ? c.payment_schedule.map((i) => ({
        key: newKey(),
        label: i.label,
        amount: toDollars(i.amount_cents),
        dueType: i.due_type,
        dueDate: i.due_date ?? "",
        dueDays: i.due_days != null ? String(i.due_days) : "",
      }))
    : presetSchedule(
        c.deposit_percent ? "deposit_balance" : "full",
        c.amount_cents,
        c.deposit_percent ?? 50,
      );
  const legacy: ClauseDraft[] = [];
  if (c.contract_terms?.equipment_power) legacy.push({ key: "equipment_power", title: "Equipment & power", body: c.contract_terms.equipment_power });
  if (c.contract_terms?.travel) legacy.push({ key: "travel", title: "Travel", body: c.contract_terms.travel });
  return {
    clientName: c.guest_name ?? "",
    clientEmail: c.guest_email ?? "",
    clientPhone: c.guest_phone ?? "",
    dateIso: c.date_iso,
    multiDay: Boolean(c.date_end && c.date_end !== c.date_iso),
    dateEnd: c.date_end ?? "",
    timeStart: c.time_start,
    timeEnd: c.time_end,
    location: c.location === "TBD" ? "" : c.location,
    guestCount: c.guest_count ? String(c.guest_count) : "",
    lines,
    discount: c.discount_cents ? toDollars(c.discount_cents) : "",
    schedule,
    clauses: c.terms_clauses?.length
      ? c.terms_clauses.map((t) => ({ key: t.key, title: t.title, body: t.body }))
      : legacy,
    cancellationDays: c.cancellation_window_hours != null ? String(Math.round(c.cancellation_window_hours / 24)) : "",
    overtimeRate: c.overtime_rate_cents != null ? toDollars(c.overtime_rate_cents) : "",
    holdDays: "",
  };
}

/**
 * A signed-in client's request, as the start of the proposal that accepts
 * it. When and where are the client's — the builder shows them but doesn't
 * send them. The package line carries the request's total when it's known;
 * a per-guest or per-hour one whose count isn't known yet starts at the
 * rate with the quantity blank, for the vendor to fill in.
 */
export function fromRequest(b: VendorBooking): Draft {
  const pending = Boolean(b.price_pending_quantity);
  return {
    ...emptyDraft(),
    clientName: b.client_name ?? "",
    dateIso: b.date_iso ?? "",
    dateEnd: b.date_end ?? "",
    multiDay: Boolean(b.date_end && b.date_end !== b.date_iso),
    timeStart: b.time_start ?? "",
    timeEnd: b.time_end ?? "",
    location: b.location === "TBD" ? "" : (b.location ?? ""),
    guestCount: b.guest_count ? String(b.guest_count) : "",
    lines: b.service_id
      ? [
          {
            key: newKey(),
            kind: "package",
            serviceId: b.service_id,
            addonId: null,
            name: b.service_name ?? "Package",
            unit: pending ? lineUnit(b.price_unit) : "event",
            price: String(b.price),
            quantity: pending ? (b.guest_count ? String(b.guest_count) : "") : "1",
          },
        ]
      : [],
  };
}

// ── Templates ────────────────────────────────────────────────────────

/**
 * What a template keeps: the reusable part of a contract — no client, no
 * date. The schedule is kept as shares of the total rather than dollars,
 * so a template made on a $2,000 contract fits a $5,000 one.
 */
export interface TemplateBody {
  version: 1;
  lines?: Omit<LineDraft, "key">[];
  discount?: string;
  schedule?: { label: string; percent: number; dueType: DueType; dueDays: string }[];
  clauses?: Omit<ClauseDraft, "key">[];
  cancellationDays?: string;
  overtimeRate?: string;
  holdDays?: string;
}

function withoutKey<T extends { key: string }>(row: T): Omit<T, "key"> {
  const copy: Partial<T> = { ...row };
  delete copy.key;
  return copy as Omit<T, "key">;
}

export function toTemplate(draft: Draft): TemplateBody {
  const total = totalCents(draft);
  return {
    version: 1,
    lines: draft.lines.map(withoutKey),
    discount: draft.discount,
    schedule:
      total > 0
        ? draft.schedule.map((i) => ({
            label: i.label,
            percent: (toCents(i.amount) / total) * 100,
            // A fixed date means nothing on the next contract.
            dueType: i.dueType === "date" ? "before_event" : i.dueType,
            dueDays: i.dueType === "date" ? "14" : i.dueDays,
          }))
        : [],
    clauses: draft.clauses.map(withoutKey),
    cancellationDays: draft.cancellationDays,
    overtimeRate: draft.overtimeRate,
    holdDays: draft.holdDays,
  };
}

/** Lay a template over the draft: it replaces what it has, and leaves the
 *  client and the date alone. Lines whose package is gone are dropped. */
export function applyTemplate(draft: Draft, body: TemplateBody, services: ServiceItem[]): Draft {
  const live = new Set(services.map((s) => s.service_id));
  const next: Draft = { ...draft };
  if (body.lines?.length) {
    next.lines = body.lines
      .filter((l) => l.kind === "custom" || (l.serviceId && live.has(l.serviceId)))
      .map((l) => ({ ...l, key: newKey() }));
  }
  if (body.discount != null) next.discount = body.discount;
  if (body.clauses?.length) next.clauses = body.clauses.map((c) => ({ ...c, key: newKey() }));
  if (body.cancellationDays != null) next.cancellationDays = body.cancellationDays;
  if (body.overtimeRate != null) next.overtimeRate = body.overtimeRate;
  if (body.holdDays != null) next.holdDays = body.holdDays;
  if (body.schedule?.length) {
    const total = totalCents(next);
    const rows = body.schedule.map((s) => ({
      key: newKey(),
      label: s.label,
      amount: toDollars(Math.round((total * s.percent) / 100)),
      dueType: s.dueType,
      dueDate: "",
      dueDays: s.dueDays,
    }));
    next.schedule = rows;
    next.schedule = balanceLastPayment(next);
  }
  return next;
}
