# Jorna website — agent instructions

Jorna is a marketplace for planning South Asian celebrations (matching
clients with vendors, bundling services, escrow-backed booking/payment).
**This repo is frontend-only**: a hand-written marketing page plus a
client-rendered Next.js web app, both deployed as static files to Cloudflare
Pages. The backend (FastAPI, Python) lives in a separate repository
(`Desiconnect/server`) and is not checked out here — treat it as an external
API reachable only over HTTP.

## Layout

```
public/            served by Cloudflare Pages — public/app/ is a GENERATED,
                    gitignored build output; don't hand-edit it
web/                Next.js 16 / React 19 / TS / Tailwind v4 source for /app
scripts/            deploy + build tooling
docs/               architecture docs (read before cross-cutting changes)
.claude/context/    current-task.md — working memory for in-progress tasks
*.md (root)         feature specs/plans (CLIENT_FLOW_PLAN, WEB_PARITY_PLAN,
                    MESSAGING_PROPOSAL, RESCHEDULE_PROPOSAL,
                    VENDOR_DASHBOARD_BRIEF, DESIGN_BRIEF) — proposals and
                    build plans, not always-current architecture; check the
                    code before trusting one as still accurate
```

## Documentation map

- `docs/ARCHITECTURE.md` — components, data flow, external services,
  conventions to know before a cross-cutting change.
- `docs/MODULE_MAP.md` — which subsystem owns which files; start here to
  find where to make a change.
- `docs/API.md` — how the frontend talks to the external backend (auth,
  error handling, the typed client layers).
- `docs/DATABASE.md` — why there's no schema/persistence code here (there
  isn't any; it's in the external backend repo).
- `docs/DECISIONS.md` — why things are built the way they are.
- `.claude/context/current-task.md` — handoff notes for whatever's currently
  in progress (see "Context handoff" below).

## How to explore this repo

- Don't read the whole repository. Start with `docs/MODULE_MAP.md` to find
  the relevant subsystem, then read only the files it points to.
- Search for existing implementations before writing new code — in
  particular, check `web/src/lib/jorna.ts` before adding a new API call, and
  `web/src/lib/planning.ts` / `vendorPlan.ts` before adding any "does the
  user still need to do X" logic (see `docs/ARCHITECTURE.md`).
- Read the relevant doc in `docs/` before a change that spans multiple
  subsystems (auth, pricing, task/attention rules, deploy).
- Treat source code as ground truth over any `.md` file, including these —
  docs here can lag a code change. `docs/ARCHITECTURE.md` documents at least
  one place where the root README is currently stale; don't assume
  prose docs are self-consistent.
- The root-level `*_PLAN.md` / `*_PROPOSAL.md` / `*_BRIEF.md` files are
  design/planning documents, some only partially built. Don't treat "it's in
  a proposal doc" as "it's implemented" — verify against the code.

## Coding rules for this repo

- Comments explain *why*, not *what* — match the existing style (see almost
  any file in `web/src/lib`). Don't add comments that restate the code.
- Don't duplicate the task/attention rules in `planning.ts`/`vendorPlan.ts`;
  extend them instead.
- All backend calls go through `web/src/lib/jorna.ts` (typed) →
  `web/src/lib/api.ts` (transport). No ad-hoc `fetch()` in components.
- Price values are always the `price_min`/`price_max`/`price_unit`/
  `price_pending_quantity` shape — never format a bare number by hand.
- `public/app/` is generated (gitignored); never edit it directly, and never
  ship with a bare `wrangler deploy` — use `npm run deploy` (see
  `docs/DECISIONS.md` for why).

## Commands

```bash
npm run install:app              # first time: install web/ dependencies
npm --prefix web run dev         # dev server at localhost:3000/app
npm --prefix web run lint        # eslint (web app only)
npm run build                    # next build + export into public/app
npm run deploy                   # build + verified deploy to Cloudflare Pages
npm run deploy:once              # build + single-shot deploy, unverified
```

There is no automated test suite in this repo (no test runner in either
`package.json`). Verify changes by running the dev server and exercising the
affected flow in a browser, plus lint/TypeScript.

## Maintaining this context layer

- When a change is architecturally meaningful (new subsystem, changed data
  flow, new external service, a convention worth enforcing), update the
  relevant file in `docs/` in the same change — don't let it drift.
- Keep `docs/*` navigational: link to source files rather than copying
  implementation details or large code blocks into prose.
- **When a task gets complex, or context is running low**, write a handoff
  summary to `.claude/context/current-task.md` (goal, status, discoveries,
  files changed, decisions, blockers, remaining work, verification status —
  see the template in that file). Keep it under ~2,000 tokens. A fresh
  session should be able to read that one file and continue without
  re-exploring the repo.
- When starting a new unrelated task, reset `current-task.md` rather than
  appending to stale content from a previous task.
