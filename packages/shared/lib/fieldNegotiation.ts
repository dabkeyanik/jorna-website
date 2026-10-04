// Field-by-field negotiation (backend 0072, its DECISIONS.md #26): the pure
// pieces both sides' workspaces share — how a field's value reads, which
// words of the contract page it highlights, and what the total would come to
// if this send's answers settle. The rules themselves (turns, who may change
// what) are the server's; this file only draws them.

import { fromContract, type Draft } from "./contractDraft";
import type { FieldAnswer, NegotiationFieldView, TermsVersion } from "./contractTypes";

export type InputKind = "date" | "time" | "text" | "count" | "money" | "hours" | "bool" | "schedule" | "newline";

export function kindOf(key: string): InputKind {
  if (key === "event.date") return "date";
  if (key === "event.time") return "time";
  if (key === "event.location") return "text";
  if (key === "event.guests") return "count";
  if (key === "discount" || key === "policy.overtime" || key.endsWith(".price")) return "money";
  if (key === "policy.cancellation") return "hours";
  if (key.endsWith(".included")) return "bool";
  if (key === "schedule") return "schedule";
  if (key.startsWith("line:new:")) return "newline";
  return "count"; // line:<id>.quantity
}

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

function day(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function clock(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

/** A field's value in plain words, as the card and the summary print it. */
export function display(key: string, value: unknown): string {
  if (value === null || value === undefined) return "Not set";
  switch (kindOf(key)) {
    case "date": {
      const v = value as { date_iso: string; date_end: string | null };
      return v.date_end && v.date_end !== v.date_iso ? `${day(v.date_iso)} – ${day(v.date_end)}` : day(v.date_iso);
    }
    case "time": {
      const v = value as { time_start: string; time_end: string };
      return `${clock(v.time_start)} – ${clock(v.time_end)}`;
    }
    case "money":
      return money(Number(value));
    case "hours": {
      const days = Math.round(Number(value) / 24);
      return `${days} day${days === 1 ? "" : "s"}`;
    }
    case "bool":
      return value ? "Included" : "Left out";
    case "schedule":
      return (value as { label: string; amount_cents: number }[])
        .map((i) => `${i.label} ${money(i.amount_cents)}`)
        .join(" · ");
    case "newline": {
      const v = value as { name?: string; quantity?: number; unit_price_cents?: number };
      return `${v.name ?? "Item"} × ${v.quantity ?? 1}${v.unit_price_cents != null ? ` at ${money(v.unit_price_cents)}` : ""}`;
    }
    default:
      return String(value);
  }
}

/** The ids ContractPaper marks for a field, so its value lights up where it
 *  prints. A new item isn't on the page until it settles. */
export function paperIds(key: string): string[] {
  if (key === "event.date") return ["event.date", "event.dateEnd"];
  if (key === "event.time") return ["event.start", "event.end"];
  if (key === "event.location") return ["event.venue"];
  if (key === "event.guests") return ["event.guests"];
  if (key === "discount" || key.startsWith("policy.")) return [key];
  const line = /^line:(.+)\.(quantity|price|included)$/.exec(key);
  if (line) return [line[2] === "included" ? `line:${line[1]}` : `line:${line[1]}.${line[2]}`];
  const clause = /^clause:(.+)\.included$/.exec(key);
  if (clause) return [`clause:${clause[1]}`];
  return [];
}

/** The agreed terms as a draft ContractPaper can draw. */
export function paperDraft(terms: TermsVersion): Draft {
  return fromContract({
    ...terms,
    deposit_percent: null,
    contract_terms: null,
    guest_name: null,
    guest_email: null,
    guest_phone: null,
  });
}

/** What the value would be if this answer settles: accepted → theirs, kept →
 *  the agreed one, anything else → the value sent. */
export function answerValue(field: NegotiationFieldView, answer: FieldAnswer): unknown {
  if (answer.action === "accept") return field.proposed;
  if (answer.action === "keep") return field.value;
  return answer.value;
}

/** The contract total if every answer in this send settled — a preview for
 *  the footer, not a promise: the other side still has to agree to changes. */
export function estimateTotal(terms: TermsVersion, fields: NegotiationFieldView[], answers: FieldAnswer[]): number {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const over = new Map<string, unknown>();
  for (const a of answers) {
    const f = byKey.get(a.key);
    over.set(a.key, f ? answerValue(f, a) : a.value);
  }
  let subtotal = 0;
  for (const line of terms.line_items ?? []) {
    if (over.get(`line:${line.id}.included`) === false) continue;
    const qty = Number(over.get(`line:${line.id}.quantity`) ?? line.quantity);
    const price = Number(over.get(`line:${line.id}.price`) ?? line.unit_price_cents);
    subtotal += Math.round(qty * price);
  }
  for (const [key, value] of over) {
    if (!key.startsWith("line:new:") || !value) continue;
    const v = value as { quantity?: number; unit_price_cents?: number };
    subtotal += Math.round((v.quantity ?? 1) * (v.unit_price_cents ?? 0));
  }
  const discount = Number(over.has("discount") ? over.get("discount") : (terms.discount_cents ?? 0));
  return subtotal - discount;
}

export const centsToDollars = (cents: unknown) => (cents == null ? "" : String(Number(cents) / 100));
export const dollarsToCents = (raw: string) => Math.round(Number(raw) * 100);
export const hoursToDays = (hours: unknown) => (hours == null ? "" : String(Math.round(Number(hours) / 24)));
export const daysToHours = (raw: string) => Math.round(Number(raw)) * 24;

/** Fields the reader has to answer this turn. */
export function waitingOn(fields: NegotiationFieldView[], side: "client" | "vendor"): NegotiationFieldView[] {
  return fields.filter((f) => f.state === (side === "client" ? "waiting_client" : "waiting_vendor"));
}
