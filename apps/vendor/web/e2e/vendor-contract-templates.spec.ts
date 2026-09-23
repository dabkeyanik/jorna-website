import { test, expect } from "./support/fixtures";
import { loginAs } from "./support/fixtures";
import { mockTaxonomyCategories, mockVendorDetail } from "./support/mock-data";

// Named contract-term presets (HONEYBOOK_PARITY_PLAN.md §1.1) — stored in
// this browser's localStorage (lib/contractTemplates.ts), not on the
// account, so this covers the one thing that isn't obvious from reading the
// code: it round-trips across a real navigation between /contracts/new
// (where it's saved and loaded) and /vendor-profile (where it's managed).
test.describe("contract templates (/contracts/new, /vendor-profile)", () => {
  test("saves a template, reloads it, and deletes it from Settings", async ({ page, api }) => {
    await loginAs(page, api);
    const vendor = mockVendorDetail();
    api.get("/vendors/me", vendor);
    api.get("/services", {
      items: [
        { service_id: "svc-1", vendor_id: vendor.vendor_id, name: "4-Hour Reception Package", price: 1400 },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    });

    await page.goto("contracts/new/");
    await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible();

    await page.getByLabel("Deposit (%)").fill("50");
    await page.getByLabel("Cancellation window (hours)").fill("720");
    await page.getByLabel("Overtime rate ($/hr)").fill("150");

    await page.getByRole("button", { name: "Save these terms as a template" }).click();
    await page.getByPlaceholder("Template name, e.g. Standard DJ package").fill("Standard DJ terms");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // The picker now offers it, and the save form closed back down.
    await expect(page.getByLabel("Contract template")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save these terms as a template" }),
    ).toBeVisible();

    // Clear the fields, then loading the template puts the values back.
    await page.getByLabel("Deposit (%)").fill("");
    await page.getByLabel("Contract template").selectOption({ label: "Standard DJ terms" });
    await expect(page.getByLabel("Deposit (%)")).toHaveValue("50");
    await expect(page.getByLabel("Overtime rate ($/hr)")).toHaveValue("150");

    // Manage it from Settings — same localStorage, a real navigation away.
    api.get("/vendors/categories", { categories: mockTaxonomyCategories() });
    api.get("/reviews/vendor/vendor-1", { items: [], total: 0 });

    await page.goto("vendor-profile/");
    await expect(page.getByRole("heading", { name: "Saved contract templates" })).toBeVisible();
    await expect(page.getByText("Standard DJ terms")).toBeVisible();

    await page.getByRole("button", { name: "Delete template" }).click();
    await expect(page.getByRole("heading", { name: "Saved contract templates" })).not.toBeVisible();
  });
});
