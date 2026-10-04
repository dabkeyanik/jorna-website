"use client";

// Auth lives in @jorna/shared/lib/auth, shared with the vendor app. This
// wrapper adds what's this app's own: the caches to clear with the session. Signing out only
// clears the session here; each caller navigates itself.

import { AuthProvider as SharedAuthProvider } from "@jorna/shared/lib/auth";
import { clearAttentionCache } from "./attention";
import { clearRoleCache } from "./role";

export { hasStoredSession, useAuth } from "@jorna/shared/lib/auth";

// Module-level so it's one stable function: the provider's clear() depends on it.
function clearCaches() {
  clearAttentionCache();
  clearRoleCache();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SharedAuthProvider onSessionCleared={clearCaches}>
      {children}
    </SharedAuthProvider>
  );
}
