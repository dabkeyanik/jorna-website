import { test, expect } from "./support/fixtures";
import { loginAs } from "./support/fixtures";
import { mockLead, mockVendorClient, mockVendorDetail } from "./support/mock-data";

// /my-pipeline folds in the old /my-leads and /my-clients routes as view
// tabs (?view=leads / ?view=clients) — this covers the merged surface,
// which had no E2E coverage under either of its old routes.
test.describe("vendor pipeline (/my-pipeline)", () => {
  test("the Board shows an open lead, and the Leads tab is where you add one", async ({
    page,
    api,
  }) => {
    await loginAs(page, api);
    const vendor = mockVendorDetail();
    api.get("/vendors/me", vendor);
    api.get(`/bookings/vendor/${vendor.vendor_id}`, { items: [], total: 0, limit: 100, offset: 0 });
    api.get("/leads", { items: [mockLead()], total: 1 });
    api.post("/leads", mockLead({ lead_id: "lead-2", name: "New Prospect" }));

    await page.goto("my-pipeline/");
    await expect(page.getByText("Anjali Rao")).toBeVisible();

    await page.getByRole("link", { name: "Leads" }).click();
    await expect(page).toHaveURL(/\?view=leads/);
    await expect(page.getByText("Anjali Rao")).toBeVisible();

    await page.getByRole("button", { name: "+ New lead" }).click();
    await page.getByLabel("Name").fill("New Prospect");
    await page.getByRole("button", { name: "Save lead" }).click();

    await expect(page.getByText("New Prospect")).toBeVisible();
    const postCalls = api.requestsTo("POST", "/leads");
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0].body).toMatchObject({ name: "New Prospect" });
  });

  test("the Clients tab lists everyone the vendor has booked", async ({ page, api }) => {
    await loginAs(page, api);
    const vendor = mockVendorDetail();
    api.get("/vendors/me", vendor);
    api.get(`/bookings/vendor/${vendor.vendor_id}`, { items: [], total: 0, limit: 100, offset: 0 });
    api.get("/leads", { items: [], total: 0 });
    api.get("/vendors/me/clients", { items: [mockVendorClient()], total: 1 });

    await page.goto("my-pipeline/?view=clients");

    await expect(page.getByText("Priya Shah")).toBeVisible();
    await expect(page.getByText("$2,500")).toBeVisible();
  });
});
