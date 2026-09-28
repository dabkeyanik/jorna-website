// Contracts are signed on the vendor site's no-login page, not here: an
// accepted request becomes a contract the client reads and signs at
// jornaevents.com/app/booking-link (backend DECISIONS.md #17). This app
// only links to it and holds back "I sent payment" until it's signed.
//
// NEXT_PUBLIC_VENDOR_APP_URL overrides the default, the same
// env-with-fallback pattern as lib/api.ts.

import type { BundleBooking } from "./types";

const VENDOR_APP_ORIGIN = process.env.NEXT_PUBLIC_VENDOR_APP_URL ?? "https://jornaevents.com";

export function contractSignUrl(token: string): string {
  return `${VENDOR_APP_ORIGIN}/app/booking-link?t=${encodeURIComponent(token)}`;
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
