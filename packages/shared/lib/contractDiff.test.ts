import { describe, expect, it } from "vitest";
import { diffTerms, termsOf, wordDiff } from "./contractDiff";
import { draftTerms, fromContract, proposalChanges, type ContractTermsSource } from "./contractDraft";
import type { LineItem, TermsVersion } from "./contractTypes";

const line = (over: Partial<LineItem> = {}): LineItem => ({
  id: "pkg",
  kind: "package",
  service_id: "svc",
  addon_id: null,
  name: "Reception DJ",
  description: null,
  unit: "event",
  unit_price_cents: 140_000,
  quantity: 1,
  total_cents: 140_000,
  ...over,
});

const base: TermsVersion = {
  date_iso: "2027-11-13",
  date_end: null,
  time_start: "19:00",
  time_end: "23:00",
  location: "Pines Manor",
  guest_count: 200,
  line_items: [line(), line({ id: "lights", kind: "custom", service_id: null, name: "Uplighting", unit_price_cents: 10_000, quantity: 2, total_cents: 20_000 })],
  discount_cents: null,
  amount_cents: 160_000,
  payment_schedule: [
    { id: "dep", label: "Deposit", amount_cents: 50_000, due_type: "on_signing", due_date: null, due_days: null },
    { id: "bal", label: "Final balance", amount_cents: 110_000, due_type: "before_event", due_date: null, due_days: 14 },
  ],
  terms_clauses: [
    { key: "scope", title: "Scope", body: "DJ and MC for the reception." },
    { key: "travel", title: "Travel", body: "Travel within 30 miles is included." },
  ],
  cancellation_window_hours: 720,
  overtime_rate_cents: 15_000,
};

describe("wordDiff", () => {
  it("marks only the words that changed", () => {
    expect(wordDiff("Travel within 30 miles is included.", "Travel within 50 miles is included.")).toEqual([
      { op: "same", text: "Travel within " },
      { op: "del", text: "30 " },
      { op: "add", text: "50 " },
      { op: "same", text: "miles is included." },
    ]);
  });

  it("handles text added at the end, and an empty side", () => {
    expect(wordDiff("Two hours.", "Two hours. Then more.")).toEqual([
      { op: "same", text: "Two hours. " },
      { op: "add", text: "Then more." },
    ]);
    expect(wordDiff("", "New")).toEqual([{ op: "add", text: "New" }]);
  });
});

describe("diffTerms", () => {
  it("finds nothing between a version and itself", () => {
    const d = diffTerms(base, base);
    expect(d.count).toBe(0);
    expect(d.total).toBeNull();
  });

  it("reads each section the way the plan lists them", () => {
    const after: TermsVersion = {
      ...base,
      date_iso: "2027-11-14",
      guest_count: 250,
      line_items: [
        line(),
        line({ id: "lights", kind: "custom", service_id: null, name: "Uplighting", unit_price_cents: 10_000, quantity: 3, total_cents: 30_000 }),
        line({ id: "new", kind: "custom", service_id: null, name: "Cold sparklers", unit_price_cents: 0, total_cents: 0 }),
      ],
      amount_cents: 170_000,
      payment_schedule: [
        base.payment_schedule![0],
        { ...base.payment_schedule![1], amount_cents: 120_000, due_days: 7 },
      ],
      terms_clauses: [
        base.terms_clauses![0],
        { key: "travel", title: "Travel", body: "Travel within 50 miles is included." },
        { key: "songs", title: "Song list", body: "We'll send a do-not-play list." },
      ],
      overtime_rate_cents: 12_000,
    };
    const d = diffTerms(base, after);
    expect(d.event.map((c) => c.label)).toEqual(["Date", "Guests"]);
    expect(d.items.map((c) => [c.kind, c.name])).toEqual([
      ["changed", "Uplighting"],
      ["added", "Cold sparklers"],
    ]);
    expect(d.items[0].notes).toEqual(["Quantity 2 → 3"]);
    expect(d.total).toEqual({ label: "Total", before: "$1,600.00", after: "$1,700.00" });
    expect(d.schedule).toHaveLength(1);
    expect(d.schedule[0].notes).toEqual([
      "Amount $1,100.00 → $1,200.00",
      "Due 14 days before the event → Due 7 days before the event",
    ]);
    expect(d.terms.map((c) => [c.kind, c.title])).toEqual([
      ["changed", "Travel"],
      ["added", "Song list"],
    ]);
    expect(d.terms[0].words?.filter((w) => w.op !== "same").map((w) => w.text.trim())).toEqual(["30", "50"]);
    expect(d.policies).toEqual([{ label: "Overtime rate", before: "$150.00/hr", after: "$120.00/hr" }]);
    expect(d.counts).toEqual({ event: 2, items: 2, schedule: 1, terms: 2, policies: 1 });
    expect(d.count).toBe(8);
  });

  it("matches a line by name when the ids differ, and sees removals", () => {
    const after = {
      ...base,
      line_items: [line({ id: "other-id" })],
      amount_cents: 140_000,
    };
    const d = diffTerms(base, after);
    expect(d.items.map((c) => [c.kind, c.name])).toEqual([["removed", "Uplighting"]]);
  });
});

describe("a client's proposal from the form", () => {
  const contract: ContractTermsSource = {
    ...base,
    deposit_percent: null,
    contract_terms: null,
    guest_name: "Meera",
    guest_email: "meera@example.com",
    guest_phone: null,
    document_title: null,
    document_layout: null,
    payment_schedule: base.payment_schedule!.map((i) => ({ ...i, due_on: null, marked_paid_at: null, confirmed_at: null })),
  };

  it("round-trips a version through the form unchanged", () => {
    const draft = fromContract(contract);
    expect(diffTerms(termsOf(contract), draftTerms(draft)).count).toBe(0);
    expect(proposalChanges(draft, termsOf(contract))).toEqual({});
  });

  it("sends only what changed — and the schedule whenever the total moves", () => {
    const draft = fromContract(contract);
    draft.lines[1] = { ...draft.lines[1], quantity: "3" };
    draft.schedule[1] = { ...draft.schedule[1], amount: "1200" };
    const changes = proposalChanges(draft, termsOf(contract));
    expect(Object.keys(changes).sort()).toEqual(["line_items", "payment_schedule"]);
    // Ids travel, so the server and the comparison match the same lines.
    expect(changes.line_items?.map((l) => l.id)).toEqual(["pkg", "lights"]);
    expect(changes.payment_schedule?.map((p) => [p.id, p.amount_cents])).toEqual([
      ["dep", 50_000],
      ["bal", 120_000],
    ]);

    const clauseOnly = fromContract(contract);
    clauseOnly.clauses[1] = { ...clauseOnly.clauses[1], body: "Travel within 50 miles is included." };
    expect(Object.keys(proposalChanges(clauseOnly, termsOf(contract)))).toEqual(["terms_clauses"]);
  });
});
