import { test, expect } from "./support/fixtures";
import { loginAs } from "./support/fixtures";
import { mockVendorClient, mockVendorDetail } from "./support/mock-data";

// /clients — promoted out of /my-pipeline's "Clients" view tab in the 2026-09
// sidebar redesign (see docs/DECISIONS.md), now its own top-level page with
// stat tiles and a search box.
test.describe("vendor clients (/clients)", () => {
  test("lists everyone the vendor has booked, with a search box", async ({ page, api }) => {
    await loginAs(page, api);
    const vendor = mockVendorDetail();
    api.get("/vendors/me", vendor);
    api.get("/vendors/me/clients", {
      items: [
        mockVendorClient(),
        mockVendorClient({ key: "c2", name: "Rohan Iyer", lifetime_value_cents: 90000 }),
      ],
      total: 2,
    });

    await page.goto("clients/");

    await expect(page.getByText("Priya Shah")).toBeVisible();
    await expect(page.getByText("$2,500", { exact: true })).toBeVisible();
    await expect(page.getByText("Rohan Iyer")).toBeVisible();

    await page.getByPlaceholder("Search clients…").fill("Rohan");
    await expect(page.getByText("Rohan Iyer")).toBeVisible();
    await expect(page.getByText("Priya Shah")).not.toBeVisible();
  });
});
