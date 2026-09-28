import { describe, expect, it } from "vitest";
import { contractSignUrl, contractStep } from "./contract";
import type { BundleBooking } from "./types";

const booking = (over: Partial<BundleBooking> = {}) =>
  ({ booking_id: "b", status: "approved", contract_token: "tok", contract_status: "sent", signed_at: null, ...over }) as BundleBooking;

describe("contractStep", () => {
  it("asks for a signature while the proposal is out", () => {
    expect(contractStep(booking())).toBe("sign");
    expect(contractStep(booking({ contract_status: "viewed" }))).toBe("sign");
  });

  it("says when it lapsed unsigned", () => {
    expect(contractStep(booking({ contract_status: "expired" }))).toBe("expired");
  });

  it("has nothing to ask once signed, or with no contract at all", () => {
    expect(contractStep(booking({ signed_at: "2030-01-01T00:00:00" }))).toBeNull();
    expect(contractStep(booking({ contract_token: null, contract_status: null }))).toBeNull();
    expect(contractStep(booking({ contract_status: "voided" }))).toBeNull();
  });
});

describe("contractSignUrl", () => {
  it("points at the vendor site's signing page", () => {
    expect(contractSignUrl("a b")).toBe("https://jornaevents.com/app/booking-link?t=a%20b");
  });
});
