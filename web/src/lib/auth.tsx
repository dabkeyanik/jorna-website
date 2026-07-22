"use client";

// Auth state for the web app. Email/password authenticates directly against the
// backend (/auth/login, /auth/register) which issues Jorna's own JWT + refresh
// token; those are persisted in localStorage and attached to every API call via
// the api client. Google OAuth goes through Supabase, then exchanges its token
// for a Jorna session via adoptSession (see /auth/callback and lib/supabase).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiFetch, configureTokens } from "./api";
import type { TokenPair, User } from "./types";

const ACCESS_KEY = "jorna_access";
const REFRESH_KEY = "jorna_refresh";

interface RegisterInput {
  email: string;
  password: string;
  username: string;
  f_name: string;
  l_name: string;
  age: number;
  location: string;
  gender: string;
  language: string;
  phone?: string;
  // Set when completing a Google sign-up: links the new account to the Supabase
  // identity. The backend proves ownership from the token (matching sub + email).
  supabase_user_id?: string;
  supabase_access_token?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  /** Adopt a Jorna token pair obtained outside the password flow (Google). */
  adoptSession: (pair: TokenPair) => Promise<void>;
  logout: () => void;
  /** Set the current user directly (e.g. after editing the profile). */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Tokens live in refs so the api client reads the latest value without
  // re-registering on every render.
  const access = useRef<string | null>(null);
  const refresh = useRef<string | null>(null);

  const persist = useCallback((pair: TokenPair | null) => {
    access.current = pair?.access_token ?? null;
    refresh.current = pair?.refresh_token ?? null;
    if (typeof window === "undefined") return;
    if (pair) {
      localStorage.setItem(ACCESS_KEY, pair.access_token);
      localStorage.setItem(REFRESH_KEY, pair.refresh_token);
    } else {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    }
  }, []);

  const clear = useCallback(() => {
    persist(null);
    setUser(null);
  }, [persist]);

  // Wire the api client to our token storage (once).
  useEffect(() => {
    configureTokens({
      getAccess: () => access.current,
      getRefresh: () => refresh.current,
      onRefreshed: (pair) => persist(pair),
      onAuthLost: () => clear(),
    });
  }, [persist, clear]);

  // Hydrate from storage on first load: if we have a token, fetch the profile.
  useEffect(() => {
    const a = typeof window !== "undefined" ? localStorage.getItem(ACCESS_KEY) : null;
    const r = typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
    access.current = a;
    refresh.current = r;
    if (!a) {
      setLoading(false);
      return;
    }
    apiFetch<User>("/me")
      .then(setUser)
      .catch(() => clear())
      .finally(() => setLoading(false));
  }, [clear]);

  const afterTokens = useCallback(async (pair: TokenPair) => {
    persist(pair);
    const me = await apiFetch<User>("/me");
    setUser(me);
  }, [persist]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const pair = await apiFetch<TokenPair>("/auth/login", {
        method: "POST",
        auth: false,
        body: { identifier, password },
      });
      await afterTokens(pair);
    },
    [afterTokens],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      // /auth/register creates the account but returns only {user_id, email} —
      // it doesn't issue tokens. Establish the session by logging in after, with
      // the credentials just set (works for Google sign-ups too: the linked
      // account still has this password).
      await apiFetch<{ user_id: string; email: string }>("/auth/register", {
        method: "POST",
        auth: false,
        body: input,
      });
      const pair = await apiFetch<TokenPair>("/auth/login", {
        method: "POST",
        auth: false,
        body: { identifier: input.email, password: input.password },
      });
      await afterTokens(pair);
    },
    [afterTokens],
  );

  // Persist a token pair we already hold (e.g. from /auth/google/lookup) and
  // load the profile — the Google equivalent of finishing login().
  const adoptSession = useCallback(
    async (pair: TokenPair) => {
      await afterTokens(pair);
    },
    [afterTokens],
  );

  const value = useMemo(
    () => ({ user, loading, login, register, adoptSession, logout: clear, setUser }),
    [user, loading, login, register, adoptSession, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
