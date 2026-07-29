// Turns the GeoNames US postal-code dump into the file web/public/data ships.
//
// Not part of the build — the output is committed, because the source is a
// 2.7 MB TSV inside a zip on someone else's server and a deploy shouldn't
// depend on it being up. Re-run when the data is worth refreshing:
//
//   curl -o US.zip https://download.geonames.org/export/zip/US.zip
//   unzip US.zip
//   node scripts/build-zips.mjs US.txt web/public/data/us-zips.json
//
// The dump is CC BY 4.0 (www.geonames.org); the credit under the address
// fields is the attribution that licence asks for.
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const src = process.argv[2];
const out = process.argv[3];

const rows = readFileSync(src, "utf8").split("\n").filter(Boolean).map((l) => l.split("\t"));

// country, zip, place, stateName, stateCode, county, countyCode, _, _, lat, lng, accuracy
const seen = new Set();
const entries = [];
for (const r of rows) {
  const zip = r[1]?.trim();
  const city = r[2]?.trim();
  const state = r[4]?.trim();
  if (!zip || !city || !state || zip.length !== 5 || seen.has(zip)) continue;
  seen.add(zip);
  entries.push({ zip, city, state, lat: Number(r[9]), lng: Number(r[10]) });
}
entries.sort((a, b) => (a.zip < b.zip ? -1 : 1));

// Two small tables plus three parallel columns, all as delimited strings —
// they gzip far better than arrays of JSON numbers, and split() is the parse.
const states = [...new Set(entries.map((e) => e.state))].sort();
const stateIx = new Map(states.map((s, i) => [s, i]));
const cities = [...new Set(entries.map((e) => e.city))].sort();
const cityIx = new Map(cities.map((c, i) => [c, i]));

// Zips are sorted, so store the gap from the previous one — almost all are
// one or two digits instead of five.
let prev = 0;
const deltas = entries.map((e) => { const n = Number(e.zip); const d = n - prev; prev = n; return d; });

const payload = {
  note: "US ZIP → city and state. Built from the GeoNames postal-code dump (CC BY 4.0, www.geonames.org).",
  states,
  cities,
  zipDeltas: deltas.join(","),
  cityIndex: entries.map((e) => cityIx.get(e.city)).join(","),
  stateIndex: entries.map((e) => stateIx.get(e.state)).join(","),
};

const json = JSON.stringify(payload);
writeFileSync(out, json);

// ── Coordinates, in their own file ────────────────────────────────────
//
// Split out because the two callers want different things. The address form
// needs a ZIP's city and state and nothing else; only the builder's ZIP field
// needs a point on the earth, and making everyone download coordinates to fill
// in an address would be charging the many for the few.
//
// One centroid per city, not per ZIP: a travel-radius match is a question about
// which metro you're in, and 41,000 answers to it are 22,000 more than there
// are places. Two decimal places is about a kilometre, against radii measured
// in tens of miles. Both choices are worth roughly 100 KB.
// Keyed by city AND state. City names repeat — there is an Evanston in Illinois
// and one in Wyoming, a Redmond in Washington and one in Oregon — so keying on
// the name alone hands out the coordinates of whichever shares the lowest ZIP.
// That put Evanston 281 miles away and Redmond 808, which is the kind of wrong
// that looks right until someone checks.
//
// No key is written into the file. The order is the contract: one entry per
// distinct city+state, in ascending ZIP order, which the client reconstructs
// from the ZIP table it already has. That keeps this to two columns.
const pairIndex = new Map();
const lats = [];
const lngs = [];
for (const e of entries) {
  const key = `${e.city}|${e.state}`;
  if (pairIndex.has(key)) continue;
  pairIndex.set(key, lats.length);
  const ok = Number.isFinite(e.lat) && Number.isFinite(e.lng);
  lats.push(ok ? Math.round(e.lat * 100) : 0);
  lngs.push(ok ? Math.round(e.lng * 100) : 0);
}
const delta = (values) => {
  let last = 0;
  return values.map((v) => { const d = v - last; last = v; return d; }).join(",");
};
const coords = JSON.stringify({
  note:
    "Centroids for each distinct city+state, 2dp, delta-encoded. Ordered by " +
    "first appearance in ascending ZIP order — the same order a client gets by " +
    "walking us-zips.json — so the two files must be rebuilt and deployed " +
    "together. GeoNames, CC BY 4.0.",
  places: lats.length,
  lat: delta(lats),
  lng: delta(lngs),
});
const coordsOut = out.replace(/us-zips\.json$/, "us-zip-coords.json");
writeFileSync(coordsOut, coords);
console.log("zips:      ", entries.length.toLocaleString());
console.log("cities:    ", cities.length.toLocaleString());
console.log("states:    ", states.length);
console.log("raw:       ", (json.length / 1024).toFixed(0) + " KB");
console.log("gzipped:   ", (gzipSync(json, { level: 9 }).length / 1024).toFixed(0) + " KB");
console.log("coords:    ", coordsOut);
console.log("  raw:     ", (coords.length / 1024).toFixed(0) + " KB");
console.log("  gzipped: ", (gzipSync(coords, { level: 9 }).length / 1024).toFixed(0) + " KB");
