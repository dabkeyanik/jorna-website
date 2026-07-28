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
  entries.push({ zip, city, state });
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
console.log("zips:      ", entries.length.toLocaleString());
console.log("cities:    ", cities.length.toLocaleString());
console.log("states:    ", states.length);
console.log("raw:       ", (json.length / 1024).toFixed(0) + " KB");
console.log("gzipped:   ", (gzipSync(json, { level: 9 }).length / 1024).toFixed(0) + " KB");
