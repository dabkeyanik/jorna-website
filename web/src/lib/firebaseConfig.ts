// ─────────────────────────────────────────────────────────────────────────────
//  FIREBASE WEB PUSH CONFIG  —  PLACE YOUR VALUES HERE  (slot 1 of 2)
// ─────────────────────────────────────────────────────────────────────────────
//
//  Where to get each value (Firebase console for the SAME project iOS uses —
//  project ref "ddfjhfqrrgvzphwiinch" is Supabase, NOT Firebase; the Firebase
//  project is separate):
//
//    Project settings → General → "Your apps" → the Web app (</> ) → SDK setup
//    and configuration → "Config".  Copy these five fields:
//        apiKey, authDomain, projectId, messagingSenderId, appId
//      (storageBucket is not needed for push.)
//
//    Project settings → Cloud Messaging → "Web configuration" →
//        Web Push certificates → Generate key pair → the "Key pair" string.
//      That is the VAPID_PUBLIC_KEY below (a long "B…" base64url string).
//
//  You can either paste the values below, or leave the placeholders and set the
//  NEXT_PUBLIC_FIREBASE_* env vars — env wins when present.
//
//  ⚠️  The SERVICE WORKER needs the same five config values a SECOND time, hard-
//      coded, because a static service-worker file can't read these env vars.
//      That copy is in:  web/public/firebase-messaging-sw.js  (slot 2 of 2).
//      Keep the two in sync.
// ─────────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY             ?? "AIzaSyDy11WfdRcuOoGtBXEjCuPQTMcnNuaUE_Q",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN         ?? "jorna-15768.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID          ?? "jorna-15768",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "876290852341",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID              ?? "1:876290852341:web:1356351e32243ccd748cbc",
};

/** The Web Push certificate public key ("Key pair") from Cloud Messaging.
 *  Used client-side by getToken({ vapidKey }); the backend never needs it. */
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ??
  "BEFNZxH80y6hzzZ8kacx3spJ0_ka2RTaLoDEZBykbiQnDRBxsFwy-5Q9prbLnECzunV5zV0Ogw9I7d7Gz66YfTM";

/** True once every slot above has a real value — the push UI stays hidden until
 *  then, so a half-configured build simply doesn't offer notifications. */
export const firebasePushConfigured =
  !Object.values(firebaseConfig).some((v) => v.startsWith("PASTE_")) &&
  !VAPID_PUBLIC_KEY.startsWith("PASTE_");
