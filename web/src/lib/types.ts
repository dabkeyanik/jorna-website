// API types mirroring the Jorna FastAPI backend. Kept intentionally close to the
// backend Pydantic schemas so responses decode without transformation.

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  user_id: string;
  email: string;
  username: string;
  f_name?: string | null;
  l_name?: string | null;
  phone?: string | null;
  location?: string | null;
  pfp_url?: string | null;
}

// ── AI bundle builder ────────────────────────────────────────────────

export interface BundleItem {
  category: string;
  vendor_id?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  vendor_name: string;
  pfp_url?: string | null;
  price_min: number;
  price_max: number;
  rating: number;
  match_reason: string;
}

export interface Bundle {
  items: BundleItem[];
  estimated_total_min: number;
  estimated_total_max: number;
  unfilled_categories?: string[];
}

export interface BundleOption {
  label: string;
  description: string;
  factors: string[];
  bundle: Bundle;
  // The backend also returns `state` (opaque) and an optional `bundle_id`.
  bundle_id?: string | null;
}

export interface MultiBundleResponse {
  options: BundleOption[];
}

export interface DateRange {
  start?: string | null;
  end?: string | null;
}

export interface BundleRequest {
  needed_categories?: string[];
  booked_categories?: string[];
  event_date?: string | null;
  date_range?: DateRange | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  guest_count?: number | null;
  /** "HH:MM". Optional — without them every generated booking is TBD, and
      availability falls back to whole days. */
  time_start?: string | null;
  time_end?: string | null;
  budget_tier?: string | null;
  budget_amount?: string | null;
  style?: string[];
  preferences?: string[];
}

// The 10 chatbot bundle categories (slot keys) with display labels.
export const CATEGORY_LABELS: Record<string, string> = {
  venue: "Venue",
  catering: "Catering",
  photography: "Photography",
  videography: "Videography",
  dj: "DJ",
  dhol: "Dhol",
  floral_decor: "Floral & Decor",
  makeup: "Makeup & Hair",
  mehndi: "Mehndi",
  cultural_services: "Cultural Services",
};

// DB-level vendor categories (what /vendors/search rows carry) → display labels.
// A search row's `category` is the DB category (e.g. "music_entertainment"),
// not the bundle slot key ("dj"), so both maps are consulted.
const DB_CATEGORY_LABELS: Record<string, string> = {
  music_entertainment: "Music & Entertainment",
  beauty: "Beauty",
};

export function categoryLabel(key: string): string {
  return (
    CATEGORY_LABELS[key] ??
    DB_CATEGORY_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ── Browse / vendors ─────────────────────────────────────────────────

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** A row from /vendors/search — one vendor paired with one of their services. */
export interface VendorSearchItem {
  vendor_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  category: string;
  service_name?: string | null;
  service_price?: number | null;
  distance_miles?: number | null;
  rating?: number | null;
  location?: string | null;
  pfp_url?: string | null;
  travel_radius_miles?: number | null;
  open_to_long_distance?: boolean;
  tags?: string[];
}

export interface VendorDetail {
  vendor_id: string;
  user_id: string;
  bio?: string | null;
  category?: string | null;
  subcategory?: string | null;
  rating?: number | null;
  num_events?: number | null;
  travel_radius_miles?: number | null;
  open_to_long_distance?: boolean;
  open_to_price_negotiation?: boolean;
  f_name?: string | null;
  l_name?: string | null;
  location?: string | null;
  pfp_url?: string | null;
  email?: string | null;
  phone?: string | null;
  instagram_username?: string | null;
  tags?: string[];
}

export interface ServiceItem {
  service_id: string;
  vendor_id: string;
  name: string;
  price: number;
  price_unit?: string | null;
  experience?: string | null;
  media?: string[];
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
  negotiable?: boolean;
  // Venue services carry an address + map pin; the event's check-in anchor is
  // derived from the venue booking, so these get mirrored onto the booking.
  location?: string | null;
  venue_latitude?: number | null;
  venue_longitude?: number | null;
  vendor_name?: string | null;
  vendor_rating?: number | null;
  vendor_pfp_url?: string | null;
}

export interface Review {
  review_id: string;
  vendor_id: string;
  user_id: string;
  rating: number;
  comment?: string | null;
  created_at?: string | null;
}

export interface VendorSearchParams {
  category?: string;
  subcategory?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  sort_by?: string;
  state?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

// ── Bundles & bookings ───────────────────────────────────────────────

export interface BundleEventInfo {
  event_id: string;
  name: string;
  date_iso?: string | null;
  location?: string | null;
  guest_count?: number | null;
}

export interface BundleBooking {
  booking_id: string;
  status: string;
  payment_status?: string | null;
  date_iso?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  location?: string | null;
  service_name?: string | null;
  service_category?: string | null;
  service_subcategory?: string | null;
  vendor_name?: string | null;
  vendor_id?: string | null;
  price: number;
  amount_cents?: number | null;
  price_unit?: string | null;
  /** True when the total still needs a quantity (guests/dates) before paying. */
  price_pending_quantity?: boolean;
  // Quantity a rate-priced service multiplies by — carried across on a swap so
  // the replacement booking stays payable.
  date_end?: string | null;
  guest_count?: number | null;
  /** Whether this service is open to price negotiation (service.negotiable). */
  open_to_price_negotiation?: boolean;
  // Escrow lifecycle (ISO timestamps, null until they happen).
  /** When Stripe payment succeeded. The 24h refund window runs from here. */
  paid_at?: string | null;
  customer_confirmed_at?: string | null;
  vendor_confirmed_at?: string | null;
  funds_released_at?: string | null;
  // GPS venue check-ins — presence, not escrow. Neither releases funds; that's
  // customer_confirmed_at / vendor_confirmed_at.
  vendor_checked_in_at?: string | null;
  client_checked_in_at?: string | null;
  // Whether the client may send this vendor their check-in email again, decided
  // by the same backend function the endpoint enforces — so the button is never
  // offered for a call that has to be refused. The reason is what to say when
  // it isn't offered.
  can_resend_checkin?: boolean;
  resend_checkin_reason?: string | null;
  /** When this vendor was last emailed about checking in, scheduled or asked for. */
  checkin_reminded_at?: string | null;
}

/** How long after paying a full refund is still available. */
export const REFUND_WINDOW_HOURS = 24;

/**
 * How long after the event escrow releases on its own.
 *
 * Mirrors the backend's AUTO_RELEASE_DAYS. Confirming needs both parties, so a
 * client who never gets round to it used to hold their vendor's payment
 * indefinitely; after this long, not answering is taken as no objection.
 */
export const AUTO_RELEASE_DAYS = 7;

/** Whether the event's first day has arrived. */
export function eventHasStarted(b: { date_iso?: string | null }): boolean {
  if (!b.date_iso || b.date_iso === "TBD") return false;
  const start = Date.parse(`${b.date_iso}T00:00:00Z`);
  return !Number.isNaN(start) && Date.now() >= start;
}

/**
 * Whether this booking can be confirmed for escrow release yet.
 *
 * Mirrors the backend's event_confirmable_date, which has two routes. The
 * scheduled one: the booking's last day has passed. And the one that follows
 * the work instead of the calendar — the event has started and the vendor has
 * checked in at the venue.
 *
 * That second route exists because a booking runs to the time it was written
 * down for and a job frequently doesn't. Waiting out a three-day window to
 * settle up with someone who finished on the first afternoon is waiting on a
 * date, not on anything happening. A GPS check-in is the vendor's own evidence
 * they turned up, so it's what the day is allowed to turn on.
 *
 * Both halves of that route are needed: a vendor can check in early — dropping
 * equipment off the night before — and that isn't the event taking place.
 */
export function canConfirmBooking(b: {
  date_iso?: string | null;
  date_end?: string | null;
  vendor_checked_in_at?: string | null;
}): boolean {
  if (eventIsOver(b)) return true;
  return Boolean(b.vendor_checked_in_at) && eventHasStarted(b);
}

/** The date escrow releases itself, or null when there's no date to count from. */
export function autoReleaseOn(b: {
  date_iso?: string | null;
  date_end?: string | null;
}): string | null {
  const last = lastDay(b);
  if (!last || last === "TBD") return null;
  const d = new Date(`${last}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + AUTO_RELEASE_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse a timestamp from the API to epoch ms, or null if unusable.
 *
 * These come from Python's `datetime.isoformat()`. The values are written as
 * UTC, but the columns aren't timezone-aware, so a round-trip may hand back
 * either "…T10:00:00+00:00" or a bare "…T10:00:00". Naive strings are read as
 * UTC; anything already carrying Z or ±HH:MM is left alone (appending "Z" to
 * an offset would produce an unparseable string).
 */
export function parseServerTime(ts?: string | null): number | null {
  if (!ts) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(ts);
  const parsed = Date.parse(hasZone ? ts : `${ts}Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

/** True while the booking is still inside its 24h post-payment refund window. */
export function withinRefundWindow(paidAt?: string | null): boolean {
  const paid = parseServerTime(paidAt);
  if (paid === null) return false;
  return Date.now() - paid < REFUND_WINDOW_HOURS * 3600 * 1000;
}

/**
 * Whether the event is far enough along to confirm. Mirrors the backend's
 * event_confirmable_date: funds never release before the event's last day, and
 * a TBD date isn't confirmable at all.
 */
/** A check-in timestamp as a short local date + time. Check-ins are stored as
 *  ISO strings; an unparseable one degrades to a vague word rather than "NaN". */
export function formatCheckInTime(iso?: string | null): string {
  if (!iso) return "already";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "already"
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export function eventHasPassed(dateIso?: string | null): boolean {
  if (!dateIso || dateIso === "TBD") return false;
  const day = Date.parse(`${dateIso}T23:59:59Z`);
  if (Number.isNaN(day)) return false;
  return Date.now() > day;
}

/** When a booking finishes: its end date if it spans days, else its date. */
export function lastDay(b: {
  date_iso?: string | null;
  date_end?: string | null;
}): string | null | undefined {
  return b.date_end || b.date_iso;
}

/**
 * Whether a booking is over, which is the gate on confirming it for escrow
 * release.
 *
 * The backend's event_confirmable_date measures the LAST day, so a Friday-to-
 * Sunday booking isn't confirmable on the Saturday. This was written out by
 * hand in five places and one of them said `date_iso` — which offered the
 * client "Confirm & release" partway through their own multi-day event, and
 * got them a refusal naming a date the same screen hadn't mentioned. It's a
 * function now so there's nothing left to mistype.
 */
export function eventIsOver(b: {
  date_iso?: string | null;
  date_end?: string | null;
}): boolean {
  return eventHasPassed(lastDay(b));
}

export interface BundleDetail {
  bundle_id: string;
  user_id: string;
  name: string;
  event_name?: string | null;
  status: string;
  event_id?: string | null;
  event?: BundleEventInfo | null;
  bookings: BundleBooking[];
  booking_count: number;
  total_estimated_cost: number;
  status_breakdown?: Record<string, number>;
  created_at?: string | null;
  updated_at?: string | null;
}

// ── Vendor taxonomy & profile ────────────────────────────────────────

export interface TaxonomyOption {
  value: string;
  label: string;
}

export interface TaxonomyCategory extends TaxonomyOption {
  subcategories: TaxonomyOption[];
}

export interface VendorCreateInput {
  bio: string;
  category: string;
  subcategory?: string | null;
}

export interface VendorUpdateInput {
  bio?: string;
  category?: string;
  subcategory?: string | null;
  travel_radius_miles?: number | null;
  open_to_long_distance?: boolean;
  open_to_price_negotiation?: boolean;
  open_to_location_negotiation?: boolean;
  instagram_username?: string | null;
}

// ── Moderation ───────────────────────────────────────────────────────

export const REPORT_REASONS = [
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "scam", label: "Scam or fraud" },
  { value: "other", label: "Something else" },
];

export type ReportTargetType = "user" | "vendor" | "review" | "message" | "conversation";

export interface BlockedUser {
  blocked_user_id: string;
  blocked_name: string;
  blocked_vendor_id?: string | null;
}

// ── Negotiation ──────────────────────────────────────────────────────

export interface NegotiationOffer {
  offer_id?: string;
  amount_cents: number;
  proposed_by: string;
  proposed_by_name?: string | null;
  message?: string | null;
  created_at?: string | null;
}

export interface Negotiation {
  negotiation_id: string;
  booking_id: string;
  /** open | accepted | rejected */
  status: string;
  current_offer_cents: number;
  current_offer_dollars?: number;
  /** Whoever made the current offer — the *other* party responds. */
  proposed_by: string;
  proposed_by_name?: string | null;
  offers?: NegotiationOffer[];
  created_at?: string | null;
  updated_at?: string | null;
}

// ── Conversations (group chat) ───────────────────────────────────────

export interface GroupMessage {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string | null;
  sender_pfp?: string | null;
  content: string;
  created_at: string;
  read_by?: string[];
}

export interface ConversationSummary {
  conversation_id: string;
  bundle_id?: string | null;
  name?: string | null;
  /** all_parties | vendors_only */
  type?: string | null;
  member_count?: number;
  members?: Array<{ user_id: string; name?: string | null; pfp_url?: string | null }>;
  last_message?: {
    message_id?: string;
    content?: string | null;
    sender_id?: string | null;
    sender_name?: string | null;
    created_at?: string | null;
  } | null;
  created_at?: string | null;
}

// ── Vendor availability ──────────────────────────────────────────────

/** A weekly availability window. day_of_week: 0=Monday … 6=Sunday. */
export interface AvailabilitySlot {
  availability_id?: string;
  day_of_week: number;
  start_time: string; // "HH:MM"
  end_time: string;
}

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * GET /vendors/{id}/availability — a vendor's published hours plus the times
 * they're already taken, over a queried date range.
 *
 * The backend declares no response schema for this endpoint, so these fields
 * are inferred from live responses (all empty at the time of writing) and are
 * deliberately loose. lib/availability reads them defensively and fails open.
 */
export interface VendorAvailability {
  vendor_id?: string;
  /** Published working hours, keyed by day-of-week or ISO date depending on the backend. */
  baseline_hours_map?: Record<string, unknown>;
  internal_busy_times?: unknown[];
  google_busy_times?: unknown[];
  google_calendar_connected?: boolean;
  google_calendar_error?: string | null;
}

// ── Vendor-side bookings ─────────────────────────────────────────────

/** A booking as the vendor sees it (the fuller `_booking_dict` payload). */
export interface VendorBooking {
  booking_id: string;
  user_id: string;
  client_name?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  service_category?: string | null;
  service_subcategory?: string | null;
  price: number;
  price_unit?: string | null;
  price_pending_quantity?: boolean;
  guest_count?: number | null;
  bundle_id?: string | null;
  event_name?: string | null;
  date_iso?: string | null;
  date_end?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  location?: string | null;
  venue_latitude?: number | null;
  venue_longitude?: number | null;
  /** The point check-in is measured against: the venue's pin, or the event's
      own address when no venue is booked. Gate the button on this, not on
      venue_latitude — the server resolves it the same way. */
  checkin_latitude?: number | null;
  checkin_longitude?: number | null;
  status: string;
  payment_status?: string | null;
  amount_cents?: number | null;
  negotiable?: boolean;
  paid_at?: string | null;
  customer_confirmed_at?: string | null;
  vendor_confirmed_at?: string | null;
  funds_released_at?: string | null;
  vendor_checked_in_at?: string | null;
  client_checked_in_at?: string | null;
}

// ── Vendor payments ──────────────────────────────────────────────────

export interface StripeStatus {
  stripe_account_id?: string | null;
  stripe_onboarding_complete: boolean;
}

export interface EarningsEntry {
  booking_id: string;
  event_name?: string | null;
  client_name?: string | null;
  amount_cents: number;
  platform_fee_cents: number;
  /** What actually reaches the vendor: amount minus the platform fee. */
  net_cents: number;
  payment_status?: string | null;
  paid_at?: string | null;
  funds_released_at?: string | null;
}

export interface Earnings {
  vendor_id: string;
  total_released_cents: number;
  in_escrow_cents: number;
  upcoming_cents: number;
  upcoming_count: number;
  disputed_cents: number;
  refunded_cents: number;
  platform_fees_cents: number;
  history: EarningsEntry[];
}

// ── Events ───────────────────────────────────────────────────────────

export interface EventItem {
  event_id: string;
  user_id: string;
  name: string;
  date_iso?: string | null;
  location?: string | null;
  event_type?: string | null;
  description?: string | null;
  guest_count?: number | null;
  budget?: number | null;
  services_needed?: string[] | null;
  /** The event's check-in anchor, derived from its live venue booking. */
  venue_latitude?: number | null;
  venue_longitude?: number | null;
}

export interface EventCreateInput {
  name: string;
  date_iso: string;
  location: string;
  event_type?: string | null;
  description?: string | null;
  guest_count?: number | null;
  budget?: number | null;
  services_needed?: string[] | null;
  // Where `location` actually is, so a plan held somewhere the client arranged
  // themselves can still be checked into. Distinct from the event's
  // venue_latitude/longitude, which the backend derives from a booked venue and
  // clears when that venue goes — these are the client's and survive it.
  address_latitude?: number | null;
  address_longitude?: number | null;
}

/** Booking lifecycle labels. Mirrors the backend BookingStatus values. */
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting vendor",
  negotiation_ongoing: "Negotiating",
  approved: "Approved",
  rejected: "Declined",
  payment_confirmed: "Paid",
};

/** Escrow states. Mirrors the backend payment_status values. */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Not paid",
  processing: "Processing",
  paid: "Held in escrow",
  released: "Released to vendor",
  refunded: "Refunded",
  disputed: "Disputed",
};

/**
 * What quantity a service's rate is multiplied by. The booking must capture
 * that quantity up front or its total can't be resolved and checkout refuses
 * (see resolve_total_cents / price_pending_quantity on the backend).
 */
export type PriceUnitKind = "person" | "day" | "hour" | "event";

export function priceUnitKind(unit?: string | null): PriceUnitKind {
  if (!unit) return "event";
  const u = unit.toLowerCase().replace(/^per\s+/, "").trim();
  return u === "person" || u === "day" || u === "hour" ? u : "event";
}

/** Human label for a price unit, e.g. "per person"; "" for flat/event pricing. */
export function priceUnitLabel(unit?: string | null): string {
  if (!unit) return "";
  const u = unit.toLowerCase().replace(/^per\s+/, "").trim();
  if (u === "event" || u === "flat") return "";
  return `per ${u}`;
}

// ── What a booking's price figure actually is ────────────────────────
//
// `price` on a booking holds two different things over its life. While the
// quantity is unknown it's the rate — $38, captioned "per person". Once the
// guest count arrives the backend resolves the same field to the total, and
// $7,600 kept the caption "per person": a head price read as forty times too
// large, on the screen where you decide whether to pay it.
//
// The caption has to follow the figure, so it's derived from the same data
// rather than from the unit alone.

/** Fields any priced booking carries — bundle-side and vendor-side alike. */
export interface PricedBooking {
  price: number;
  price_unit?: string | null;
  price_pending_quantity?: boolean;
  guest_count?: number | null;
  date_iso?: string | null;
  date_end?: string | null;
  time_start?: string | null;
  time_end?: string | null;
}

/** Nights are counted inclusively, matching the backend's day arithmetic. */
function dayCount(startIso?: string | null, endIso?: string | null): number | null {
  if (!startIso || startIso === "TBD") return null;
  const last = endIso && endIso !== "TBD" ? endIso : startIso;
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${last}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 86400000) + 1;
}

/** A window that ends before it starts has crossed midnight, not gone backwards. */
function hourCount(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) return null;
  let hours = eh + em / 60 - (sh + sm / 60);
  if (hours <= 0) hours += 24;
  return hours > 0 && hours <= 24 ? Math.round(hours * 100) / 100 : null;
}

/** The quantity a rate was multiplied by, or null when it can't be read. */
export function priceQuantity(b: PricedBooking): { count: number; noun: string } | null {
  const one = (n: number, noun: string) => ({ count: n, noun: n === 1 ? noun : `${noun}s` });
  switch (priceUnitKind(b.price_unit)) {
    case "person": {
      const guests = b.guest_count ?? 0;
      return guests > 0 ? one(guests, "guest") : null;
    }
    case "day": {
      const days = dayCount(b.date_iso, b.date_end);
      return days ? one(days, "day") : null;
    }
    case "hour": {
      const hours = hourCount(b.time_start, b.time_end);
      return hours ? one(hours, "hour") : null;
    }
    default:
      return null;
  }
}

export interface PriceLine {
  /** The figure to show. */
  amount: number;
  /** What it is: "per person", "Total · 200 guests", or "" for flat pricing. */
  caption: string;
  /** True when `amount` is a resolved total rather than a rate. */
  isTotal: boolean;
}

/**
 * The figure and its caption, kept in agreement.
 *
 * The rate is deliberately not recovered by dividing the total: money() rounds
 * to whole dollars, so a $37.50 head price would print "$38 × 200" beside a
 * total of $7,500 and the two wouldn't reconcile. A sum that doesn't add up is
 * worse than one that isn't shown, so the quantity is named instead — which is
 * the part worth checking anyway, and the part the app can state exactly.
 *
 * When `price_pending_quantity` is absent the quantity stands in for it: a rate
 * unit with nothing to multiply by hasn't been resolved.
 */
export function priceLine(b: PricedBooking): PriceLine {
  if (priceUnitKind(b.price_unit) === "event") {
    return { amount: b.price, caption: "", isTotal: true };
  }
  const quantity = priceQuantity(b);
  if (b.price_pending_quantity ?? quantity == null) {
    return { amount: b.price, caption: priceUnitLabel(b.price_unit), isTotal: false };
  }
  const count = quantity
    ? `${Number.isInteger(quantity.count) ? quantity.count.toLocaleString() : quantity.count} ${quantity.noun}`
    : null;
  return { amount: b.price, caption: count ? `Total · ${count}` : "Total", isTotal: true };
}

// ── Guest lists ──────────────────────────────────────────────────────
//
// A celebration here is usually several gatherings with different guest lists,
// and the number that matters is per gathering: a caterer bills against the
// headcount for the function they're working, not for the week.

/** One gathering within a celebration — a mehndi, a sangeet, a reception. */
export interface EventFunction {
  function_id: string;
  event_id: string;
  name: string;
  /** Its own day and hours. Null falls back to the celebration's. */
  date_iso?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  location?: string | null;
  sort_order: number;
}

/** What a guest said about one function. */
export interface GuestInvite {
  function_id: string;
  status: "no_reply" | "attending" | "declined";
  /** What they actually committed to, which isn't always what was expected. */
  attending_count?: number | null;
  responded_at?: string | null;
}

/**
 * Somebody invited — a person or a household. One row per invitation rather
 * than per body: "the Kapoor family, 4" is how a list is kept.
 */
export interface Guest {
  guest_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  /** How many the host expects under this name. */
  party_size: number;
  note?: string | null;
  /** Arrived through the shared link rather than being added by the host. */
  self_added: boolean;
  /** Their own link. Sending it is how they get to reply. */
  token: string;
  invites: GuestInvite[];
}

/** What the replies add up to, per function. */
export interface FunctionHeadcount {
  function_id: string;
  name: string;
  date_iso?: string | null;
  /** Invitations, not people. */
  invited: number;
  /** People. An attending_count where given, otherwise the party size. */
  attending: number;
  declined: number;
  no_reply: number;
  /** What the host put down — the figure a plan is usually built against. */
  expected: number;
}

export interface GuestList {
  functions: EventFunction[];
  guests: Guest[];
  headcount: FunctionHeadcount[];
  /** The shared link's token, or null when there isn't one out there. */
  invite_link: string | null;
}

/** The invitation a link opens. Bounded by what an invitation should say. */
export interface Invitation {
  event_name: string;
  functions: EventFunction[];
  location?: string | null;
  date_iso?: string | null;
  /** Null when the link is the shared one and the reader is nobody yet. */
  guest: {
    name: string;
    party_size: number;
    replies: { function_id: string; status: string; attending_count?: number | null }[];
  } | null;
}

export interface RsvpReply {
  function_id: string;
  status: "attending" | "declined";
  attending_count?: number | null;
}

/**
 * The gap between what a function is planned for and what people have said.
 *
 * Deliberately reports rather than decides. A vendor booked for two hundred is
 * holding a promise, not a variable — so this is the difference the host looks
 * at, not a number anything changes on its own.
 */
export function headcountGap(
  counts: FunctionHeadcount,
  plannedFor?: number | null,
): { delta: number; settled: boolean } | null {
  if (plannedFor == null || plannedFor <= 0) return null;
  return {
    delta: counts.attending - plannedFor,
    // Everyone has answered, so the number won't move on its own.
    settled: counts.no_reply === 0 && counts.invited > 0,
  };
}
