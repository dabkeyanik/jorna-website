import { test, expect } from "./support/fixtures";
import { loginAs } from "./support/fixtures";
import { mockTaxonomyCategories, mockVendorDetail } from "./support/mock-data";

// Contract templates live on the vendor's account (backend 0065) and hold a
// reusable proposal — items, payment plan as shares of the total, clauses.
// Covers saving one from the builder, starting a contract from one, managing
// them in Settings, and the one-time move of templates this browser saved
// before they were on the account.
test.describe("contract templates (/contracts/new, /vendor-profile)", () => {
  const services = (vendorId: string) => ({
    items: [
      { service_id: "svc-1", vendor_id: vendorId, name: "4-Hour Reception Package", price: 1400, add_ons: [] },
    ],
    total: 1,
    limit: 100,
    offset: 0,
  });

  test("saves the builder's contract as a template on the account", async ({ page, api }) => {
    await loginAs(page, api);
    const vendor = mockVendorDetail();
    api.get("/vendors/me", vendor);
    api.get("/services", services(vendor.vendor_id));
    api.get("/contract-templates", { items: [], total: 0 });
    api.post("/contract-templates", {
      template_id: "t-1",
      name: "Standard DJ package",
      body: {},
      created_at: "2030-01-01T00:00:00",
      updated_at: "2030-01-01T00:00:00",
    });

    await page.goto("contracts/new/");
    await page.getByRole("button", { name: "3. Items" }).click();
    await page.getByLabel("Add a package").selectOption("svc-1");
    await page.getByRole("button", { name: "4. Payments" }).click();
    await page.getByRole("button", { name: "Deposit + balance" }).click();
    await page.getByRole("button", { name: "5. Terms" }).click();
    await page.getByRole("button", { name: "+ Travel" }).click();
    await page.getByRole("button", { name: "6. Review & send" }).click();

    await page.getByLabel("Template name").fill("Standard DJ package");
    await page.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByText("Saved “Standard DJ package” to your templates.")).toBeVisible();

    const [call] = api.requestsTo("POST", "/contract-templates");
    expect(call.body).toMatchObject({
      name: "Standard DJ package",
      body: {
        version: 1,
        lines: [{ kind: "package", serviceId: "svc-1", price: "1400" }],
        schedule: [
          { label: "Deposit", percent: 50, dueType: "on_signing" },
          { label: "Final balance", percent: 50, dueType: "before_event", dueDays: "14" },
        ],
        clauses: [{ title: "Travel" }],
      },
    });
  });

  test("starting from a template fills items and a schedule that fits the total", async ({ page, api }) => {
    await loginAs(page, api);
    const vendor = mockVendorDetail();
    api.get("/vendors/me", vendor);
    api.get("/services", services(vendor.vendor_id));
    api.get("/contract-templates", {
      items: [
        {
          template_id: "t-1",
          name: "Sangeet",
          body: {
            version: 1,
            lines: [
              { kind: "package", serviceId: "svc-1", addonId: null, name: "4-Hour Reception Package", unit: "event", price: "2000", quantity: "1" },
            ],
            schedule: [
              { label: "Deposit", percent: 30, dueType: "on_signing", dueDays: "" },
              { label: "Balance", percent: 70, dueType: "before_event", dueDays: "7" },
            ],
            clauses: [{ title: "Meals", body: "Dinner for two." }],
          },
          created_at: "2030-01-01T00:00:00",
          updated_at: "2030-01-01T00:00:00",
        },
      ],
      total: 1,
    });

    await page.goto("contracts/new/");
    await page.getByLabel("Start from a template").selectOption({ label: "Sangeet" });
    await page.getByRole("button", { name: "4. Payments" }).click();
    await expect(page.getByLabel("Amount ($)").first()).toHaveValue("600");
    await expect(page.getByLabel("Amount ($)").last()).toHaveValue("1400");
    await page.getByRole("button", { name: "5. Terms" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Meals");
  });

  test("moves templates saved in this browser onto the account, then lists them in Settings", async ({
    page,
    api,
  }) => {
    await loginAs(page, api);
    // Seed once — addInitScript runs on every navigation.
    await page.addInitScript(() => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(
        "jorna_contract_templates",
        JSON.stringify([
          { id: "old", name: "Old terms", depositPercent: "25", cancellationWindowHours: "720", overtimeRate: "150", equipmentPower: "", travel: "30 miles" },
        ]),
      );
    });
    const vendor = mockVendorDetail();
    api.get("/vendors/me", vendor);
    api.get("/vendors/categories", { categories: mockTaxonomyCategories() });
    api.get("/reviews/vendor/vendor-1", { items: [], total: 0 });
    api.post("/contract-templates", {
      template_id: "t-old",
      name: "Old terms",
      body: {},
      created_at: "2030-01-01T00:00:00",
      updated_at: "2030-01-01T00:00:00",
    });
    api.get("/contract-templates", {
      items: [
        { template_id: "t-old", name: "Old terms", body: {}, created_at: "2030-01-01T00:00:00", updated_at: "2030-01-01T00:00:00" },
      ],
      total: 1,
    });
    api.delete("/contract-templates/t-old", { message: "Template deleted" });

    await page.goto("vendor-profile/");
    await expect(page.getByRole("heading", { name: "Saved contract templates" })).toBeVisible();
    await expect(page.getByText("Old terms")).toBeVisible();

    const [upload] = api.requestsTo("POST", "/contract-templates");
    expect(upload.body).toMatchObject({
      name: "Old terms",
      body: {
        schedule: [{ percent: 25 }, { percent: 75 }],
        cancellationDays: "30",
        overtimeRate: "150",
        clauses: [{ title: "Travel", body: "30 miles" }],
      },
    });
    expect(await page.evaluate(() => localStorage.getItem("jorna_contract_templates"))).toBeNull();

    await page.getByRole("button", { name: "Delete template" }).click();
    await expect(page.getByRole("heading", { name: "Saved contract templates" })).not.toBeVisible();
    expect(api.requestsTo("DELETE", "/contract-templates/t-old")).toHaveLength(1);
  });
});
