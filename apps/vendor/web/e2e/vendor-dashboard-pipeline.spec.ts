import { test, expect } from "./support/fixtures";
import { loginAs } from "./support/fixtures";
import { mockLead, mockVendorDetail } from "./support/mock-data";

// The pipeline board and Leads view, folded into /my-dashboard from the old
// /my-pipeline route in the 2026-09 sidebar redesign (see docs/DECISIONS.md).
// Clients moved to its own route/spec (vendor-clients.spec.ts) instead of
// staying a view tab here.
test.describe("vendor dashboard pipeline (/my-dashboard)", () => {
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

    await page.goto("my-dashboard/");
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
});
