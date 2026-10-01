import { test, expect } from "./support/fixtures";
import { loginAs } from "./support/fixtures";
import { mockLead, mockVendorDetail } from "./support/mock-data";

// The pipeline board on /my-dashboard, and the leads list that used to be its
// "Leads" view tab and is /leads since the 2026-10 vendor redesign.
test.describe("vendor dashboard pipeline (/my-dashboard)", () => {
  test("the Board shows an open lead, and Leads is where you add one", async ({
    page,
    api,
  }) => {
    await loginAs(page, api);
    const vendor = mockVendorDetail();
    api.get("/vendors/me", vendor);
    api.get(`/bookings/vendor/${vendor.vendor_id}`, { items: [], total: 0, limit: 100, offset: 0 });
    api.get("/leads", { items: [mockLead()], total: 1 });
    api.post("/leads", mockLead({ lead_id: "lead-2", name: "New Prospect" }));

    await page.goto("my-dashboard/");
    await expect(page.getByText("Anjali Rao")).toBeVisible();

    await page.getByRole("navigation", { name: "Vendor" }).getByRole("link", { name: "Leads" }).click();
    await expect(page).toHaveURL(/\/leads\/?$/);
    await expect(page.getByText("Anjali Rao")).toBeVisible();

    await page.getByRole("button", { name: "+ New lead" }).click();
    await page.getByLabel("Name").fill("New Prospect");
    await page.getByRole("button", { name: "Save lead" }).click();

    await expect(page.getByText("New Prospect")).toBeVisible();
    const postCalls = api.requestsTo("POST", "/leads");
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0].body).toMatchObject({ name: "New Prospect" });
  });

  test("an old ?view=leads link lands on /leads", async ({ page, api }) => {
    await loginAs(page, api);
    const vendor = mockVendorDetail();
    api.get("/vendors/me", vendor);
    api.get(`/bookings/vendor/${vendor.vendor_id}`, { items: [], total: 0, limit: 100, offset: 0 });
    api.get("/leads", { items: [mockLead()], total: 1 });

    await page.goto("my-dashboard/?view=leads");

    await expect(page).toHaveURL(/\/leads\/?$/);
    await expect(page.getByRole("heading", { name: "Leads", level: 1 })).toBeVisible();
  });
});
