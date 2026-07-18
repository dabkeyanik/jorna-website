"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui";

function LoginInner() {
  const { login, register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/plan";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
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
        });
      }
      router.push(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-[min(460px,100%-2rem)] py-14">
      <h1 className="serif text-center text-4xl text-maroon dark:text-gold">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-center text-ink-soft">
        {mode === "login"
          ? "Sign in to build and book your celebration."
          : "A few details and you're planning."}
      </p>

      <Card className="mt-8 p-6">
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
            hint={mode === "register" ? "At least 8 characters." : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error ? (
            <p className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={busy} className="mt-1">
            {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </Card>

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
