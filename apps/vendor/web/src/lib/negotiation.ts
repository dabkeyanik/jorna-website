// The negotiation workspace's model (backend DECISIONS #23, #24): a contract
// read as a list of negotiable values — the date, each line's quantity and
// price, each payment, the policies, each clause's text — so three versions
// can be laid side by side the way the design shows them: the original
// agreement, what the other side proposed, and your own revised value.
//
// Everything works on the builder's Draft (lib/contractDraft), so what's sent
// goes through the same conversions and checks as the editor and the
// proposal form. Lines and payments are matched across versions by their
// saved id (contractDraft keeps ids across edits), clauses by key.

import {
  balanceLastPayment,
  customLine,
  draftTerms,
  insertClause,
  money,
  newKey,
  proposalChanges,
  reconcileLayout,
  scheduledCents,
  toCents,
  totalCents,
  type ClauseDraft,
  type Draft,
  type LineDraft,
} from "./contractDraft";
import type { TermsVersion } from "./types";

export type ValueKind = "text" | "date" | "time" | "count" | "money" | "days" | "longtext";

export type ValueSection = "Event" | "What's included" | "Payment schedule" | "Policies" | "Terms";

export const SECTIONS: ValueSection[] = ["Event", "What's included", "Payment schedule", "Policies", "Terms"];

export interface NegotiableValue {
  /** Stable across versions: "event.date", "line:<id>.qty", "pay:<id>.amount", "clause:<key>". */
  id: string;
  section: ValueSection;
  label: string;
  kind: ValueKind;
  /** The value as typed in this version; "" when the version doesn't have it. */
  get: (d: Draft) => string;
  set: (d: Draft, raw: string) => Draft;
  /** For a line's, payment's or clause's value: whether a version has that row at all. */
  has?: (d: Draft) => boolean;
}

// ── Reading values ───────────────────────────────────────────────────

export const lineId = (l: LineDraft) => l.id ?? l.key;
const payId = (i: Draft["schedule"][number]) => i.id ?? i.key;

function scalar(
  id: string,
  section: ValueSection,
  label: string,
  kind: ValueKind,
  key: "dateIso" | "dateEnd" | "timeStart" | "timeEnd" | "location" | "guestCount" | "discount" | "cancellationDays" | "overtimeRate",
): NegotiableValue {
  return {
    id,
    section,
    label,
    kind,
    get: (d) => (key === "dateEnd" && !d.multiDay ? "" : d[key]),
    set: (d, raw) => (key === "dateEnd" ? { ...d, dateEnd: raw, multiDay: Boolean(raw) } : { ...d, [key]: raw }),
  };
}

function lineValue(l: LineDraft, field: "name" | "quantity" | "price"): NegotiableValue {
  const id = lineId(l);
  const find = (d: Draft) => d.lines.find((x) => lineId(x) === id);
  const label = { name: "Item", quantity: "Quantity", price: "Price each" }[field];
  return {
    id: `line:${id}.${field}`,
    section: "What's included",
    label: field === "name" ? label : `${l.name || "New item"} · ${label.toLowerCase()}`,
    kind: field === "name" ? "text" : field === "quantity" ? "count" : "money",
    get: (d) => find(d)?.[field] ?? "",
    set: (d, raw) => ({ ...d, lines: d.lines.map((x) => (lineId(x) === id ? { ...x, [field]: raw } : x)) }),
    has: (d) => Boolean(find(d)),
  };
}

function paymentValue(i: Draft["schedule"][number], field: "amount" | "dueDays" | "dueDate"): NegotiableValue {
  const id = payId(i);
  const label = { amount: "Amount", dueDays: "Days before the event", dueDate: "Due on" }[field];
  return {
    id: `pay:${id}.${field}`,
    section: "Payment schedule",
    label: `${i.label} · ${label.toLowerCase()}`,
    kind: field === "amount" ? "money" : field === "dueDays" ? "days" : "date",
    get: (d) => d.schedule.find((x) => payId(x) === id)?.[field] ?? "",
    has: (d) => d.schedule.some((x) => payId(x) === id),
    set: (d, raw) => ({ ...d, schedule: d.schedule.map((x) => (payId(x) === id ? { ...x, [field]: raw } : x)) }),
  };
}

function clauseValue(c: ClauseDraft): NegotiableValue {
  return {
    id: `clause:${c.key}`,
    section: "Terms",
    label: c.title || "Untitled clause",
    kind: "longtext",
    get: (d) => d.clauses.find((x) => x.key === c.key)?.body ?? "",
    has: (d) => d.clauses.some((x) => x.key === c.key),
    set: (d, raw) => ({ ...d, clauses: d.clauses.map((x) => (x.key === c.key ? { ...x, body: raw } : x)) }),
  };
}

/** Every negotiable value in one version, in document order. */
export function valuesOf(d: Draft): NegotiableValue[] {
  const out: NegotiableValue[] = [
    scalar("event.date", "Event", "Date", "date", "dateIso"),
    scalar("event.dateEnd", "Event", "Last day", "date", "dateEnd"),
    scalar("event.start", "Event", "Starts", "time", "timeStart"),
    scalar("event.end", "Event", "Ends", "time", "timeEnd"),
    scalar("event.venue", "Event", "Venue", "text", "location"),
    scalar("event.guests", "Event", "Guests", "count", "guestCount"),
  ];
  for (const l of d.lines) {
    if (!l.id) out.push(lineValue(l, "name"));
    out.push(lineValue(l, "quantity"), lineValue(l, "price"));
  }
  out.push(scalar("discount", "What's included", "Discount", "money", "discount"));
  for (const i of d.schedule) {
    out.push(paymentValue(i, "amount"));
    if (i.dueType === "before_event") out.push(paymentValue(i, "dueDays"));
    if (i.dueType === "date") out.push(paymentValue(i, "dueDate"));
  }
  out.push(
    scalar("policy.cancellation", "Policies", "Cancellation window (days)", "days", "cancellationDays"),
    scalar("policy.overtime", "Policies", "Overtime rate (per hour)", "money", "overtimeRate"),
  );
  for (const c of d.clauses) out.push(clauseValue(c));
  return out;
}

/** The values of several versions together, each once, first version's order first. */
export function unionValues(...drafts: Draft[]): NegotiableValue[] {
  const seen = new Set<string>();
  const out: NegotiableValue[] = [];
  for (const d of drafts) {
    for (const v of valuesOf(d)) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      out.push(v);
    }
  }
  return out;
}

/** Two typed values mean the same thing: "1400" and "1,400.00" dollars agree. */
export function sameValue(kind: ValueKind, a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (x === y) return true;
  if (kind === "money") return x !== "" && y !== "" && toCents(x) === toCents(y);
  if (kind === "count" || kind === "days") return x !== "" && y !== "" && Number(x) === Number(y);
  return false;
}

export function differs(v: NegotiableValue, a: Draft, b: Draft): boolean {
  return !sameValue(v.kind, v.get(a), v.get(b));
}

/** The values that differ between two versions. */
export function changedValues(a: Draft, b: Draft): NegotiableValue[] {
  return unionValues(a, b).filter((v) => differs(v, a, b));
}

// ── Showing values ───────────────────────────────────────────────────

export function showValue(kind: ValueKind, raw: string): string {
  const v = raw.trim();
  if (!v) return "—";
  switch (kind) {
    case "money":
      return money(toCents(v));
    case "days":
      return `${v} day${Number(v) === 1 ? "" : "s"}`;
    case "date": {
      const d = new Date(`${v}T00:00:00`);
      return Number.isNaN(d.getTime())
        ? v
        : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    }
    case "time": {
      const m = /^(\d{1,2}):(\d{2})/.exec(v);
      if (!m) return v;
      const h = Number(m[1]);
      return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
    }
    default:
      return v;
  }
}

// ── Items and clauses in or out ──────────────────────────────────────

export interface Toggle<T> {
  id: string;
  item: T;
  /** In your version now. */
  included: boolean;
  /** Which of the other two versions have it — "Added by …" / "Removed by …". */
  inOriginal: boolean;
  inProposed: boolean;
}

/** Lines that some version has and another doesn't — the only ones worth a checkbox. */
export function lineToggles(original: Draft, proposed: Draft, yours: Draft): Toggle<LineDraft>[] {
  const all = new Map<string, LineDraft>();
  for (const d of [yours, proposed, original]) for (const l of d.lines) if (!all.has(lineId(l))) all.set(lineId(l), l);
  const has = (d: Draft, id: string) => d.lines.some((l) => lineId(l) === id);
  return [...all.entries()]
    .map(([id, item]) => ({ id, item, included: has(yours, id), inOriginal: has(original, id), inProposed: has(proposed, id) }))
    .filter((t) => !(t.included && t.inOriginal && t.inProposed));
}

/** Every clause any version has, plus the vendor's library — the design's
 *  "Included clauses" checklist. A library clause matches one in the
 *  contract by title. */
export function clauseToggles(
  original: Draft,
  proposed: Draft,
  yours: Draft,
  library: Omit<ClauseDraft, "key">[] = [],
): Toggle<ClauseDraft>[] {
  const all = new Map<string, ClauseDraft>();
  for (const d of [yours, proposed, original]) for (const c of d.clauses) if (!all.has(c.key)) all.set(c.key, c);
  const titles = new Set([...all.values()].map((c) => c.title.trim().toLowerCase()));
  for (const c of library) {
    const t = c.title.trim().toLowerCase();
    if (!t || titles.has(t)) continue;
    titles.add(t);
    const key = `lib:${t}`;
    all.set(key, { key, ...c });
  }
  const has = (d: Draft, key: string) => d.clauses.some((c) => c.key === key);
  return [...all.entries()].map(([id, item]) => ({
    id,
    item,
    included: has(yours, id),
    inOriginal: has(original, id),
    inProposed: has(proposed, id),
  }));
}

export function setLineIncluded(d: Draft, line: LineDraft, include: boolean): Draft {
  const id = lineId(line);
  if (!include) return { ...d, lines: d.lines.filter((l) => lineId(l) !== id) };
  if (d.lines.some((l) => lineId(l) === id)) return d;
  return { ...d, lines: [...d.lines, { ...line }] };
}

export function setClauseIncluded(d: Draft, clause: ClauseDraft, include: boolean): Draft {
  if (!include) {
    const clauses = d.clauses.filter((c) => c.key !== clause.key);
    return { ...d, clauses, layout: reconcileLayout(d.layout, clauses) };
  }
  if (d.clauses.some((c) => c.key === clause.key)) return d;
  // A library clause gets a fresh key; one from another version keeps its
  // own, so the comparison lines it up with itself.
  if (clause.key.startsWith("lib:")) return { ...d, ...insertClause(d, { title: clause.title, body: clause.body }) };
  const clauses = [...d.clauses, { ...clause }];
  return { ...d, clauses, layout: reconcileLayout(d.layout, clauses) };
}

export function addExtraLine(d: Draft): Draft {
  return { ...d, lines: [...d.lines, { ...customLine(), price: "0", key: newKey() }] };
}

export function addClause(d: Draft): Draft {
  return { ...d, ...insertClause(d, { title: "New clause", body: "" }) };
}

/** After an edit to anything but the payments: the last payment takes up
 *  the difference, so the schedule still adds up to the total — the same
 *  arrangement as the editor, until a payment is edited by hand. */
export function followTotal(d: Draft): Draft {
  return d.schedule.length ? { ...d, schedule: balanceLastPayment(d) } : d;
}

// ── Comparing whole versions ─────────────────────────────────────────

/** Nothing in `d` differs from `terms`. */
export function sameAsTerms(d: Draft, terms: TermsVersion): boolean {
  return Object.keys(proposalChanges(d, terms)).length === 0;
}

/** What a saved draft stores: the whole working version's terms. */
export function draftToSave(d: Draft): Partial<TermsVersion> {
  return draftTerms(d);
}

/** What stops the couple's proposal being sent, in their words. The server
 *  checks the same things; this says so before they press Send. */
export function proposalProblems(d: Draft): string[] {
  const out: string[] = [];
  if (!d.lines.some((l) => l.kind === "package")) out.push("Keep at least one of the vendor's packages.");
  for (const l of d.lines) {
    if (!l.name.trim()) out.push("Give the item you're asking for a name.");
    if (!(Number(l.quantity) > 0)) out.push(`“${l.name || "An item"}” needs a quantity above zero.`);
    if (l.price.trim() === "" || toCents(l.price) < 0) out.push(`“${l.name || "An item"}” needs a price — $0 is fine.`);
  }
  if (d.schedule.length && scheduledCents(d) !== totalCents(d)) {
    out.push(`The payments add up to ${money(scheduledCents(d))} but the total is ${money(totalCents(d))}.`);
  }
  for (const c of d.clauses) {
    if (!c.title.trim() || !c.body.trim()) out.push("Every clause needs a title and some text.");
  }
  if (!d.dateIso) out.push("The event needs a date.");
  return Array.from(new Set(out));
}
