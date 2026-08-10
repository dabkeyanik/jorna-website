# Database

There is no database or persistence code in this repository. Jorna's data
layer (schemas, models, migrations, repositories) lives entirely in the
external backend, `Desiconnect/server` — a separate repository not checked
out here. This repo only ever talks to it over HTTP.

If you need to understand or change persistence behavior, that work happens
in the backend repo, not here. What's available from this side:

- **Shape of the data**, as consumed by the frontend:
  `web/src/lib/types.ts` — TypeScript interfaces mirroring the backend's
  Pydantic schemas, hand-maintained (not generated), kept close by
  convention. Treat as a close approximation, not a guaranteed-current
  contract.
- **How data is fetched/mutated**: `web/src/lib/jorna.ts` and
  `web/src/lib/api.ts` — see `docs/API.md`.

If a task requires knowing the actual backend schema, migrations, or query
behavior, that information is not derivable from this repo — it needs the
backend repository or the running API.
