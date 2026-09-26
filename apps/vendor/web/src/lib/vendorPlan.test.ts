import { describe, expect, it } from "vitest";
import {
  contractNeedsVendor,
  contractStatus,
  pipelineStage,
  pipelineStats,
  vendorTasks,
} from "./vendorPlan";
import type { VendorBooking } from "./types";

function booking(overrides: Partial<VendorBooking> = {}): VendorBooking {
  return {
    booking_id: "b1",
    user_id: "u1",
    status: "approved",
    date_iso: "2026-06-01",
    price: 100,
    ...overrides,
  };
}

describe("vendorTasks — negotiation", () => {
  it("surfaces a task when it's the vendor's turn to answer an open offer", () => {
    const tasks = vendorTasks(
      [
        booking({
          status: "negotiation_ongoing",
          negotiation_awaiting_role: "vendor",
        }),
      ],
      null,
    );
    expect(tasks.map((t) => t.kind)).toContain("negotiation");
  });

  it("does not surface a task for the vendor's own unanswered counter", () => {
    // Regression: this used to fire for ANY negotiation_ongoing booking,
    // including the vendor's own counter still sitting with the client —
    // "{client} made an offer, Review offer" shown for an offer the vendor
    // themselves just made. negotiation_awaiting_role fixes that.
    const tasks = vendorTasks(
      [
        booking({
          status: "negotiation_ongoing",
          negotiation_awaiting_role: "client",
        }),
      ],
      null,
    );
    expect(tasks.map((t) => t.kind)).not.toContain("negotiation");
  });

  it("does not surface a task once the negotiation has settled", () => {
    const tasks = vendorTasks(
      [booking({ status: "approved", negotiation_awaiting_role: null })],
      null,
    );
    expect(tasks.map((t) => t.kind)).not.toContain("negotiation");
  });
});

describe("pipelineStage", () => {
  // Ordinary, marketplace-sourced bookings (no contract_token) — no
  // signature step, BookingStatus is what "confirmed" means for these.
  it("buckets a pending ordinary booking as inquiry", () => {
    expect(pipelineStage(booking({ status: "pending" }))).toBe("inquiry");
  });

  it("buckets a negotiating ordinary booking as inquiry", () => {
    expect(pipelineStage(booking({ status: "negotiation_ongoing" }))).toBe("inquiry");
  });

  it("buckets an approved ordinary booking as confirmed", () => {
    expect(pipelineStage(booking({ status: "approved" }))).toBe("confirmed");
  });

  // Guest/contract bookings (have a contract_token) — created already
  // "approved" with no accept/decline step, so the signature is what
  // "confirmed" means instead of status.
  it("buckets an unsigned contract booking as awaiting_client, even though status is already approved", () => {
    expect(
      pipelineStage(
        booking({ status: "approved", contract_token: "tok", signed_at: null }),
      ),
    ).toBe("awaiting_client");
  });

  it("buckets a signed contract booking as confirmed", () => {
    expect(
      pipelineStage(
        booking({
          status: "approved",
          contract_token: "tok",
          signed_at: "2027-01-01T00:00:00Z",
        }),
      ),
    ).toBe("confirmed");
  });

  // Deposit received — only reachable when a deposit is actually configured.
  it("buckets a signed contract with a confirmed deposit as deposit_received", () => {
    expect(
      pipelineStage(
        booking({
          status: "approved",
          contract_token: "tok",
          signed_at: "2027-01-01T00:00:00Z",
          deposit_percent: 50,
          deposit_confirmed_received_at: "2027-01-02T00:00:00Z",
        }),
      ),
    ).toBe("deposit_received");
  });

  it("does not treat a marked-but-unconfirmed deposit as deposit_received", () => {
    expect(
      pipelineStage(
        booking({
          status: "approved",
          contract_token: "tok",
          signed_at: "2027-01-01T00:00:00Z",
          deposit_percent: 50,
          deposit_marked_paid_at: "2027-01-02T00:00:00Z",
          deposit_confirmed_received_at: null,
        }),
      ),
    ).toBe("confirmed");
  });

  // Done — only once everything owed is confirmed received.
  it("buckets a fully-confirmed-paid booking with no deposit as done", () => {
    expect(
      pipelineStage(
        booking({
          status: "approved",
          contract_token: "tok",
          signed_at: "2027-01-01T00:00:00Z",
          payment_status: "confirmed_paid",
        }),
      ),
    ).toBe("done");
  });

  it("does not reach done on full payment alone when a deposit was never confirmed", () => {
    expect(
      pipelineStage(
        booking({
          status: "approved",
          contract_token: "tok",
          signed_at: "2027-01-01T00:00:00Z",
          deposit_percent: 50,
          payment_status: "confirmed_paid",
        }),
      ),
    ).toBe("confirmed");
  });

  it("reaches done once both the deposit and the full payment are confirmed", () => {
    expect(
      pipelineStage(
        booking({
          status: "approved",
          contract_token: "tok",
          signed_at: "2027-01-01T00:00:00Z",
          deposit_percent: 50,
          deposit_confirmed_received_at: "2027-01-02T00:00:00Z",
          payment_status: "confirmed_paid",
        }),
      ),
    ).toBe("done");
  });

  it("does not auto-advance to done just because the event date has passed", () => {
    // Explicit product decision: accuracy over tidiness — see the function's
    // own doc comment.
    expect(
      pipelineStage(
        booking({
          status: "approved",
          contract_token: "tok",
          signed_at: "2027-01-01T00:00:00Z",
          date_iso: "2020-01-01",
          payment_status: "unpaid",
        }),
      ),
    ).toBe("confirmed");
  });

  it("treats the Stripe track's released status as fully paid too", () => {
    expect(
      pipelineStage(
        booking({
          status: "approved",
          contract_token: "tok",
          signed_at: "2027-01-01T00:00:00Z",
          payment_status: "released",
        }),
      ),
    ).toBe("done");
  });
});

describe("pipelineStats", () => {
  it("counts stages and sums unconfirmed deposits owed, excluding dead bookings", () => {
    const stats = pipelineStats([
      booking({ status: "pending" }), // inquiry
      booking({ status: "approved", contract_token: "t1" }), // awaiting_client
      booking({ status: "approved" }), // confirmed
      booking({
        status: "approved",
        contract_token: "t2",
        deposit_percent: 50,
        deposit_amount_cents: 50_000,
      }), // awaiting_client, deposit owed
      booking({ status: "rejected", contract_token: "t3", deposit_percent: 50, deposit_amount_cents: 99_999 }), // dead, excluded
    ]);
    expect(stats).toEqual({
      openInquiries: 1,
      awaitingClient: 2,
      depositsOwedCents: 50_000,
      confirmedEvents: 1,
    });
  });
});

describe("contractStatus", () => {
  const contract = (overrides: Partial<VendorBooking> = {}) =>
    booking({ contract_token: "tok", is_guest_booking: true, user_id: null, ...overrides });

  it("waits on a signature until signed, whether or not details are in", () => {
    expect(contractStatus(contract())).toBe("awaiting_signature");
    expect(contractStatus(contract({ guest_name: "Anjali Rao" }))).toBe("awaiting_signature");
  });

  it("is owed a deposit after signing when one is configured", () => {
    expect(
      contractStatus(
        contract({ guest_name: "A", signed_at: "2026-05-01T00:00:00Z", deposit_percent: 25 }),
      ),
    ).toBe("deposit_due");
  });

  it("hands the move to the vendor once the guest says the deposit is sent", () => {
    const status = contractStatus(
      contract({
        guest_name: "A",
        signed_at: "2026-05-01T00:00:00Z",
        deposit_percent: 25,
        deposit_marked_paid_at: "2026-05-02T00:00:00Z",
      }),
    );
    expect(status).toBe("confirm_deposit");
    expect(contractNeedsVendor(status)).toBe(true);
  });

  it("skips straight to the balance when there's no deposit", () => {
    expect(
      contractStatus(contract({ guest_name: "A", signed_at: "2026-05-01T00:00:00Z" })),
    ).toBe("balance_due");
  });

  it("asks the vendor to confirm a balance the guest marked paid", () => {
    expect(
      contractStatus(
        contract({
          guest_name: "A",
          signed_at: "2026-05-01T00:00:00Z",
          payment_status: "marked_paid",
        }),
      ),
    ).toBe("confirm_payment");
  });

  it("is paid exactly when the pipeline calls it done", () => {
    const b = contract({
      guest_name: "A",
      signed_at: "2026-05-01T00:00:00Z",
      deposit_percent: 25,
      deposit_confirmed_received_at: "2026-05-03T00:00:00Z",
      payment_status: "confirmed_paid",
    });
    expect(pipelineStage(b)).toBe("done");
    expect(contractStatus(b)).toBe("paid");
  });

  it("hands a draft or a lapsed offer back to the vendor", () => {
    const draft = contractStatus(contract({ contract_status: "draft" }));
    const expired = contractStatus(contract({ contract_status: "expired" }));
    expect([draft, expired]).toEqual(["draft", "expired"]);
    expect(contractNeedsVendor(draft)).toBe(true);
    expect(contractNeedsVendor(expired)).toBe(true);
    // Opened or not, a live offer is waiting on the client.
    expect(contractStatus(contract({ contract_status: "viewed" }))).toBe("awaiting_signature");
  });

  it("says declined rather than cancelled when the client turned it down", () => {
    expect(
      contractStatus(contract({ status: "rejected", contract_status: "declined" })),
    ).toBe("declined");
  });

  it("is cancelled when the booking is dead, whatever else is set", () => {
    expect(
      contractStatus(contract({ status: "cancelled", signed_at: "2026-05-01T00:00:00Z" })),
    ).toBe("cancelled");
  });
});
