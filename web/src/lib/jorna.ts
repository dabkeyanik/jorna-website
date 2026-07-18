// High-level Jorna API calls used by the UI.

import { apiFetch } from "./api";
import type { BundleRequest, MultiBundleResponse } from "./types";

/** Generate the three comparison bundles (Budget / Balanced / Top Rated). */
export function generateBundles(req: BundleRequest): Promise<MultiBundleResponse> {
  return apiFetch<MultiBundleResponse>("/chatbot/bundles", {
    method: "POST",
    body: req,
  });
}
