# Jorna web — agent instructions

Two apps in one repo: `apps/client` (book.jornaevents.com, hosts) and
`apps/vendor` (jornaevents.com, vendors and the contract signing page). Each
has its own `CLAUDE.md`, docs and README — read the one for the app you're
changing, and run its commands from that app's folder (paths in its docs,
like `web/src/...`, are relative to it).

What lives at the root instead of in each app:

- **CI** — `.github/workflows/ci.yml` picks the apps a change touches and
  runs `.github/workflows/app.yml` for each (checks, PR preview, deploy on
  `main`). Where an app's own docs describe "the CI workflow", this is it.
- **The pre-commit hook** — `.husky/pre-commit` + `lint-staged.config.mjs`,
  lint and typecheck per app. Run `npm install` at the root once.
- **Dependabot and issue templates** — `.github/`.

The apps still duplicate shared code (`web/src/lib/api.ts`, `auth.tsx`,
`types.ts`, `jorna.ts`, `components/ui.tsx`, `globals.css`, …). Until that's
moved into a shared package, a fix to one of those usually belongs in both
apps — check the other copy.

`main` is protected: branch per change, open a PR, merge once CI is green.
Merging deploys.
