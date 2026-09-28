import { describe, expect, it } from "vitest";
import {
  applyTemplate,
  balanceLastPayment,
  customLine,
  emptyDraft,
  fromContract,
  fromRequest,
  presetSchedule,
  problems,
  scheduledCents,
  toCents,
  toDocument,
  toTemplate,
  totalCents,
  type Draft,
  type LineDraft,
} from "./contractDraft";
import type { Contract, ServiceItem, VendorBooking } from "./types";

const pkg = (over: Partial<LineDraft> = {}): LineDraft => ({
  key: "p",
  kind: "package",
  serviceId: "svc-1",
  addonId: null,
  name: "Reception set",
  unit: "event",
  price: "1400",
  quantity: "1",
  ...over,
});

const ready = (over: Partial<Draft> = {}): Draft => {
  const d: Draft = {
    ...emptyDraft(),
    dateIso: "2030-06-01",
    timeStart: "18:00",
    timeEnd: "22:00",
    lines: [pkg(), { ...customLine(), name: "Uplighting", price: "50", quantity: "2" }],
    discount: "100",
    ...over,
  };
  return { ...d, schedule: over.schedule ?? presetSchedule("deposit_balance", totalCents(d)) };
};

describe("totals", () => {
  it("multiplies each line and takes the discount off", () => {
    expect(totalCents(ready())).toBe(140_000 + 10_000 - 10_000);
  });

  it("doesn't let a float dollar amount drift a cent", () => {
    expect(toCents("19.99")).toBe(1999);
    expect(toCents("0.1") + toCents("0.2")).toBe(30);
  });
});

describe("schedule presets", () => {
  it("always add up exactly, remainder on the last payment", () => {
    for (const total of [100_001, 99_999, 140_000, 1]) {
      for (const preset of ["full", "deposit_balance", "three"] as const) {
        const rows = presetSchedule(preset, total, 33);
        expect(rows.reduce((s, r) => s + toCents(r.amount), 0)).toBe(total);
      }
    }
  });

  it("can move a gap onto the last payment", () => {
    const d = ready();
    d.schedule[0].amount = "100";
    const fixed = { ...d, schedule: balanceLastPayment(d) };
    expect(scheduledCents(fixed)).toBe(totalCents(fixed));
  });
});

describe("problems", () => {
  it("is empty for a draft that's ready to send", () => {
    expect(problems(ready(), "2030-01-01")).toEqual([]);
  });

  it("names a schedule that doesn't add up, with both numbers", () => {
    const d = ready();
    d.schedule[0].amount = "1";
    expect(problems(d, "2030-01-01").join(" ")).toMatch(/add up to .* but the total is \$1,400\.00/);
  });

  it("needs one of the vendor's packages, not just custom lines", () => {
    const d = ready({ lines: [{ ...customLine(), name: "Travel", price: "50", quantity: "1" }], discount: "" });
    expect(problems(d, "2030-01-01")).toContain("Add at least one of your packages.");
  });
});

describe("toDocument", () => {
  it("sends cents, and only the due fields each rule uses", () => {
    const doc = toDocument(ready());
    expect(doc.line_items[1]).toMatchObject({ kind: "custom", unit_price_cents: 5000, quantity: 2 });
    expect(doc.discount_cents).toBe(10_000);
    expect(doc.payment_schedule[0]).toMatchObject({ due_type: "on_signing", due_date: null, due_days: null });
    expect(doc.payment_schedule[1]).toMatchObject({ due_type: "before_event", due_days: 14 });
  });
});

describe("templates", () => {
  it("keep the schedule as shares, so they fit a different total", () => {
    const body = toTemplate(ready());
    const services = [{ service_id: "svc-1" } as ServiceItem];
    const bigger = applyTemplate(
      { ...emptyDraft(), lines: [] },
      { ...body, lines: [pkg({ price: "2800" })], discount: "" },
      services,
    );
    expect(totalCents(bigger)).toBe(280_000);
    expect(scheduledCents(bigger)).toBe(280_000);
    expect(bigger.schedule.map((s) => s.label)).toEqual(["Deposit", "Final balance"]);
  });

  it("drop lines for packages the vendor no longer has", () => {
    const body = toTemplate(ready());
    const applied = applyTemplate(emptyDraft(), body, []);
    expect(applied.lines.map((l) => l.kind)).toEqual(["custom"]);
  });
});

describe("fromContract", () => {
  it("turns an older single-deposit contract into a two-payment schedule", () => {
    const c = {
      booking_id: "c",
      date_iso: "2030-06-01",
      date_end: null,
      time_start: "18:00",
      time_end: "22:00",
      location: "TBD",
      guest_count: null,
      amount_cents: 100_000,
      deposit_percent: 25,
      line_items: [
        {
          id: "l", kind: "package", service_id: "svc-1", addon_id: null, name: "Set",
          description: null, unit: "event", unit_price_cents: 100_000, quantity: 1, total_cents: 100_000,
        },
      ],
      payment_schedule: null,
      contract_terms: { travel: "30 miles included" },
    } as unknown as Contract;
    const d = fromContract(c);
    expect(d.location).toBe("");
    expect(d.schedule.map((s) => toCents(s.amount))).toEqual([25_000, 75_000]);
    expect(d.clauses[0]).toMatchObject({ title: "Travel", body: "30 miles included" });
  });
});

describe("fromRequest", () => {
  const request = (over: Partial<VendorBooking> = {}) =>
    ({
      booking_id: "b",
      user_id: "u",
      client_name: "Priya Mehta",
      service_id: "svc-1",
      service_name: "Reception set",
      price: 1400,
      price_unit: "event",
      price_pending_quantity: false,
      date_iso: "2030-06-01",
      time_start: "18:00",
      time_end: "22:00",
      location: "Pines Manor",
      status: "pending",
      ...over,
    }) as VendorBooking;

  it("starts from the request's total when it's known", () => {
    const d = fromRequest(request());
    expect(d.lines[0]).toMatchObject({ kind: "package", serviceId: "svc-1", price: "1400", quantity: "1" });
    expect(totalCents(d)).toBe(140_000);
    expect(d.clientName).toBe("Priya Mehta");
  });

  it("starts a per-guest request at the rate, counted by its guests if it has them", () => {
    const d = fromRequest(request({ price: 45, price_unit: "person", price_pending_quantity: true, guest_count: 200 }));
    expect(d.lines[0]).toMatchObject({ unit: "person", price: "45", quantity: "200" });
    const unknown = fromRequest(request({ price: 45, price_unit: "person", price_pending_quantity: true }));
    expect(unknown.lines[0].quantity).toBe("");
  });
});

