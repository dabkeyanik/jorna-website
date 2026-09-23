// The client (buying) app lives in a separate deployment — the jorna-website
// repo, served at book.jornaevents.com. This site is the vendor app, and its
// planning/booking routes (/book, /plan, /bundle, /bundles) were deleted when
// it was forked, so any link a *client* follows to them has to leave for the
// client app instead of 404ing here.
//
// NEXT_PUBLIC_CLIENT_APP_URL overrides the default, same env-with-fallback
// pattern as lib/flags.ts.
const CLIENT_APP_ORIGIN =
  process.env.NEXT_PUBLIC_CLIENT_APP_URL ?? "https://book.jornaevents.com";

/** An absolute URL to a page in the client app, e.g. clientAppUrl("/plan").
 *  That app also serves under a /app basePath. A client's session doesn't
 *  carry over (different origin, different localStorage), so they may be
 *  asked to sign in again there. */
export function clientAppUrl(path: string): string {
  return `${CLIENT_APP_ORIGIN}/app${path.startsWith("/") ? path : `/${path}`}`;
}
