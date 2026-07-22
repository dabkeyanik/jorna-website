"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { supabase, startGoogleSignIn } from "@/lib/supabase";
import { Button, Card, Field } from "@/components/ui";

function GoogleMark() {
  // Google "G", inline so nothing is fetched over the network (the site's ethos).
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function LoginInner() {
  const { login, register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/plan";
  // Set when we've come back from Google as a brand-new identity that needs to
  // finish creating a Jorna account (the callback routes here with ?google=1).
  const isGoogleSignup = params.get("google") === "1";

  const [mode, setMode] = useState<"login" | "register">(isGoogleSignup ? "register" : "login");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // Register-only
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fName, setFName] = useState("");
  const [lName, setLName] = useState("");
  const [ageStr, setAgeStr] = useState("");
  const [location, setLocation] = useState("");
  // Google-signup linkage (recovered from the persisted Supabase session)
  const [googleReady, setGoogleReady] = useState(!isGoogleSignup);
  const [googleUserId, setGoogleUserId] = useState<string | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  // When completing a Google sign-up, recover the held Supabase session to
  // prefill + lock the email and carry the proof-of-ownership token.
  useEffect(() => {
    if (!isGoogleSignup) return;
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session?.user?.email) {
        setEmail(session.user.email);
        setGoogleUserId(session.user.id);
        setGoogleToken(session.access_token);
        setGoogleReady(true);
      } else {
        setError("Your Google session expired. Please choose Continue with Google again.");
      }
    });
  }, [isGoogleSignup]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(identifier, password);
      } else {
        await register({
          email,
          password,
          username,
          f_name: fName,
          l_name: lName,
          age: Number(ageStr) || 25,
          location,
          gender: "unspecified",
          language: "English",
          ...(isGoogleSignup && googleUserId && googleToken
            ? { supabase_user_id: googleUserId, supabase_access_token: googleToken }
            : {}),
        });
        // The Jorna JWT is the session now; drop the Supabase one.
        if (isGoogleSignup) await supabase.auth.signOut();
      }
      router.push(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    setGoogleBusy(true);
    try {
      await startGoogleSignIn(next); // navigates to Google on success
    } catch {
      setGoogleBusy(false);
      setError("Couldn't start Google sign-in. Please try again.");
    }
  }

  const heading = isGoogleSignup
    ? "Finish signing up"
    : mode === "login"
      ? "Welcome back"
      : "Create your account";

  return (
    <div className="mx-auto w-[min(460px,100%-2rem)] py-14">
      <h1 className="serif text-center text-4xl text-maroon dark:text-gold">{heading}</h1>
      <p className="mt-2 text-center text-ink-soft">
        {isGoogleSignup
          ? "A few details and your Google account is all set."
          : mode === "login"
            ? "Sign in to build and book your celebration."
            : "A few details and you're planning."}
      </p>

      <Card className="mt-8 p-6">
        {/* Google — offered on the normal login/register screens, not mid-completion. */}
        {!isGoogleSignup ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={googleBusy}
              onClick={google}
              className="w-full"
            >
              <GoogleMark />
              {googleBusy ? "Connecting…" : "Continue with Google"}
            </Button>
            <div className="my-5 flex items-center gap-3 text-xs text-ink-faint">
              <span className="h-px flex-1 bg-card-edge" />
              or
              <span className="h-px flex-1 bg-card-edge" />
            </div>
          </>
        ) : null}

        <form onSubmit={submit} className="grid gap-4">
          {mode === "login" ? (
            <Field
              label="Email or username"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          ) : (
            <>
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                // Locked to the Google account: the backend rejects a mismatch.
                readOnly={isGoogleSignup}
                hint={isGoogleSignup ? "From your Google account." : undefined}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="First name"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  required
                />
                <Field
                  label="Last name"
                  value={lName}
                  onChange={(e) => setLName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <Field
                  label="Age"
                  type="number"
                  min={13}
                  max={120}
                  value={ageStr}
                  onChange={(e) => setAgeStr(e.target.value)}
                  required
                />
              </div>
              <Field
                label="City & state"
                placeholder="Jersey City, NJ"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </>
          )}

          <Field
            label="Password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            hint={
              mode === "register"
                ? "At least 8 characters, with an uppercase letter, a lowercase letter, and a number."
                : undefined
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {mode === "login" ? (
            <div className="-mt-2 text-right">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-gold underline-offset-2 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={busy || (isGoogleSignup && !googleReady)}
            className="mt-1"
          >
            {busy
              ? "One moment…"
              : isGoogleSignup
                ? "Complete sign-up"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
          </Button>
        </form>
      </Card>

      {!isGoogleSignup ? (
        <p className="mt-5 text-center text-sm text-ink-soft">
          {mode === "login" ? "New to Jorna? " : "Already have an account? "}
          <button
            type="button"
            className="font-semibold text-gold underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
