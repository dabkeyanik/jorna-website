/** The no-login link a client uses to fill in, sign and pay a contract —
 *  the token is the whole credential (see /booking-link). */
export function guestBookingLink(token: string): string {
  // basePath is "/app" (next.config.ts) and doesn't rewrite a plain string
  // the way it rewrites next/link — same convention as home/page.tsx's own
  // literal "/app" prefix.
  return `${window.location.origin}/app/booking-link?t=${token}`;
}

/** What to tell the vendor after sending with "email it to them": the
 *  backend's email_sent says whether the email actually went (false when
 *  email isn't set up or the provider refused it). Only a true claims an
 *  email; anything else doesn't say either way. */
export function emailNotice(emailSent: boolean | null | undefined, to: string | null | undefined): string {
  const who = to || "your client";
  if (emailSent === true) return `Sent — we emailed the link to ${who}.`;
  if (emailSent === false) {
    return `Sent — but we couldn't email ${who}. Copy the link and send it yourself; the date is held either way.`;
  }
  return "Sent. Copy the link if you'd like to send it yourself too.";
}

/** The vendor's own "View as client" — the same page, but opening it
 *  doesn't mark the contract as seen by the client. */
export function guestBookingPreviewLink(token: string): string {
  return `${guestBookingLink(token)}&preview=1`;
}

/** An addendum or cancellation agreement's own link — same page, its own
 *  token (?d=), never the contract's. */
export function guestDocumentLink(token: string): string {
  return `${window.location.origin}/app/booking-link?d=${token}`;
}

export function guestDocumentPreviewLink(token: string): string {
  return `${guestDocumentLink(token)}&preview=1`;
}
