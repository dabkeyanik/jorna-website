"use client";

// /event was the other half of a split: the dashboard offered "Open plan" and
// "Event details" side by side, and you had to guess which held what. The plan
// now shows the event in full — date, location, guests, budget, description,
// what you said you needed — so this page has nothing left of its own.
//
// Kept as a redirect rather than deleted: it was linked from the dashboard and
// may be bookmarked. It lands on the celebration's first bundle when there is
// one (the plan links any others), and on the dashboard when there isn't.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { listBundles } from "@/lib/jorna";
import { LinkButton } from "@/components/ui";

function EventRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const eventId = useSearchParams().get("id");
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !eventId) {
      router.replace("/bundles");
      return;
    }
    let cancelled = false;
    listBundles()
      .then((bundles) => {
        if (cancelled) return;
        const mine = bundles.find(
          (b) => b.event_id === eventId || b.event?.event_id === eventId,
        );
        router.replace(mine ? `/bundle?id=${mine.bundle_id}` : "/bundles");
      })
      .catch(() => !cancelled && setStuck(true));
    return () => {
      cancelled = true;
    };
  }, [loading, user, eventId, router]);

  return (
    <div className="py-20 text-center">
      <p className="text-ink-soft">
        {stuck
          ? "Couldn't find that celebration's plan."
          : "Opening your plan…"}
      </p>
      <LinkButton href="/bundles" variant="ghost" className="mt-5">
        Go to the dashboard
      </LinkButton>
    </div>
  );
}

export default function EventPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <EventRedirect />
    </Suspense>
  );
}
