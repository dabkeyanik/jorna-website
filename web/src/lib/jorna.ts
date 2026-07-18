// High-level Jorna API calls used by the UI.

import { apiFetch } from "./api";
import type {
  BundleDetail,
  BundleRequest,
  EventCreateInput,
  EventItem,
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

export function getService(serviceId: string): Promise<ServiceItem> {
  return apiFetch<ServiceItem>(`/services/${serviceId}`, { auth: false });
}

// ── Booking ──────────────────────────────────────────────────────────

export interface BookingCreateInput {
  service_id: string;
  event_name: string;
  date_iso: string;
  time_start: string;
  time_end: string;
  location: string;
  /** Multi-day events only. Per-day pricing counts the end date inclusively. */
  date_end?: string | null;
  /** Required for per-person services, or the total can't be resolved. */
  guest_count?: number | null;
  venue_latitude?: number | null;
  venue_longitude?: number | null;
  /** Omit to have the backend create a bundle for this booking. */
  bundle_id?: string | null;
}

export interface BookingCreateResult {
  message: string;
  booking_id: string;
  bundle_id: string;
  status: string;
}

/** Request a service. Creates a `pending` booking for the vendor to approve. */
export function createBooking(input: BookingCreateInput): Promise<BookingCreateResult> {
  return apiFetch<BookingCreateResult>("/bookings", { method: "POST", body: input });
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

export function renameBundle(bundleId: string, name: string): Promise<unknown> {
  return apiFetch(`/bundles/${bundleId}`, { method: "PATCH", body: { name } });
}

export function deleteBundle(bundleId: string): Promise<void> {
  return apiFetch<void>(`/bundles/${bundleId}`, { method: "DELETE" });
}

/** Take a booking out of a bundle. Returns the refreshed bundle. */
export function removeBookingFromBundle(
  bundleId: string,
  bookingId: string,
): Promise<BundleDetail> {
  return apiFetch<BundleDetail>(`/bundles/${bundleId}/bookings/${bookingId}`, {
    method: "DELETE",
  });
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

// ── Events ───────────────────────────────────────────────────────────
//
// There's no GET /events/{id}; the list is the source of detail. A booking has
// no event_id of its own either — it reaches its event through its bundle — so
// an event's bookings are assembled by matching bundles on event_id.

export function listEvents(): Promise<EventItem[]> {
  return apiFetch<EventItem[]>("/events");
}

export function createEvent(input: EventCreateInput): Promise<EventItem> {
  return apiFetch<EventItem>("/events", { method: "POST", body: input });
}

export function updateEvent(
  eventId: string,
  updates: Partial<EventCreateInput>,
): Promise<EventItem> {
  return apiFetch<EventItem>(`/events/${eventId}`, { method: "PATCH", body: updates });
}

export function deleteEvent(eventId: string): Promise<void> {
  return apiFetch<void>(`/events/${eventId}`, { method: "DELETE" });
}

// ── Escrow release ───────────────────────────────────────────────────

/**
 * Confirm the event happened. The backend derives your role (customer vs
 * vendor) from your identity. Funds release automatically once *both* sides
 * have confirmed — and never before the event's last day.
 */
export function confirmBookingEvent(bookingId: string): Promise<unknown> {
  return apiFetch(`/payments/bookings/${bookingId}/confirm`, { method: "POST" });
}

/** Full refund, available for 24 hours after payment. Customer only. */
export function refundBooking(bookingId: string): Promise<unknown> {
  return apiFetch(`/payments/bookings/${bookingId}/refund`, { method: "POST" });
}

/**
 * Freeze this one booking's funds for review. Customer only, and only while the
 * money is still held (payment_status "paid"). Siblings are unaffected.
 */
export function disputeBooking(bookingId: string, reason?: string): Promise<unknown> {
  return apiFetch(`/payments/bookings/${bookingId}/dispute`, {
    method: "POST",
    body: { reason: reason || null },
  });
}
