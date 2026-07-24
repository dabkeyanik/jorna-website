"use client";

// Mounted app-wide (in the root layout). While signed in and permission is
// granted, listens for foreground FCM messages and shows them — FCM stays silent
// while the tab is focused, so without this a message that lands on an open tab
// would be lost. Background messages are handled by the service worker instead.

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { listenForeground } from "@/lib/push";

export function PushRuntime() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let active = true;
    let cleanup = () => {};
    listenForeground().then((unsub) => {
      if (active) cleanup = unsub;
      else unsub();
    });
    return () => {
      active = false;
      cleanup();
    };
  }, [user]);

  return null;
}
