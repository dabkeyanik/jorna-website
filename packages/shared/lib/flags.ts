// Build-time feature flags. Static export (no SSR), so these are baked in
// at build time — same NEXT_PUBLIC_*-with-fallback pattern as sentry.ts and
// firebaseConfig.ts.

// Mirrors the backend's ESCROW_ENABLED (Desiconnect/server/app/config.py) —
// see docs/DECISIONS.md's "Escrow disabled for the MVP" entry. Off for the
// MVP: Venmo/Zelle is the only payment option shown anywhere a vendor sets
// one up or a client sees one.
export const ESCROW_ENABLED = process.env.NEXT_PUBLIC_ESCROW_ENABLED !== "false";

// Web push. Off until it's switched back on: the backend's Firebase
// credentials were removed from production on 2026-09-29 (no devices were
// registered), so an opt-in would register a browser that never hears
// anything. Turning it back on needs FIREBASE_CREDENTIALS_JSON on the backend
// first (jorna-backend docs/STAGING.md), then NEXT_PUBLIC_PUSH_ENABLED=true here.
export const PUSH_ENABLED = process.env.NEXT_PUBLIC_PUSH_ENABLED === "true";
