import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, configureTokens } from "./api";

// The backend rotates the refresh token on every use and wipes every session
// when an old one is used again, so a refresh must never be replayed.
describe("refreshing an expired access token", () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(store: { access: string; refresh: string }) {
    const lost = vi.fn();
    configureTokens({
      getAccess: () => store.access,
      getRefresh: () => store.refresh,
      onRefreshed: (pair) => {
        store.access = pair.access_token;
        store.refresh = pair.refresh_token;
      },
      onAuthLost: lost,
    });
    return lost;
  }

  it("shares one refresh between requests that all hit the expiry together", async () => {
    const store = { access: "old", refresh: "r1" };
    const lost = setup(store);
    const refreshes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/auth/refresh")) {
          refreshes.push(JSON.parse(String(init.body)).refresh_token);
          return new Response(JSON.stringify({ access_token: "new", refresh_token: "r2", token_type: "bearer" }));
        }
        const auth = (init.headers as Record<string, string>).Authorization;
        return auth === "Bearer new"
          ? new Response(JSON.stringify({ ok: true }))
          : new Response(JSON.stringify({ detail: "expired" }), { status: 401 });
      }),
    );

    const results = await Promise.all([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshes).toEqual(["r1"]);
    expect(lost).not.toHaveBeenCalled();
  });

  it("uses the pair another tab already got instead of replaying the old token", async () => {
    const store = { access: "old", refresh: "r1" };
    setup(store);
    const refreshes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/auth/refresh")) {
          refreshes.push(JSON.parse(String(init.body)).refresh_token);
          return new Response("{}", { status: 401 });
        }
        const auth = (init.headers as Record<string, string>).Authorization;
        if (auth === "Bearer old") {
          // While this request was in flight, another tab refreshed.
          store.access = "fresh";
          store.refresh = "r2";
          return new Response(JSON.stringify({ detail: "expired" }), { status: 401 });
        }
        return new Response(JSON.stringify({ ok: true }));
      }),
    );

    await expect(apiFetch("/a")).resolves.toEqual({ ok: true });
    expect(refreshes).toEqual([]);
  });
});
