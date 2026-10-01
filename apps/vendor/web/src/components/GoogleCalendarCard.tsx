"use client";

import { useState } from "react";
import { ApiError } from "@jorna/shared/lib/api";
import { getGoogleAuthUrl } from "@/lib/jorna";
import { Button, Card } from "@jorna/shared/components/ui";

/**
 * Link a Google Calendar, or say that one is linked.
 *
 * The reading half of this has worked for a long time — busy days already
 * arrive with the availability and already have their own tint — but nothing
 * ever offered to connect one, so the feature was only reachable from the
 * phone. This is the missing button.
 *
 * It's a whole-page redirect, not a popup: Google's consent screen is its own
 * page, and a popup is the version that gets blocked on a phone. The vendor
 * comes back to /calendar-connected.
 *
 * Three states, not two: a fresh connect now requests both the busy-times
 * scope and the write-back one, but a vendor who connected before write-back
 * existed is stuck on the narrower grant they agreed to at the time — Google
 * never widens a standing grant on its own. `writeEnabled` tells them apart,
 * and the fix for the middle one is the same button as the first: running
 * the connect flow again re-shows Google's consent screen (prompt=consent),
 * which is what lets them grant the rest of it.
 */
export function GoogleCalendarCard({
  vendorId,
  connected,
  writeEnabled,
  className = "",
}: {
  vendorId: string;
  connected: boolean;
  writeEnabled: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { auth_url } = await getGoogleAuthUrl(vendorId);
      window.location.href = auth_url;
      // Deliberately stays busy: the navigation is the success case, and
      // re-enabling the button would invite a second click during it.
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't start the Google connection.",
      );
      setBusy(false);
    }
  }

  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="serif text-lg text-ink">
            {connected ? "Google Calendar is connected" : "Connect Google Calendar"}
          </h2>
          <p className="mt-1 max-w-[52ch] text-sm text-ink-soft">
            {connected
              ? writeEnabled
                ? "Days you're busy in Google show here too, and your Jorna bookings are added to your calendar automatically, so a client can't book you into a gap that isn't one."
                : "Days you're busy in Google show here too, so a client can't book you into a gap that isn't one. Jorna doesn't add your bookings to your calendar yet — reconnect to turn that on."
              : "Your Google events become busy days here, so nobody books you into a gap that isn't one, and your Jorna bookings are added to your calendar in return. Jorna reads an event's time only, never what it is."}
          </p>
        </div>
        {connected && writeEnabled ? (
          <span className="shrink-0 rounded-full bg-green/15 px-3 py-1 text-xs font-semibold text-green">
            Connected
          </span>
        ) : (
          <Button disabled={busy} onClick={connect}>
            {busy
              ? "Opening Google…"
              : connected
                ? "Reconnect"
                : "Connect"}
          </Button>
        )}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
