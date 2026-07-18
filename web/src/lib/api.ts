// Typed client for the Jorna backend. Handles bearer auth, one automatic token
// refresh on a 401, and JSON (de)serialization. Token storage is pluggable so
// the auth layer owns persistence (localStorage) — this module stays UI-free.

import type { TokenPair } from "./types";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://desiconnect-production.up.railway.app"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Token access is injected by the auth provider so this module has no React
// dependency and can be used from anywhere (including future server actions).
type TokenAccess = {
  getAccess: () => string | null;
  getRefresh: () => string | null;
  onRefreshed: (tokens: TokenPair) => void;
  onAuthLost: () => void;
};

let tokens: TokenAccess = {
  getAccess: () => null,
  getRefresh: () => null,
  onRefreshed: () => {},
  onAuthLost: () => {},
};

export function configureTokens(access: TokenAccess) {
  tokens = access;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((d: { msg?: string; loc?: string[] }) => d.msg ?? "")
        .filter(Boolean)
        .join(", ");
    }
    return data?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  auth?: boolean; // attach bearer token (default true)
  retry?: boolean; // internal — prevents infinite refresh loop
}

export async function apiFetch<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, auth = true, retry = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const access = auth ? tokens.getAccess() : null;
  if (access) headers.Authorization = `Bearer ${access}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // One transparent refresh attempt on an expired token.
  if (res.status === 401 && auth && retry && tokens.getRefresh()) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiFetch<T>(path, { ...opts, retry: false });
    tokens.onAuthLost();
  }

  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Multipart upload, with the same auth + one-retry refresh behaviour.
 *
 * Deliberately does NOT set Content-Type — the browser has to write that itself
 * so it can include the multipart boundary. Setting it by hand yields a body
 * the server can't parse.
 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  opts: { method?: string; retry?: boolean } = {},
): Promise<T> {
  const { method = "POST", retry = true } = opts;
  const headers: Record<string, string> = {};
  const access = tokens.getAccess();
  if (access) headers.Authorization = `Bearer ${access}`;

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: form });

  if (res.status === 401 && retry && tokens.getRefresh()) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiUpload<T>(path, form, { ...opts, retry: false });
    tokens.onAuthLost();
  }

  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function tryRefresh(): Promise<boolean> {
  const refresh_token = tokens.getRefresh();
  if (!refresh_token) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    if (!res.ok) return false;
    const pair = (await res.json()) as TokenPair;
    tokens.onRefreshed(pair);
    return true;
  } catch {
    return false;
  }
}
