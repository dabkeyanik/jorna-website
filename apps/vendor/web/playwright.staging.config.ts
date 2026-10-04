import { defineConfig, devices } from "@playwright/test";

// The staging checks: the deployed staging site against the staging backend
// and its own database — real requests, no mocks (the mocked suite is
// playwright.config.ts, over e2e/). Run by CI after every deploy to staging;
// locally with STAGING_API_BASE_URL and the STAGING_E2E_* passwords set.
//
// One worker and no retries: the flows share two real accounts and walk a
// contract through its life, so they run in order and a failure means
// something actually broke.

const VENDOR_URL = (process.env.STAGING_VENDOR_URL ?? "https://staging.jorna-vendor.pages.dev").replace(/\/$/, "");

export default defineConfig({
  testDir: "./e2e-staging",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-staging" }]] : "list",
  use: {
    baseURL: `${VENDOR_URL}/app/`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
