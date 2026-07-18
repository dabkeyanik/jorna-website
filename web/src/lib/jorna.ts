// High-level Jorna API calls used by the UI.

import { apiFetch } from "./api";
import type {
  BundleDetail,
  BundleRequest,
  MultiBundleResponse,
  Paginated,
  Review,
  ServiceItem,
  VendorDetail,
  VendorSearchItem,
  VendorSearchParams,
} from "./types";

/** Generate the three comparison bundles (Budget / Balanced / Top Rated). */
export function generateBundles(req: BundleRequest): Promise<MultiBundleResponse> {
  return apiFetch<MultiBundleResponse>("/chatbot/bundles", {
    method: "POST",
    body: req,
  });
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// Browse, vendor profiles, and reviews are public — no auth — so a visitor can
// look around before creating an account.

export function searchVendors(
  params: VendorSearchParams,
): Promise<Paginated<VendorSearchItem>> {
  return apiFetch<Paginated<VendorSearchItem>>(`/vendors/search${query({ ...params })}`, {
    auth: false,
  });
}

export function getVendor(vendorId: string): Promise<VendorDetail> {
  return apiFetch<VendorDetail>(`/vendors/${vendorId}`, { auth: false });
}

export function listServices(params: {
  vendor_id?: string;
  category?: string;
  subcategory?: string;
  limit?: number;
  offset?: number;
}): Promise<Paginated<ServiceItem>> {
  return apiFetch<Paginated<ServiceItem>>(`/services${query({ ...params })}`, {
    auth: false,
  });
}

export function getVendorReviews(vendorId: string): Promise<Paginated<Review>> {
  return apiFetch<Paginated<Review>>(`/reviews/vendor/${vendorId}`, { auth: false });
}

// ── Bundles & payments (all authenticated) ───────────────────────────

/** The signed-in user's bundles. Returns full bundle objects, not summaries. */
export function listBundles(): Promise<BundleDetail[]> {
  return apiFetch<BundleDetail[]>("/bundles");
}

export function getBundle(bundleId: string): Promise<BundleDetail> {
  return apiFetch<BundleDetail>(`/bundles/${bundleId}`);
}

/** Keep one bundle from a 3-option comparison group and discard the others. */
export function selectBundle(bundleId: string): Promise<unknown> {
  return apiFetch(`/bundles/${bundleId}/select`, { method: "POST" });
}

/**
 * Start a Stripe-hosted Checkout Session for one booking. `client=web` makes
 * Stripe return into this app rather than the iOS deep-link bridge.
 */
export function createCheckoutSession(
  bookingId: string,
): Promise<{ checkout_url: string }> {
  return apiFetch<{ checkout_url: string }>(
    `/payments/bookings/${bookingId}/checkout-session?client=web`,
    { method: "POST" },
  );
}

/**
 * Reconcile a booking's payment straight from Stripe. Idempotent — a safety net
 * for a delayed webhook, called when the customer returns from Checkout.
 */
export function syncBookingPayment(bookingId: string): Promise<unknown> {
  return apiFetch(`/payments/bookings/${bookingId}/sync-payment`, { method: "POST" });
}
