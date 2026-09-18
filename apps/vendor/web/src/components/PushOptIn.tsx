"use client";

// "Turn on notifications" — offered on /activity. Registers this browser as a
// push device for the signed-in user. When the browser can't do web push it now
// says *why* (iOS home-screen, unsupported browser, …) instead of rendering
// nothing, which otherwise reads as "the feature is missing".

import { useEffect, useState } from "react";
import {
  enableWebPush,
  permissionState,
  pushAvailability,
  type PermissionState,
  type PushAvailability,
} from "@/lib/push";
import { Button, Card } from "@/components/ui";

export function PushOptIn() {
  const [avail, setAvail] = useState<PushAvailability | null>(null);
  const [perm, setPerm] = useState<PermissionState>("default");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    pushAvailability().then((a) => {
      if (cancelled) return;
      setAvail(a);
      if (!a.ok) return;
      const p = permissionState();
      setPerm(p);
      // Already granted → re-register this browser's token for the current user.
      // No prompt appears when permission is already granted.
      if (p === "granted") void enableWebPush();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    const token = await enableWebPush();
    setBusy(false);
    if (token) {
      setPerm("granted");
      setDone(true);
    } else {
      setPerm(permissionState());
    }
  }

  if (avail === null) return null; // still checking

  // Can't do push here — explain why rather than vanishing.
  if (!avail.ok) {
    if (avail.reason === "unconfigured") return null; // dev misconfig, not user-facing
    const msg =
      avail.reason === "ios-add-to-home"
        ? "To get notifications on iPhone or iPad, open Jorna from your Home Screen — tap Share, then “Add to Home Screen” (needs iOS 16.4+), and open it from that icon."
        : avail.reason === "insecure"
          ? "Notifications need a secure (https) connection."
          : "This browser can’t show web notifications. Try Chrome, Edge, or Firefox on desktop.";
    return (
      <Card className="mb-6 p-4">
        <h2 className="serif text-lg text-ink">Notifications</h2>
        <p className="mt-0.5 text-sm text-ink-soft">{msg}</p>
      </Card>
    );
  }

  // Just turned on — confirm, since the card would otherwise just disappear.
  if (done) {
    return (
      <Card className="mb-6 p-4">
        <p className="text-sm text-green">Notifications are on for this browser.</p>
      </Card>
    );
  }

  if (perm === "granted") return null; // already on (silently re-registered above)

  const blocked = perm === "denied";
  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="serif text-lg text-ink">Get notified</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {blocked
              ? "Notifications are blocked for this site. Re-enable them in your browser's site settings to get booking and message alerts."
              : "Let this browser alert you to booking requests, confirmations, and messages — even when Jorna isn't open."}
          </p>
        </div>
        {!blocked ? (
          <Button disabled={busy} onClick={turnOn}>
            {busy ? "Turning on…" : "Turn on notifications"}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
