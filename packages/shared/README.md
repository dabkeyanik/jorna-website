# @jorna/shared

Code both web apps use, identical on both sides: the API client and token
refresh, push, Sentry, pricing and address helpers, the UI kit, and the
brand styles. Each app imports it as source —

```ts
import { apiFetch } from "@jorna/shared/lib/api";
import { Button } from "@jorna/shared/components/ui";
import "@jorna/shared/styles/globals.css";
```

— and Next compiles it with the app (Turbopack builds workspace packages
automatically), so there's no build step here.

Change something here and both apps get it. What isn't here yet — the
typed API layer (`lib/jorna.ts`), most of `lib/types.ts`, auth and the
components built on them — has drifted apart between the apps and is being
reconciled before it moves.

```bash
npm --workspace @jorna/shared run lint
npm --workspace @jorna/shared run typecheck
npm --workspace @jorna/shared run test
```
