"use client";

// Web push via Firebase Cloud Messaging (FCM for Web). A browser gets an FCM
// registration token — the same string shape as a native device token — which
// we register with the backend (platform:"web"). Dispatch then treats a browser
// as just another of the user's devices (see send_push_to_user server-side).
//
// The heavy firebase SDK is imported lazily so it never lands in the initial
// bundle for the many users who never turn notifications on.

import { firebaseConfig, VAPID_PUBLIC_KEY, firebasePushConfigured } from "./firebaseConfig";
import { apiFetch } from "./api";

const SW_URL = "/app/firebase-messaging-sw.js";
const SW_SCOPE = "/app/";
const LOCAL_TOKEN_KEY = "jorna_push_token";

export type PermissionState = NotificationPermission | "unsupported";

/** Can this browser do web push at all, and is Firebase configured? */
export async function pushSupported(): Promise<boolean> {
  if (!firebasePushConfigured || typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
    return false;
  }
  try {
    const { isSupported } = await import("firebase/messaging");
    return await isSupported();
  } catch {
    return false;
  }
}

export function permissionState(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function messagingInstance() {
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const { getMessaging } = await import("firebase/messaging");
  return getMessaging(app);
}

/**
 * Ask permission, get an FCM token for this browser, and register it with the
 * backend. Returns the token, or null if unsupported / permission not granted.
 * Safe to call again — it refreshes the token and re-registers.
 */
export async function enableWebPush(): Promise<string | null> {
  if (!(await pushSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  // Register our SW explicitly. FCM would otherwise look for it at the origin
  // root (/firebase-messaging-sw.js), which 404s under our /app basePath.
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });

  const { getToken } = await import("firebase/messaging");
  const token = await getToken(await messagingInstance(), {
    vapidKey: VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) return null;

  await apiFetch("/notifications/register-token", {
    method: "POST",
    body: { fcm_token: token, platform: "web" },
  });
  try {
    localStorage.setItem(LOCAL_TOKEN_KEY, token);
  } catch {
    /* private mode — non-fatal; sign-out just can't target this exact token */
  }
  return token;
}

/**
 * Foreground messages: FCM shows nothing while the tab is focused, so surface
 * them ourselves as a native notification via the SW registration. Returns an
 * unsubscribe function.
 */
export async function listenForeground(): Promise<() => void> {
  if (!(await pushSupported()) || permissionState() !== "granted") return () => {};
  const { onMessage } = await import("firebase/messaging");
  const messaging = await messagingInstance();
  const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "Jorna";
    const body = payload.notification?.body ?? "";
    registration?.showNotification(title, { body, icon: "/app/favicon.ico", data: payload.data });
  });
}

/**
 * Remove this browser's token on sign-out, so a shared computer stops pinging
 * the previous user. Best-effort, and must run while still authenticated (the
 * DELETE needs the bearer token), so call it before clearing the session.
 */
export async function disableWebPushForThisDevice(userId: string): Promise<void> {
  let token: string | null = null;
  try {
    token = localStorage.getItem(LOCAL_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  if (token) {
    try {
      await apiFetch(`/notifications/remove-token/${userId}?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
      });
    } catch {
      /* best-effort; the backend also prunes tokens FCM reports as dead */
    }
    try {
      localStorage.removeItem(LOCAL_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
}
