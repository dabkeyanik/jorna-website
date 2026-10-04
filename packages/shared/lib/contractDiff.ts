// Two versions of a contract's terms, compared section by section — what a
// client's change proposal asks for, or what a vendor's new version changed
// (backend 0068, its DECISIONS.md #23). The couple's signing page and the
// vendor's review page both draw ContractCompare from this, so they can't
// describe the same change two ways.
//
// Line items and payments are matched by id (contractDraft keeps ids across
// edits), falling back to name for a line added on one side; clauses by
// key. Clause text is compared word by word.

import { describeDue, money } from "./contractDraft";
import type { Clause, InstallmentTerms, LineItem, TermsVersion } from "./contractTypes";

export type DiffSection = "event" | "items" | "schedule" | "terms" | "policies";

export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

export type ChangeKind = "added" | "removed" | "changed";

export interface LineChange {
  kind: ChangeKind;
  name: string;
  before: LineItem | null;
  after: LineItem | null;
  /** What changed on a line both versions have: "Quantity 2 → 3". */
  notes: string[];
}

export interface PaymentChange {
  kind: ChangeKind;
  label: string;
  before: InstallmentTerms | null;
  after: InstallmentTerms | null;
  notes: string[];
}

export type WordOp = "same" | "add" | "del";

export interface WordPiece {
  op: WordOp;
  text: string;
}

export interface ClauseChange {
  kind: ChangeKind;
  title: string;
  before: Clause | null;
  after: Clause | null;
  /** Word-level pieces of the text, for a clause both versions have. */
  words: WordPiece[] | null;
}

export interface ContractDiff {
  event: FieldChange[];
  items: LineChange[];
  /** The discount, when it changed — shown with the items. */
  discount: FieldChange | null;
  /** The total, when it changed — a consequence, not counted as a change. */
  total: FieldChange | null;
  schedule: PaymentChange[];
  terms: ClauseChange[];
  policies: FieldChange[];
  /** Changes per section, and in all. */
  counts: Record<DiffSection, number>;
  count: number;
}

// ── Reading a version ────────────────────────────────────────────────

type TermsSource = Pick<
  TermsVersion,
  "date_iso" | "date_end" | "time_start" | "time_end" | "location" | "guest_count" | "amount_cents"
  | "cancellation_window_hours" | "overtime_rate_cents"
> & {
  line_items?: LineItem[] | null;
  discount_cents?: number | null;
  payment_schedule?: InstallmentTerms[] | null;
  terms_clauses?: Clause[] | null;
};

/** A contract or guest booking's current terms, in the shape a revision or
 *  proposal has: payments without their marks. */
export function termsOf(c: TermsSource): TermsVersion {
  return {
    date_iso: c.date_iso,
    date_end: c.date_end ?? null,
    time_start: c.time_start,
    time_end: c.time_end,
    location: c.location,
    guest_count: c.guest_count ?? null,
    line_items: c.line_items ?? null,
    discount_cents: c.discount_cents ?? null,
    amount_cents: c.amount_cents,
    payment_schedule: c.payment_schedule?.length
      ? c.payment_schedule.map((i) => ({
          id: i.id,
          label: i.label,
          amount_cents: i.amount_cents,
          due_type: i.due_type,
          due_date: i.due_date ?? null,
          due_days: i.due_days ?? null,
        }))
      : null,
    terms_clauses: c.terms_clauses ?? null,
    cancellation_window_hours: c.cancellation_window_hours ?? null,
    overtime_rate_cents: c.overtime_rate_cents ?? null,
  };
}

// ── Words ────────────────────────────────────────────────────────────

/** Longest-common-subsequence over words (whitespace kept with the word
 *  before it), merged into runs. Clauses are at most a few hundred words,
 *  so the table stays small. */
export function wordDiff(before: string, after: string): WordPiece[] {
  const a = before.match(/\S+\s*/g) ?? [];
  const b = after.match(/\S+\s*/g) ?? [];
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i].trim() === b[j].trim() ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: WordPiece[] = [];
  const push = (op: WordOp, text: string) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ op, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].trim() === b[j].trim()) {
      push("same", b[j]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("del", a[i++]);
    } else {
      push("add", b[j++]);
    }
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("add", b[j++]);
  return out;
}

// ── Words for values ─────────────────────────────────────────────────

function prettyDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function prettyTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  const hour = Number(m[1]);
  return `${((hour + 11) % 12) + 1}:${m[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function days(hours: number | null): string {
  if (hours == null) return "None";
  const d = Math.round(hours / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

function rate(cents: number | null): string {
  return cents == null ? "None" : `${money(cents)}/hr`;
}

function field(out: FieldChange[], label: string, before: string, after: string) {
  if (before !== after) out.push({ label, before, after });
}

// ── Sections ─────────────────────────────────────────────────────────

/** Pair two lists: by id, then by a fallback key for what's left. */
function pair<T>(a: T[], b: T[], id: (x: T) => string, fallback: (x: T) => string): [T | null, T | null][] {
  const pairs: [T | null, T | null][] = [];
  const left = new Set(b);
  const take = (match: (y: T) => boolean) => {
    for (const y of left) {
      if (match(y)) {
        left.delete(y);
        return y;
      }
    }
    return null;
  };
  const unmatched: T[] = [];
  for (const x of a) {
    const y = take((y) => id(y) === id(x));
    if (y) pairs.push([x, y]);
    else unmatched.push(x);
  }
  for (const x of unmatched) pairs.push([x, take((y) => fallback(y) === fallback(x))]);
  for (const y of b) if (left.has(y)) pairs.push([null, y]);
  return pairs;
}

function lineChanges(a: LineItem[], b: LineItem[]): LineChange[] {
  const out: LineChange[] = [];
  for (const [x, y] of pair(a, b, (l) => l.id, (l) => `${l.kind}|${l.service_id}|${l.addon_id}|${l.name}`)) {
    if (x && !y) out.push({ kind: "removed", name: x.name, before: x, after: null, notes: [] });
    else if (!x && y) out.push({ kind: "added", name: y.name, before: null, after: y, notes: [] });
    else if (x && y) {
      const notes: string[] = [];
      if (x.name !== y.name) notes.push(`Name “${x.name}” → “${y.name}”`);
      if (x.quantity !== y.quantity) notes.push(`Quantity ${x.quantity} → ${y.quantity}`);
      if (x.unit_price_cents !== y.unit_price_cents) {
        notes.push(`Price ${money(x.unit_price_cents)} → ${money(y.unit_price_cents)}`);
      }
      if ((x.description ?? "") !== (y.description ?? "")) notes.push("Description changed");
      if (notes.length) out.push({ kind: "changed", name: y.name, before: x, after: y, notes });
    }
  }
  return out;
}

function paymentChanges(a: InstallmentTerms[], b: InstallmentTerms[]): PaymentChange[] {
  const out: PaymentChange[] = [];
  for (const [x, y] of pair(a, b, (i) => i.id, (i) => i.label)) {
    if (x && !y) out.push({ kind: "removed", label: x.label, before: x, after: null, notes: [] });
    else if (!x && y) out.push({ kind: "added", label: y.label, before: null, after: y, notes: [] });
    else if (x && y) {
      const notes: string[] = [];
      if (x.label !== y.label) notes.push(`Name “${x.label}” → “${y.label}”`);
      if (x.amount_cents !== y.amount_cents) notes.push(`Amount ${money(x.amount_cents)} → ${money(y.amount_cents)}`);
      const due = (i: InstallmentTerms) => describeDue(i);
      if (due(x) !== due(y)) notes.push(`${due(x)} → ${due(y)}`);
      if (notes.length) out.push({ kind: "changed", label: y.label, before: x, after: y, notes });
    }
  }
  return out;
}

function clauseChanges(a: Clause[], b: Clause[]): ClauseChange[] {
  const out: ClauseChange[] = [];
  for (const [x, y] of pair(a, b, (c) => c.key, (c) => c.title.trim().toLowerCase())) {
    if (x && !y) out.push({ kind: "removed", title: x.title, before: x, after: null, words: null });
    else if (!x && y) out.push({ kind: "added", title: y.title, before: null, after: y, words: null });
    else if (x && y && (x.title !== y.title || x.body !== y.body)) {
      out.push({
        kind: "changed",
        title: y.title,
        before: x,
        after: y,
        words: x.body !== y.body ? wordDiff(x.body, y.body) : null,
      });
    }
  }
  return out;
}

export function diffTerms(before: TermsVersion, after: TermsVersion): ContractDiff {
  const event: FieldChange[] = [];
  const multi = (t: TermsVersion) =>
    t.date_end && t.date_end !== t.date_iso ? `${prettyDate(t.date_iso)} – ${prettyDate(t.date_end)}` : prettyDate(t.date_iso);
  field(event, "Date", multi(before), multi(after));
  field(
    event,
    "Time",
    `${prettyTime(before.time_start)} – ${prettyTime(before.time_end)}`,
    `${prettyTime(after.time_start)} – ${prettyTime(after.time_end)}`,
  );
  field(event, "Venue", before.location || "TBD", after.location || "TBD");
  field(event, "Guests", before.guest_count?.toString() ?? "Not set", after.guest_count?.toString() ?? "Not set");

  const items = lineChanges(before.line_items ?? [], after.line_items ?? []);
  const discount =
    (before.discount_cents ?? 0) !== (after.discount_cents ?? 0)
      ? { label: "Discount", before: money(before.discount_cents ?? 0), after: money(after.discount_cents ?? 0) }
      : null;
  const total =
    before.amount_cents !== after.amount_cents
      ? { label: "Total", before: money(before.amount_cents), after: money(after.amount_cents) }
      : null;
  const schedule = paymentChanges(before.payment_schedule ?? [], after.payment_schedule ?? []);
  const terms = clauseChanges(before.terms_clauses ?? [], after.terms_clauses ?? []);
  const policies: FieldChange[] = [];
  field(policies, "Cancellation window", days(before.cancellation_window_hours), days(after.cancellation_window_hours));
  field(policies, "Overtime rate", rate(before.overtime_rate_cents), rate(after.overtime_rate_cents));

  const counts: Record<DiffSection, number> = {
    event: event.length,
    items: items.length + (discount ? 1 : 0),
    schedule: schedule.length,
    terms: terms.length,
    policies: policies.length,
  };
  return {
    event,
    items,
    discount,
    total,
    schedule,
    terms,
    policies,
    counts,
    count: Object.values(counts).reduce((n, c) => n + c, 0),
  };
}
