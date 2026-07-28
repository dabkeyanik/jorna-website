"use client";

// An address turned into a map pin, free, by the US Census Bureau.
//
// A venue's coordinates were typed in by hand — two number fields, on the form
// where a vendor lists a hall. Those numbers are what GPS check-in is measured
// against, so a transposed digit doesn't look like a typo, it looks like the
// vendor never turned up. Nobody knows their venue's latitude.
//
// The Census geocoder answers this for nothing: no key, no account, no quota
// worth counting, and it's the same data the government uses for addressing. It
// is US-only, which is what this marketplace is.
//
// It's called by <script> rather than fetch, because the service sends no CORS
// header — a browser refuses to read the response, but has never refused to run
// a script. That's JSONP, and the honest cost of it is that geocoding.geo.
// census.gov gets to run code on the page for the length of one call. A .gov
// over TLS is a fair party to extend that to; a random API would not be.
//
// One-shot, not as-you-type: it runs when a vendor asks for it, so there's no
// keystroke traffic to rate-limit and nothing to debounce.

export interface GeocodeHit {
  lat: number;
  lng: number;
  /** The address as the Census matched it — worth showing back, since it may
      differ from what was typed, and that difference is the useful part. */
  matched: string;
}

const ENDPOINT = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const TIMEOUT_MS = 8000;

let seq = 0;

interface CensusResponse {
  result?: {
    addressMatches?: {
      coordinates?: { x?: number; y?: number };
      matchedAddress?: string;
    }[];
  };
}

/**
 * Look up one US address. Resolves null when there's no confident match, and
 * rejects only on a network or timeout failure — the caller distinguishes
 * "we couldn't find it" from "we couldn't ask", because the advice differs.
 */
export function geocodeUsAddress(address: string): Promise<GeocodeHit | null> {
  const query = address.trim();
  if (!query) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const callback = `__jornaGeo${++seq}`;
    const script = document.createElement("script");

    // Every exit runs this: the global and the tag are both removed, so a slow
    // reply arriving after a timeout has nothing left to call. Declared rather
    // than assigned, so it can name the timer set below it.
    function done(fn: () => void) {
      clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[callback];
      script.remove();
      fn();
    }

    (window as unknown as Record<string, unknown>)[callback] = (data: CensusResponse) => {
      const match = data?.result?.addressMatches?.[0];
      const lng = match?.coordinates?.x;
      const lat = match?.coordinates?.y;
      done(() =>
        resolve(
          typeof lat === "number" && typeof lng === "number"
            ? { lat, lng, matched: match?.matchedAddress ?? query }
            : null,
        ),
      );
    };

    const timer = setTimeout(
      () => done(() => reject(new Error("The address lookup timed out."))),
      TIMEOUT_MS,
    );

    script.onerror = () =>
      done(() => reject(new Error("Couldn't reach the address lookup service.")));

    script.src =
      `${ENDPOINT}?address=${encodeURIComponent(query)}` +
      `&benchmark=Public_AR_Current&format=jsonp&callback=${callback}`;
    document.head.appendChild(script);
  });
}
