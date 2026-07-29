// High-level Jorna API calls used by the UI.

import { ApiError, apiFetch, apiUpload } from "./api";
import type {
  BundleDetail,
  BundleRequest,
  AvailabilitySlot,
  BlockedUser,
  ConversationSummary,
  Earnings,
  EventCreateInput,
  EventItem,
  GroupMessage,
  Negotiation,
  ReportTargetType,
  StripeStatus,
  User,
  TaxonomyCategory,
  VendorBooking,
  VendorCreateInput,
  VendorUpdateInput,
  MultiBundleResponse,
  Paginated,
  Review,
  ServiceItem,
  VendorDetail,
  VendorSearchItem,
  VendorSearchParams,
  VendorAvailability,
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

/** The review for a booking, or null if the client hasn't left one yet. */
export async function getBookingReview(bookingId: string): Promise<Review | null> {
  try {
    return await apiFetch<Review>(`/reviews/booking/${bookingId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Leave a review (client only, after the booking is approved/paid; one per booking). */
export function createReview(
  bookingId: string,
  rating: number,
  comment?: string,
): Promise<Review> {
  return apiFetch<Review>("/reviews", {
    method: "POST",
    body: { booking_id: bookingId, rating, comment: comment || null },
  });
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

/**
 * Set the details a booking is missing before it can be sent.
 *
 * These are the same fields lib/planning's bookingGaps checks, and this is the
 * only place they can be written — a draft's bundle may have no event to hang
 * them on, so the booking is the durable home for them.
 */
export interface BookingUpdateInput {
  date_iso?: string | null;
  date_end?: string | null;
  guest_count?: number | null;
  time_start?: string | null;
  time_end?: string | null;
  location?: string | null;
}

export function updateBooking(
  bookingId: string,
  updates: BookingUpdateInput,
): Promise<unknown> {
  return apiFetch(`/bookings/${bookingId}`, { method: "PATCH", body: updates });
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

// ── Password reset ───────────────────────────────────────────────────

/** Email a reset link. `client=web` makes the link open the web app's reset page.
 *  Always resolves the same generic message (no user enumeration). */
export function requestPasswordReset(email: string): Promise<{ message?: string }> {
  return apiFetch<{ message?: string }>("/auth/forgot-password", {
    method: "POST",
    auth: false,
    body: { email, client: "web" },
  });
}

/** Complete a reset with the emailed token. */
export function resetPassword(token: string, newPassword: string): Promise<{ message?: string }> {
  return apiFetch<{ message?: string }>("/auth/reset-password", {
    method: "POST",
    auth: false,
    body: { token, new_password: newPassword },
  });
}

// ── Google OAuth ─────────────────────────────────────────────────────

export interface GoogleLookupResponse {
  // Present (with refresh_token) only when a Jorna account already exists or was
  // linked by email. Null when is_new_user — the client must register.
  access_token: string | null;
  refresh_token?: string | null;
  token_type: string;
  user_id: string | null;
  email: string | null;
  is_new_user: boolean;
}

/** Exchange a verified Supabase Google token for a Jorna session. No Jorna
 *  account is created here — a new identity comes back as is_new_user=true with
 *  its email, to be completed via /auth/register. */
export function googleLookup(supabaseAccessToken: string): Promise<GoogleLookupResponse> {
  return apiFetch<GoogleLookupResponse>("/auth/google/lookup", {
    method: "POST",
    auth: false,
    body: { access_token: supabaseAccessToken },
  });
}

/** Sign in with Google, creating the account on first use — the whole sign-up in
 *  one tap. Always returns a session, so `is_new_user` here only says whether the
 *  account was just made (useful for where to send them, not whether to ask for
 *  more). Idempotent, so retrying a dropped response is safe.
 *
 *  Distinct from googleLookup, which creates nothing: iOS still shows a
 *  registration form after looking up, so that endpoint has to stay pure. */
export function googleRegister(supabaseAccessToken: string): Promise<GoogleLookupResponse> {
  return apiFetch<GoogleLookupResponse>("/auth/google/register", {
    method: "POST",
    auth: false,
    body: { access_token: supabaseAccessToken },
  });
}

// ── Account (current user) ───────────────────────────────────────────

export interface MeUpdate {
  email?: string;
  f_name?: string;
  l_name?: string;
  phone?: string | null;
  location?: string;
}

/** Partial update of the signed-in user's profile. Returns the updated user. */
export function updateMe(updates: MeUpdate): Promise<User> {
  return apiFetch<User>("/me", { method: "PATCH", body: updates });
}

/** Upload a profile picture (multipart, field `file`). Returns the updated user. */
export function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<User>("/me/avatar", form, { method: "PUT" });
}

/**
 * Change password. The backend bumps token_version, so this invalidates the
 * current session — the caller should sign the user out afterwards.
 */
export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message?: string }> {
  return apiFetch<{ message?: string }>("/auth/change-password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

// ── Vendor profile ───────────────────────────────────────────────────

/**
 * The authoritative category taxonomy. Public, and read rather than hardcoded:
 * the backend rejects an invalid category/subcategory pair, so a local copy
 * that drifts would produce 400s the user can't act on.
 */
export function listVendorCategories(): Promise<{ categories: TaxonomyCategory[] }> {
  return apiFetch<{ categories: TaxonomyCategory[] }>("/vendors/categories", {
    auth: false,
  });
}

/** The signed-in user's vendor profile, or null if they aren't a vendor yet. */
export async function getMyVendor(): Promise<VendorDetail | null> {
  try {
    return await apiFetch<VendorDetail>("/vendors/me");
  } catch (err) {
    // 404 is the normal "not a vendor yet" answer, not a failure.
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function createVendor(input: VendorCreateInput): Promise<VendorDetail> {
  return apiFetch<VendorDetail>("/vendors", { method: "POST", body: input });
}

export function updateMyVendor(updates: VendorUpdateInput): Promise<VendorDetail> {
  return apiFetch<VendorDetail>("/vendors/me", { method: "PATCH", body: updates });
}

// ── Vendor services ──────────────────────────────────────────────────

export interface ServiceInput {
  name: string;
  price: number;
  experience: string;
  /** hour | day | event | person — the quantity the rate multiplies by. */
  price_unit?: string | null;
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
  negotiable?: boolean;
  /** Required for venue-category services, along with the coordinates. */
  location?: string | null;
  venue_latitude?: number | null;
  venue_longitude?: number | null;
}

export function createService(input: ServiceInput): Promise<ServiceItem> {
  return apiFetch<ServiceItem>("/services", { method: "POST", body: input });
}

export function updateService(
  serviceId: string,
  updates: Partial<ServiceInput>,
): Promise<ServiceItem> {
  return apiFetch<ServiceItem>(`/services/${serviceId}`, {
    method: "PATCH",
    body: updates,
  });
}

export function deleteService(serviceId: string): Promise<void> {
  return apiFetch<void>(`/services/${serviceId}`, { method: "DELETE" });
}

/** Upload one or more photos for a service. Multipart; field name is `files`. */
export function uploadServiceImages(
  serviceId: string,
  files: File[],
): Promise<ServiceItem> {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  return apiUpload<ServiceItem>(`/services/${serviceId}/images`, form);
}

export function deleteServiceImage(
  serviceId: string,
  imageUrl: string,
): Promise<unknown> {
  return apiFetch(
    `/services/${serviceId}/images?image_url=${encodeURIComponent(imageUrl)}`,
    { method: "DELETE" },
  );
}

// ── Vendor payments ──────────────────────────────────────────────────

/**
 * Start Stripe Connect onboarding. `client=web` makes Stripe return into this
 * app rather than the iOS deep-link bridge. Returns a hosted URL to redirect to.
 */
export function startStripeOnboarding(
  vendorId: string,
): Promise<{ onboarding_url: string }> {
  return apiFetch<{ onboarding_url: string }>(
    `/payments/vendors/${vendorId}/stripe-onboard?client=web`,
    { method: "POST" },
  );
}

/** Live status from Stripe. Clients can't pay a vendor who hasn't finished. */
export function getStripeStatus(vendorId: string): Promise<StripeStatus> {
  return apiFetch<StripeStatus>(`/payments/vendors/${vendorId}/stripe-status`);
}

export function getEarnings(vendorId: string): Promise<Earnings> {
  return apiFetch<Earnings>(`/payments/vendors/${vendorId}/earnings`);
}

// ── Moderation (report & block) ──────────────────────────────────────

// The moderation router is mounted with no prefix, so these are top-level paths
// (/reports, /blocks), not /moderation/*.
export function reportContent(input: {
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details?: string;
}): Promise<unknown> {
  return apiFetch("/reports", {
    method: "POST",
    body: { ...input, details: input.details || null },
  });
}

export function listBlockedUsers(): Promise<BlockedUser[]> {
  return apiFetch<BlockedUser[]>("/blocks");
}

export function blockUser(userId: string): Promise<unknown> {
  return apiFetch(`/blocks/${userId}`, { method: "POST" });
}

export function unblockUser(userId: string): Promise<unknown> {
  return apiFetch(`/blocks/${userId}`, { method: "DELETE" });
}

// ── Negotiation ──────────────────────────────────────────────────────

/** The booking's negotiation, or null if none has been started. */
export async function getNegotiation(bookingId: string): Promise<Negotiation | null> {
  try {
    return await apiFetch<Negotiation>(`/negotiations/booking/${bookingId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function startNegotiation(
  bookingId: string,
  amountCents: number,
  message?: string,
): Promise<Negotiation> {
  return apiFetch<Negotiation>("/negotiations", {
    method: "POST",
    body: { booking_id: bookingId, amount_cents: amountCents, message: message || null },
  });
}

export function counterOffer(
  negotiationId: string,
  amountCents: number,
  message?: string,
): Promise<Negotiation> {
  return apiFetch<Negotiation>(`/negotiations/${negotiationId}/offer`, {
    method: "POST",
    body: { amount_cents: amountCents, message: message || null },
  });
}

export function acceptOffer(negotiationId: string): Promise<Negotiation> {
  return apiFetch<Negotiation>(`/negotiations/${negotiationId}/accept`, { method: "POST" });
}

export function rejectOffer(negotiationId: string, message?: string): Promise<Negotiation> {
  return apiFetch<Negotiation>(`/negotiations/${negotiationId}/reject`, {
    method: "POST",
    body: { message: message || null },
  });
}

// ── Conversations (group chat) ───────────────────────────────────────

export function listConversations(): Promise<ConversationSummary[]> {
  return apiFetch<ConversationSummary[]>("/conversations");
}

export function getUnreadCount(): Promise<{ unread_count: number }> {
  return apiFetch<{ unread_count: number }>("/conversations/unread-count");
}

/** Newest window first (offset 0 = most recent), returned oldest→newest. */
export function getConversationMessages(
  conversationId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<{ messages: GroupMessage[]; total: number }> {
  return apiFetch<{ messages: GroupMessage[]; total: number }>(
    `/conversations/${conversationId}/messages${query({ ...params })}`,
  );
}

/** Send a message. The backend also broadcasts it over the socket. */
export function sendConversationMessage(
  conversationId: string,
  content: string,
): Promise<GroupMessage> {
  return apiFetch<GroupMessage>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { content },
  });
}

// ── Vendor availability ──────────────────────────────────────────────

export function getMyAvailability(): Promise<AvailabilitySlot[]> {
  return apiFetch<AvailabilitySlot[]>("/vendors/me/availability");
}

/**
 * A vendor's open slots over a date range — public, like the rest of browsing,
 * so the Marketplace's date filter works for a signed-out visitor. Dates are
 * "YYYY-MM-DD"; both bounds are required by the backend.
 */
export function getVendorAvailability(
  vendorId: string,
  startDate: string,
  endDate: string,
): Promise<VendorAvailability> {
  return apiFetch<VendorAvailability>(
    `/vendors/${vendorId}/availability${query({ start_date: startDate, end_date: endDate })}`,
    { auth: false },
  );
}

// ── Google Calendar ──────────────────────────────────────────────────
//
// Reading a vendor's Google-busy days has worked for a while — the days and the
// connected flag both arrive on getVendorAvailability above, which is why
// there's no wrapper here for /calendar-status: it would answer a question the
// calendar has already asked.
//
// This is the half that was missing: starting the link at all.

/**
 * The Google consent URL to send the vendor to. Their own vendor only — the
 * backend returns 403 otherwise, since completing this flow writes tokens onto
 * whichever vendor the URL names.
 *
 * `client=web` is what makes the return trip land back here. Without it the
 * backend finishes on its own bridge page, which exists to bounce the iOS app
 * open and is a dead end in a browser. Same convention as Stripe onboarding.
 */
export function getGoogleAuthUrl(vendorId: string): Promise<{ auth_url: string }> {
  return apiFetch(`/vendors/${vendorId}/google-auth${query({ client: "web" })}`);
}

// ── Card on file ─────────────────────────────────────────────────────
//
// Saved once, when a plan is sent, and charged by the backend the moment a
// vendor accepts. Nothing here charges anything.

export interface SavedCard {
  has_card: boolean;
  brand?: string | null;
  last4?: string | null;
}

/** What's on file. Brand and last four only — Stripe keeps the card. */
export function getSavedCard(): Promise<SavedCard> {
  return apiFetch<SavedCard>("/payments/card");
}

/**
 * Where to return after saving a card.
 *
 * Stripe's return URL is fixed server-side, so it can't carry a destination.
 * The page that sends you to Stripe leaves it here; the page you land on reads
 * it. sessionStorage rather than a query param because the round trip goes
 * through Stripe's domain and comes back on a URL we didn't write.
 */
export const CARD_RETURN_KEY = "jorna:card-return";

/** A Stripe-hosted page for entering card details. No charge attached. */
export function startCardSetup(): Promise<{ setup_url: string }> {
  return apiFetch("/payments/card/setup-session", { method: "POST" });
}

/**
 * Adopt whatever was just saved.
 *
 * Called on the way back from the hosted page. The backend reads Stripe rather
 * than trusting the redirect, so this is safe to call twice.
 */
export function syncSavedCard(): Promise<SavedCard> {
  return apiFetch("/payments/card/sync", { method: "POST" });
}

export function forgetSavedCard(): Promise<SavedCard> {
  return apiFetch("/payments/card", { method: "DELETE" });
}

/** Replace all weekly availability slots. Send [] to clear. */
export function setMyAvailability(slots: AvailabilitySlot[]): Promise<unknown> {
  const clean = slots.map((s) => ({
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
  }));
  return apiFetch("/vendors/me/availability", { method: "PUT", body: { slots: clean } });
}

// ── Vendor-side bookings ─────────────────────────────────────────────

export function listVendorBookings(
  vendorId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<Paginated<VendorBooking>> {
  return apiFetch<Paginated<VendorBooking>>(
    `/bookings/vendor/${vendorId}${query({ ...params })}`,
  );
}

/**
 * Approve or decline a booking request.
 *
 * Approving can fail with 409 when the vendor already has an approved or paid
 * booking on an overlapping date — one event per day. Surface that message
 * rather than a generic error.
 */
export function setBookingStatus(
  bookingId: string,
  status: "approved" | "rejected",
): Promise<unknown> {
  return apiFetch(`/bookings/${bookingId}/status`, {
    method: "PUT",
    body: { status },
  });
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

/**
 * GPS check-in at the venue. One endpoint, two meanings — the backend derives
 * your role and never trusts a client-supplied flag:
 *  • vendor — this is their half of releasing escrow (records
 *    vendor_confirmed_at). Funds still can't release until the customer
 *    confirms too (date-gated), so a vendor may check in early.
 *  • client — pure presence (records client_checked_in_at) and notifies the
 *    vendor they've arrived. It does NOT confirm the event or release funds;
 *    that stays the date-gated confirmBookingEvent.
 * Either way the caller must be within ~0.2mi of the venue anchor, and the
 * anchor comes from the bundle's live venue booking — no venue, no check-in.
 */
export function checkInBooking(
  bookingId: string,
  latitude: number,
  longitude: number,
): Promise<unknown> {
  return apiFetch(`/bookings/${bookingId}/check-in`, {
    method: "POST",
    body: { latitude, longitude },
  });
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
