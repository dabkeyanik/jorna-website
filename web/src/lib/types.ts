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
  location?: string | null;
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

/** Human label for a price unit, e.g. "per person"; "" for flat/event pricing. */
export function priceUnitLabel(unit?: string | null): string {
  if (!unit) return "";
  const u = unit.toLowerCase().replace(/^per\s+/, "").trim();
  if (u === "event" || u === "flat") return "";
  return `per ${u}`;
}
