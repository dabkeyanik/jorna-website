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

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key.replace(/_/g, " ");
}
