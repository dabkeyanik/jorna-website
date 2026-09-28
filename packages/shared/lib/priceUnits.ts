// What a price is "per" — the one piece of the pricing model both apps need
// word for word. Lives here so it can't drift between them; each app's
// lib/types re-exports it.

/**
 * What quantity a service's rate is multiplied by. The booking must capture
 * that quantity up front or its total can't be resolved and checkout refuses
 * (see resolve_total_cents / price_pending_quantity on the backend).
 */
export type PriceUnitKind = "person" | "day" | "hour" | "event" | "performer";

/**
 * What quantity a rate multiplies by.
 *
 * Mirrors the backend's _normalize_unit exactly, because price_unit is free text
 * a vendor types and that function is what actually prices the booking. This
 * used to match only "person", "day" and "hour", so a caterer priced "per head"
 * read as flat-rate here — no guest count demanded before sending, no total
 * resolvable at checkout, and a vendor holding an accepted booking nobody could
 * pay for.
 */
export function priceUnitKind(unit?: string | null): PriceUnitKind {
  if (!unit) return "event";
  let u = unit.trim().toLowerCase();
  if (u.startsWith("per ")) u = u.slice(4).trim();
  if (u.startsWith("hour")) return "hour";
  if (u.startsWith("day")) return "day";
  if (u.startsWith("event")) return "event";
  if (
    u.startsWith("performer") ||
    ["dancer", "dancers", "entertainer", "entertainers"].includes(u)
  ) {
    return "performer";
  }
  if (u.startsWith("person") || ["head", "plate", "guest", "pax"].includes(u)) {
    return "person";
  }
  return "event";
}

/** Human label for a price unit, e.g. "per person"; "" for flat/event pricing. */
export function priceUnitLabel(unit?: string | null): string {
  if (!unit) return "";
  const u = unit.toLowerCase().replace(/^per\s+/, "").trim();
  if (u === "event" || u === "flat") return "";
  return `per ${u}`;
}
