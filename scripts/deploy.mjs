// Self-verifying deploy.
//
// `wrangler deploy` uploads assets incrementally, and that upload has
// intermittently dropped files while still printing "Deployed" + a Version ID —
// leaving the marketing page (a plain static file) serving while every /app
// route 404s. A success line is therefore NOT proof the app shipped.
//
// So: build once, then deploy and actually fetch every route. If any isn't 200,
// re-deploy (which re-uploads whatever's missing) and check again. Give up loudly
// rather than leave production half-broken.

import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "public", "app");
const DOMAIN = process.env.DEPLOY_DOMAIN ?? "https://jornaevents.com";
const MAX_ATTEMPTS = 4;
const SETTLE_MS = 6000;

const log = (m) => console.log(`\x1b[36m[deploy]\x1b[0m ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every route in the built export, as verifiable URLs (dynamic — no drift). */
function routeUrls() {
  const urls = new Set(["/", "/app/"]);
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "_next") continue; // hashed assets, not routes
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === "index.html") {
        const rel = relative(appDir, dir).split(sep).join("/");
        urls.add(rel ? `/app/${rel}/` : "/app/");
      }
    }
  };
  if (existsSync(appDir)) walk(appDir);
  return [...urls].sort();
}

/** Fetch each route (cache-busted so a stale edge 404 can't fool us). */
async function findFailures(urls) {
  const failures = [];
  for (const u of urls) {
    const bust = `${u}${u.includes("?") ? "&" : "?"}_deploycheck=${Date.now()}`;
    try {
      const res = await fetch(DOMAIN + bust, { redirect: "follow" });
      if (res.status !== 200) failures.push(`${u} -> ${res.status}`);
    } catch (e) {
      failures.push(`${u} -> ${e.code ?? "network error"}`);
    }
  }
  return failures;
}

log("building…");
execSync("npm run build", { cwd: root, stdio: "inherit" });

const urls = routeUrls();
log(`will verify ${urls.length} routes after deploy`);

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  log(`deploy attempt ${attempt}/${MAX_ATTEMPTS}`);
  try {
    execSync("npx --no-install wrangler deploy", { cwd: root, stdio: "inherit" });
  } catch {
    log("wrangler exited non-zero — retrying");
    await sleep(4000);
    continue;
  }

  await sleep(SETTLE_MS);
  const failures = await findFailures(urls);
  if (failures.length === 0) {
    log(`\x1b[32m✓ all ${urls.length} routes serving 200 — deploy verified\x1b[0m`);
    process.exit(0);
  }

  log(`\x1b[33m✗ ${failures.length}/${urls.length} route(s) not serving:\x1b[0m`);
  for (const f of failures) log(`    ${f}`);
  if (attempt < MAX_ATTEMPTS) {
    log("re-deploying to re-upload the missing assets…");
    await sleep(2000);
  }
}

log(
  "\x1b[31mFAILED: routes still not serving after every attempt. " +
    "Production may be partially deployed — investigate before walking away.\x1b[0m",
);
process.exit(1);
