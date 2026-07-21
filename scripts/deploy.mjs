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
const PAGES_PROJECT = "jorna-events";
// Verify against the domain the deploy actually updates. Pre-cutover the apex
// (jornaevents.com) still points at the old Worker, so a Pages deploy is proved
// on the pages.dev alias. After the apex is moved to Pages, set
// DEPLOY_DOMAIN=https://jornaevents.com (and update the default here).
const DOMAIN = process.env.DEPLOY_DOMAIN ?? "https://jorna-events.pages.dev";
const MAX_ATTEMPTS = 4;
// A deploy can pass one check, then 404 for a while as it propagates across edge
// PoPs. Don't trust a single green check — require several consecutive clean
// passes, polling long enough for propagation to settle before failing a deploy.
const CONFIRM_PASSES = 3; // consecutive all-green sweeps required
const POLL_INTERVAL_MS = 8000;
const VERIFY_TIMEOUT_MS = 120000; // per deploy attempt

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
    execSync(
      `npx --no-install wrangler pages deploy public --project-name ${PAGES_PROJECT} --branch main --commit-dirty=true`,
      { cwd: root, stdio: "inherit" },
    );
  } catch {
    log("wrangler exited non-zero — retrying");
    await sleep(4000);
    continue;
  }

  // Poll until the routes are stably green (CONFIRM_PASSES in a row) or we run
  // out of time for this attempt. A brief 404 is propagation; a persistent one
  // is a bad upload → re-deploy.
  const deadline = Date.now() + VERIFY_TIMEOUT_MS;
  let streak = 0;
  let lastFailures = [];
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    lastFailures = await findFailures(urls);
    if (lastFailures.length === 0) {
      streak += 1;
      log(`clean sweep ${streak}/${CONFIRM_PASSES}`);
      if (streak >= CONFIRM_PASSES) {
        log(`\x1b[32m✓ all ${urls.length} routes stably serving 200 — verified\x1b[0m`);
        process.exit(0);
      }
    } else {
      if (streak > 0) log("regressed — restarting the stability count");
      streak = 0;
    }
  }

  log(`\x1b[33m✗ not stable after ${VERIFY_TIMEOUT_MS / 1000}s; last sweep had ${lastFailures.length} failure(s):\x1b[0m`);
  for (const f of lastFailures) log(`    ${f}`);
  if (attempt < MAX_ATTEMPTS) {
    log("re-deploying…");
    await sleep(2000);
  }
}

log(
  "\x1b[31mFAILED: routes still not serving after every attempt. " +
    "Production may be partially deployed — investigate before walking away.\x1b[0m",
);
process.exit(1);
