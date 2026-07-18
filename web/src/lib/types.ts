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
  // Escrow lifecycle (ISO timestamps, null until they happen).
  /** When Stripe payment succeeded. The 24h refund window runs from here. */
  paid_at?: string | null;
  customer_confirmed_at?: string | null;
  vendor_confirmed_at?: string | null;
  funds_released_at?: string | null;
}

/** How long after paying a full refund is still available. */
export const REFUND_WINDOW_HOURS = 24;

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
export function eventHasPassed(dateIso?: string | null): boolean {
  if (!dateIso || dateIso === "TBD") return false;
  const day = Date.parse(`${dateIso}T23:59:59Z`);
  if (Number.isNaN(day)) return false;
  return Date.now() > day;
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
