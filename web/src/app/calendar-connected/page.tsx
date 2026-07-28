"use client";

// Where Google sends a vendor back to, once they've granted calendar access.
//
// The backend does the token exchange and then redirects here with the verdict
// already decided, so there's nothing to fetch and nothing that can fail twice
// — this page reads a query string and says what happened. It exists because
// without it the flow ended on the API's own "you can close this tab" page,
// which is written for iOS, where an app is waiting behind Safari. A browser
// has no app waiting; it has a calendar it was in the middle of setting up.
//
// Mirrors /payment-complete, the other place a third party returns someone to
// us mid-task.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, LinkButton } from "@/components/ui";

function CalendarConnectedInner() {
  const params = useSearchParams();
  const ok = params.get("success") === "true";
  // The backend passes its own message through. It's written for a person, but
  // it's still a server's account of a failure, so it's shown as detail under a
  // sentence that says what it means for the vendor.
  const detail = params.get("error");

  return (
    <div className="mx-auto w-[min(560px,100%-2rem)] py-16">
      <Card className="p-7 text-center">
        <h1 className="serif text-3xl text-maroon dark:text-gold">
          {ok ? "Calendar connected" : "That didn't connect"}
        </h1>

        <p className="mx-auto mt-3 max-w-[46ch] text-ink-soft">
          {ok
            ? "Your Google events now show on your Jorna calendar as busy, so you won't be asked to be in two places at once. Only the times are read — never what the events are."
            : "Nothing was changed, and you can try again whenever. If it keeps failing, check that you granted calendar access rather than dismissing the Google screen."}
        </p>

        {!ok && detail ? (
          <p className="mx-auto mt-4 max-w-[46ch] rounded-lg bg-ground-2 px-3 py-2 text-xs text-ink-faint">
            {detail}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <LinkButton href="/my-calendar">
            {ok ? "See your calendar" : "Back to your calendar"}
          </LinkButton>
          <LinkButton href="/my-dashboard" variant="ghost">
            Dashboard
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}

// useSearchParams needs a Suspense boundary to prerender in the static export.
export default function CalendarConnectedPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <CalendarConnectedInner />
    </Suspense>
  );
}
