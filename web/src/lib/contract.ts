// Contracts are signed on the vendor site's no-login page, not here: an
// accepted request becomes a contract the client reads and signs at
// jornaevents.com/app/booking-link (backend DECISIONS.md #17). This app
// links there to sign, then shows the signed contract (/contract) and its
// payments itself.
//
// NEXT_PUBLIC_VENDOR_APP_URL overrides the default, the same
// env-with-fallback pattern as lib/api.ts.

import type { BundleBooking, Installment } from "./types";

const VENDOR_APP_ORIGIN = process.env.NEXT_PUBLIC_VENDOR_APP_URL ?? "https://jornaevents.com";

export function contractSignUrl(token: string): string {
  return `${VENDOR_APP_ORIGIN}/app/booking-link?t=${encodeURIComponent(token)}`;
}

/** This app's own read-only page for a contract. */
export function contractViewPath(token: string): string {
  return `/contract?t=${encodeURIComponent(token)}`;
}

/** Where a booking's contract stands, as far as the client has anything to
 *  do: "sign" (it's waiting on them), "expired" (it lapsed unsigned), or
 *  null — no contract, or nothing left to sign. */
export function contractStep(b: BundleBooking): "sign" | "expired" | null {
  if (!b.contract_token || b.signed_at) return null;
  if (b.contract_status === "sent" || b.contract_status === "viewed") return "sign";
  if (b.contract_status === "expired") return "expired";
  return null;
}

/** "received" and "sent" are settled from the client's side; the other three
 *  are still theirs to pay, by when. */
export type PaymentState = "received" | "sent" | "overdue" | "due" | "upcoming";

export interface PaymentRow {
  installment: Installment;
  state: PaymentState;
  /** The date it's due, "YYYY-MM-DD" — null until the contract is signed. */
  due: string | null;
}

/** Today as a UTC calendar day: the backend's due dates and reminders are
 *  UTC days (DECISIONS.md #18), so "due today" has to be read the same way. */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Each payment on a signed contract and where it stands. Empty when the
 *  booking has no schedule (it pays in one go) or nothing is owed yet.
 *  Takes a plan's booking or a contract read by its link alike. */
export function paymentRows(
  b: Pick<BundleBooking, "signed_at" | "payment_schedule">,
  today: string = utcToday(),
): PaymentRow[] {
  if (!b.signed_at || !b.payment_schedule?.length) return [];
  return b.payment_schedule.map((installment) => {
    const due = installment.effective_due ?? null;
    let state: PaymentState;
    if (installment.confirmed_at) state = "received";
    else if (installment.marked_paid_at) state = "sent";
    else if (due && today > due) state = "overdue";
    else if (due && today === due) state = "due";
    else state = "upcoming";
    return { installment, state, due };
  });
}

/** The first payment the client still has to send, or null. */
export function nextPayment(
  b: Pick<BundleBooking, "signed_at" | "payment_schedule">,
  today: string = utcToday(),
): PaymentRow | null {
  return paymentRows(b, today).find((r) => r.state !== "received" && r.state !== "sent") ?? null;
}

/** Exact money for a payment: cents are shown when there are any, since
 *  "send $1,333" for a $1,333.33 installment is a wrong instruction. */
export function centsMoney(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The line under a payment: what the client needs to know about it now. */
export function describePayment(row: PaymentRow, vendor: string): string {
  switch (row.state) {
    case "received":
      return `Received by ${vendor}`;
    case "sent":
      return `Sent — waiting for ${vendor} to confirm`;
    case "overdue":
      return `Was due ${shortDate(row.due!)}`;
    case "due":
      return "Due today";
    default:
      return row.due ? `Due ${shortDate(row.due)}` : "Due once signed";
  }
}
