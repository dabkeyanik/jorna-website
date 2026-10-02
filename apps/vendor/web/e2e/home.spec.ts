import { test, expect } from "./support/fixtures";
import { loginAs } from "./support/fixtures";
import { mockVendorDetail, mockVendorSearchResponse } from "./support/mock-data";

test.describe("home (marketing) page", () => {
  test("renders for a signed-out visitor and shows the live vendor showcase", async ({
    page,
    api,
  }) => {
    api.get("/vendors/search", mockVendorSearchResponse());

    await page.goto("");

    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started", exact: true })).toBeVisible();

    // Vendor showcase is real data from /vendors/search, not placeholder copy
    // (see the header comment in app/home/page.tsx) — assert the mocked row
    // actually rendered.
    await expect(page.getByText("Anjali Kapoor")).toBeVisible();
    await expect(page.getByText("Full Day Wedding Photography")).toBeVisible();

    // Home's own way to browse goes to the client app's marketplace.
    await expect(page.getByRole("link", { name: /See all vendors/ })).toHaveAttribute(
      "href",
      /^https:\/\/[^/]+\/app\/marketplace$/,
    );

    // "Browse vendors" is a signed-in-client nav item now (NO_VENDOR_TABS),
    // not something advertised to a stranger who hasn't signed up — see
    // docs/DECISIONS.md. Home's own in-page buttons still say "Browse
    // vendors" (unaffected), so this specifically checks the header's own
    // persistent nav, not the page content.
    await expect(
      page.getByRole("navigation", { name: "About Jorna" }).getByRole("link", { name: "Browse vendors" }),
    ).not.toBeVisible();
  });

  test("a signed-in client (not a vendor) sees Browse vendors in the header nav", async ({
    page,
    api,
  }) => {
    await loginAs(page, api);
    api.error("GET", "/vendors/me", 404, "Not a vendor");
    api.get("/vendors/search", mockVendorSearchResponse());

    await page.goto("home/");

    const link = page.getByRole("navigation", { name: "Primary" }).getByRole("link", {
      name: "Browse vendors",
    });
    await expect(link).toBeVisible();
    // The marketplace lives in the client app; /browse here only redirects Home.
    await expect(link).toHaveAttribute("href", /^https:\/\/[^/]+\/app\/marketplace$/);
  });

  test("still renders the marketing content if the vendor showcase fails to load", async ({
    page,
    api,
  }) => {
    api.error("GET", "/vendors/search", 500, "Internal server error");

    await page.goto("");

    await expect(page.getByRole("link", { name: "Get started", exact: true })).toBeVisible();
  });

  // Home is a pitch a vendor has already bought — see VendorHomeRedirect.
  test("a signed-in vendor landing on the site root goes to their dashboard", async ({
    page,
    api,
  }) => {
    await loginAs(page, api);
    const vendor = mockVendorDetail();
    api.get("/vendors/me", vendor);
    api.get("/vendors/search", mockVendorSearchResponse());
    api.get(`/bookings/vendor/${vendor.vendor_id}`, { items: [], total: 0, limit: 100, offset: 0 });
    api.get("/leads", { items: [], total: 0 });

    await page.goto("");

    await expect(page).toHaveURL(/\/overview\/?$/);
    await expect(page.getByText("Your entire celebration team")).not.toBeVisible();
  });

  test("a signed-in client still gets Home at the site root", async ({ page, api }) => {
    await loginAs(page, api);
    api.error("GET", "/vendors/me", 404, "Not a vendor");
    api.get("/vendors/search", mockVendorSearchResponse());

    await page.goto("");

    await expect(page.getByText("Your entire celebration team")).toBeVisible();
    await expect(page).not.toHaveURL(/overview/);
  });
});
