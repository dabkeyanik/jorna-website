"use client";

// /events used to list events on their own, which split one plan across two
// tabs: an event you'd made but not yet built a bundle for sat here, while the
// bundles sat under Bundles, and neither page knew about the other. The
// dashboard now shows both, joined by event_id, so this is just its old address.
//
// Kept as a redirect rather than deleted — it was linked from Profile and may
// be bookmarked. Individual events still have their own page at /event?id=.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LinkButton } from "@/components/ui";

export default function EventsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/bundles");
  }, [router]);

  return (
    <div className="py-20 text-center">
      <p className="text-ink-soft">Your celebrations live on the planning dashboard now.</p>
      <LinkButton href="/bundles" variant="ghost" className="mt-5">
        Go to planning
      </LinkButton>
    </div>
  );
}
