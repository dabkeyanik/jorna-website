import { describe, expect, it } from "vitest";
import { display, estimateTotal, kindOf, paperIds, waitingOn } from "./fieldNegotiation";
import type { NegotiationFieldView, TermsVersion } from "./contractTypes";

const terms: TermsVersion = {
  date_iso: "2027-11-13",
  date_end: null,
  time_start: "19:00",
  time_end: "23:00",
  location: "Pines Manor",
  guest_count: 150,
  line_items: [
    { id: "pkg", kind: "package", service_id: "s1", addon_id: null, name: "Reception set", description: null, unit: "event", unit_price_cents: 140_000, quantity: 1, total_cents: 140_000 },
    { id: "lights", kind: "custom", service_id: null, addon_id: null, name: "Uplighting", description: null, unit: "item", unit_price_cents: 10_000, quantity: 2, total_cents: 20_000 },
  ],
  discount_cents: null,
  amount_cents: 160_000,
  payment_schedule: null,
  terms_clauses: null,
  cancellation_window_hours: 720,
  overtime_rate_cents: 15_000,
};

const field = (key: string, over: Partial<NegotiationFieldView> = {}): NegotiationFieldView => ({
  key, group: "items", label: key, value: null, state: "agreed", proposed: null,
  proposed_by: null, round: null, note: null, locked: false, can_change: true, ...over,
});

describe("fieldNegotiation", () => {
  it("knows each field's input", () => {
    expect(kindOf("event.date")).toBe("date");
    expect(kindOf("line:pkg.price")).toBe("money");
    expect(kindOf("line:pkg.quantity")).toBe("count");
    expect(kindOf("clause:travel.included")).toBe("bool");
    expect(kindOf("policy.cancellation")).toBe("hours");
    expect(kindOf("line:new:ab12")).toBe("newline");
  });

  it("reads values in plain words", () => {
    expect(display("line:pkg.price", 140_000)).toBe("$1,400");
    expect(display("policy.cancellation", 720)).toBe("30 days");
    expect(display("event.time", { time_start: "19:00", time_end: "23:30" })).toBe("7:00 PM – 11:30 PM");
    expect(display("clause:x.included", false)).toBe("Left out");
    expect(display("event.guests", null)).toBe("Not set");
  });

  it("points each field at the words it highlights on the contract page", () => {
    expect(paperIds("line:lights.quantity")).toEqual(["line:lights.quantity"]);
    expect(paperIds("line:lights.included")).toEqual(["line:lights"]);
    expect(paperIds("clause:travel.included")).toEqual(["clause:travel"]);
    expect(paperIds("event.time")).toEqual(["event.start", "event.end"]);
    expect(paperIds("line:new:x")).toEqual([]);
  });

  it("estimates the total if this send's answers settle", () => {
    const fields = [
      field("line:lights.quantity", { value: 2, proposed: 3, state: "waiting_vendor" }),
      field("discount", { value: 0 }),
    ];
    expect(estimateTotal(terms, fields, [])).toBe(160_000);
    expect(estimateTotal(terms, fields, [{ key: "line:lights.quantity", action: "accept" }])).toBe(170_000);
    expect(estimateTotal(terms, fields, [{ key: "line:lights.quantity", action: "keep" }])).toBe(160_000);
    expect(
      estimateTotal(terms, fields, [
        { key: "discount", action: "change", value: 5_000 },
        { key: "line:lights.included", action: "change", value: false },
        { key: "line:new:a", action: "change", value: { quantity: 2, unit_price_cents: 2_500 } },
      ]),
    ).toBe(140_000 - 5_000 + 5_000);
  });

  it("lists what's waiting on each side", () => {
    const fields = [field("a", { state: "waiting_vendor" }), field("b", { state: "waiting_client" }), field("c")];
    expect(waitingOn(fields, "vendor").map((f) => f.key)).toEqual(["a"]);
  });
});
