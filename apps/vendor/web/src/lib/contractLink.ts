/** The no-login link a client uses to fill in, sign and pay a contract —
 *  the token is the whole credential (see /booking-link). */
export function guestBookingLink(token: string): string {
  // basePath is "/app" (next.config.ts) and doesn't rewrite a plain string
  // the way it rewrites next/link — same convention as home/page.tsx's own
  // literal "/app" prefix.
  return `${window.location.origin}/app/booking-link?t=${token}`;
}
