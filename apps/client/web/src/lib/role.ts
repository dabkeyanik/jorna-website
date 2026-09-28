"use client";

// Which set of tabs you get: vendors see a seller's app, clients a planner's.
//
// "Has a vendor profile" (getMyVendor != null) is the same signal iOS uses
// (vendorID != nil). Cached because the navigation now renders twice — header
// on desktop, tab bar on phones, both mounted — and without this each copy
// would ask independently. Same shape as lib/attention's cache, for the same
// reason.

import { getMyVendor } from "./jorna";

const TTL_MS = 60_000;
let cache: { at: number; isVendor: boolean } | null = null;
let inflight: Promise<boolean> | null = null;

export function loadIsVendor(): Promise<boolean> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.isVendor);
  if (inflight) return inflight;
  inflight = getMyVendor()
    .then((v) => v != null)
    .catch(() => false)
    .then((isVendor) => {
      cache = { at: Date.now(), isVendor };
      return isVendor;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Called when a session ends, so the next sign-in doesn't inherit this role. */
export function clearRoleCache() {
  cache = null;
}
