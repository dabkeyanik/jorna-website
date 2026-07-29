"use client";

// US ZIP → city and state, with no API behind it.
//
// The address form asks for five things and four of them are facts about the
// fifth: give it a ZIP and the city and state follow. Typing them separately is
// how "60201, Chicago, IL" gets saved and a vendor gets sent to the wrong side
// of the county line.
//
// A hosted autocomplete would do this and more, but it needs a key, a billing
// account and a per-lookup cost for something that is, in the end, a lookup
// table. So the table ships: 40,979 ZIPs from the GeoNames postal-code dump,
// which is CC BY 4.0 — see the credit in AddressFields, which is the licence
// term.
//
// It isn't in the bundle. The file sits in public/ and is fetched the first
// time somebody focuses the address form, so everyone else pays nothing for it
// and Cloudflare's edge serves it from cache. 156 KB over the wire, once.
//
// Every failure here is silent by design: if the fetch never lands, the form is
// exactly the form it was before — five fields you can type into.

/** Packed as parallel delimited strings; see scripts/build-zips.mjs. */
interface Packed {
  states: string[];
  cities: string[];
  zipDeltas: string;
  cityIndex: string;
  stateIndex: string;
}

export interface Place {
  city: string;
  state: string;
  /**
   * Which distinct city+state this is, counting in ascending ZIP order — the
   * ordering the coordinates file is written in, and the only thing joining the
   * two. Keyed on the pair rather than the name because names repeat: there is
   * an Evanston in Illinois and one in Wyoming.
   */
  placeIndex: number;
}

export interface ZipIndex {
  /** The city and state for a ZIP, or null if it isn't one. */
  place(zip: string): Place | null;
  /** Every ZIP in a city, ascending. Empty when the city isn't known. */
  zipsIn(city: string, state: string): string[];
}

// basePath doesn't rewrite a bare fetch, the same way it doesn't rewrite an
// <img src> — so the prefix is written out.
const URL_PATH = "/app/data/us-zips.json";

let cache: ZipIndex | null = null;
let inflight: Promise<ZipIndex | null> | null = null;

function build(packed: Packed): ZipIndex {
  const deltas = packed.zipDeltas.split(",");
  const cityIx = packed.cityIndex.split(",");
  const stateIx = packed.stateIndex.split(",");

  const byZip = new Map<string, Place>();
  const byCity = new Map<string, string[]>();
  // Assigned in the order they first appear, which is ascending ZIP order —
  // matching how scripts/build-zips.mjs writes the coordinates.
  const placeIndex = new Map<string, number>();

  // Zips are stored as the gap from the previous one — they're sorted, so
  // almost every gap is one or two digits rather than five.
  let n = 0;
  for (let i = 0; i < deltas.length; i++) {
    n += Number(deltas[i]);
    const zip = String(n).padStart(5, "0");
    const city = packed.cities[Number(cityIx[i])];
    const state = packed.states[Number(stateIx[i])];
    if (!city || !state) continue;

    const pair = `${city}|${state}`;
    let place = placeIndex.get(pair);
    if (place === undefined) {
      place = placeIndex.size;
      placeIndex.set(pair, place);
    }
    byZip.set(zip, { city, state, placeIndex: place });

    const key = `${city.toLowerCase()}|${state.toLowerCase()}`;
    const list = byCity.get(key);
    if (list) list.push(zip);
    else byCity.set(key, [zip]);
  }

  return {
    place: (zip) => byZip.get(zip.trim()) ?? null,
    zipsIn: (city, state) =>
      byCity.get(`${city.trim().toLowerCase()}|${state.trim().toLowerCase()}`) ?? [],
  };
}

/**
 * The index, fetched once per page load and shared.
 *
 * Resolves null when it can't be had — an offline visitor, a cache miss, a
 * corrupt file. Callers treat null as "no help available", never as an error to
 * show: nothing here is required to fill in an address.
 */
export function loadZipIndex(): Promise<ZipIndex | null> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = fetch(URL_PATH)
    .then((res) => (res.ok ? (res.json() as Promise<Packed>) : null))
    .then((packed) => {
      if (!packed?.zipDeltas) return null;
      cache = build(packed);
      return cache;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Whether a ZIP contradicts a typed city or state, so the form can say so. */
export function zipDisagrees(
  index: ZipIndex | null,
  zip: string,
  city: string,
  state: string,
): Place | null {
  if (!index) return null;
  const place = index.place(zip);
  if (!place) return null;

  // Only a filled field can disagree — a blank one is waiting to be filled in.
  const cityWrong = city.trim() !== "" && city.trim().toLowerCase() !== place.city.toLowerCase();
  const stateWrong = state.trim() !== "" && state.trim().toUpperCase() !== place.state;
  return cityWrong || stateWrong ? place : null;
}

// ── Coordinates ──────────────────────────────────────────────────────
//
// A second file, fetched only by the one caller that needs a point on the
// earth: the builder's ZIP field, which uses it to match vendors by travel
// radius. The address form above wants a city and a state and nothing more, and
// making everyone download coordinates to type an address would charge the many
// for the few. 72 KB over the wire, once, and only if you use it.

interface PackedCoords {
  lat: string;
  lng: string;
}

export interface Point {
  lat: number;
  lng: number;
}

const COORDS_URL = "/app/data/us-zip-coords.json";

let coordCache: Map<number, Point> | null = null;
let coordInflight: Promise<Map<number, Point> | null> | null = null;

/**
 * One centroid per distinct city+state, in the order they first appear walking
 * ZIPs upward — no key is stored, the ordering is the join. The two files are
 * built together and have to be deployed together.
 *
 * Per place rather than per ZIP, at two decimal places. A travel-radius match is
 * really a question about which metro you're in, and a kilometre of slack
 * against a radius measured in tens of miles costs nothing — the two choices
 * together are worth about 175 KB.
 */
function loadCoords(): Promise<Map<number, Point> | null> {
  if (coordCache) return Promise.resolve(coordCache);
  if (coordInflight) return coordInflight;

  coordInflight = fetch(COORDS_URL)
    .then((res) => (res.ok ? (res.json() as Promise<PackedCoords>) : null))
    .then((packed) => {
      if (!packed?.lat || !packed?.lng) return null;
      const lats = packed.lat.split(",");
      const lngs = packed.lng.split(",");
      const out = new Map<number, Point>();
      let lat = 0;
      let lng = 0;
      for (let i = 0; i < lats.length; i++) {
        lat += Number(lats[i]);
        lng += Number(lngs[i]);
        // A city the dump had no coordinates for lands on 0,0 — the Atlantic.
        // Omitted rather than offered, so a caller gets nothing instead of
        // somewhere wrong.
        if (lat !== 0 || lng !== 0) out.set(i, { lat: lat / 100, lng: lng / 100 });
      }
      coordCache = out;
      return coordCache;
    })
    .catch(() => null)
    .finally(() => {
      coordInflight = null;
    });

  return coordInflight;
}

export interface ZipPlace extends Place {
  /** Null when the ZIP is unknown, or its city has no usable centroid. */
  point: Point | null;
}

/**
 * Everything known about a ZIP: its city, its state, and roughly where it is.
 *
 * Resolves null for anything that isn't a ZIP in the table. Both files are
 * fetched on the first call and shared after that; a failure of either resolves
 * to null rather than throwing, because nothing here is required to use the
 * form that asks.
 */
export async function locateZip(zip: string): Promise<ZipPlace | null> {
  const index = await loadZipIndex();
  const place = index?.place(zip);
  if (!place) return null;

  const coords = await loadCoords();
  return { ...place, point: coords?.get(place.placeIndex) ?? null };
}
