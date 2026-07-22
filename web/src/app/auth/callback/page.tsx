"use client";

// Where Google returns after OAuth (Supabase → this page with ?code=…).
// Completes the PKCE handshake, exchanges the Supabase token for a Jorna
// session, and routes on:
//   • existing / linkable account → adopt the Jorna tokens, go to `next`
//   • brand-new Google identity   → hold the Supabase session and send to the
//     signup completion form (/login?google=1)

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, takeOAuthNext } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { googleLookup } from "@/lib/jorna";
import { ApiError } from "@/lib/api";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { adoptSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard React StrictMode's double-invoke
    ran.current = true;

    (async () => {
      try {
        // Turn the ?code= into a Supabase session (detectSessionInUrl is off, so
        // we drive the exchange here).
        const code = new URLSearchParams(window.location.search).get("code");
        const oauthError = new URLSearchParams(window.location.search).get("error_description");
        if (oauthError) {
          setError(oauthError);
          return;
        }
        let session = (await supabase.auth.getSession()).data.session;
        if (!session && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data.session;
        }
        if (!session) {
          setError("Google sign-in didn't complete. Please try again.");
          return;
        }

        // Exchange the Supabase token for a Jorna session.
        const lookup = await googleLookup(session.access_token);
        const next = takeOAuthNext();

        if (!lookup.is_new_user && lookup.access_token && lookup.refresh_token) {
          await adoptSession({
            access_token: lookup.access_token,
            refresh_token: lookup.refresh_token,
            token_type: lookup.token_type || "bearer",
          });
          // Jorna's JWT is the session now — the Supabase one isn't needed.
          await supabase.auth.signOut();
          router.replace(next);
          return;
        }

        // New Google identity: keep the Supabase session (the signup form needs
        // it to prove ownership) and go finish creating the account, preserving
        // where they were headed.
        router.replace(`/login?google=1&next=${encodeURIComponent(next)}`);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Google sign-in failed. Please try again.");
      }
    })();
  }, [adoptSession, router]);

  return (
    <div className="mx-auto w-[min(440px,100%-2rem)] py-24 text-center">
      {error ? (
        <>
          <h1 className="serif text-2xl text-maroon dark:text-gold">Couldn&apos;t sign in</h1>
          <p className="mt-3 text-ink-soft">{error}</p>
          <Link
            href="/login"
            className="mt-5 inline-block text-sm font-semibold text-gold hover:underline"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <p className="text-ink-soft">Finishing sign-in…</p>
      )}
    </div>
  );
}
