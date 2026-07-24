"use client";

// "Turn on notifications" — offered on /activity. Registers this browser as a
// push device for the signed-in user. Renders nothing when the browser can't do
// web push or notifications are already on (in which case the token is silently
// re-registered so it stays attached to the current user).

import { useEffect, useState } from "react";
import { enableWebPush, permissionState, pushSupported, type PermissionState } from "@/lib/push";
import { Button, Card } from "@/components/ui";

export function PushOptIn() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<PermissionState>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    pushSupported().then((ok) => {
      if (cancelled) return;
      setSupported(ok);
      if (!ok) return;
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
    setPerm(token ? "granted" : permissionState());
    setBusy(false);
  }

  // Unknown, unsupported, or already on → show nothing.
  if (!supported || perm === "granted") return null;

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
