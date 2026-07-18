// Copy the Next static export into the Worker's asset directory.
//
// `next build` (output: "export", basePath: "/app") writes to web/out with the
// basePath stripped from the folder structure, so the contents belong at
// public/app — which the Worker then serves at jornaevents.com/app.

import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = resolve(here, "..", "out");
const to = resolve(here, "..", "..", "public", "app");

if (!existsSync(from)) {
  console.error(`✗ No export found at ${from} — run \`next build\` first.`);
  process.exit(1);
}

rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log(`✓ Exported app → ${to}`);
