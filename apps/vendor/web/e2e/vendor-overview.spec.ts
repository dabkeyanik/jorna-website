import { test, expect } from "./support/fixtures";
import { loginAs } from "./support/fixtures";
import { mockLead, mockVendorBooking, mockVendorDetail } from "./support/mock-data";

// Overview (vendor redesign step 1): a summary of the other pages. These pin
// the parts with logic — which bookings count as what, and where old links go.

function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mockOverview(api: import("./support/api-mock").ApiMock) {
  const vendor = mockVendorDetail();
  api.get("/vendors/me", vendor);
  api.get(`/bookings/vendor/${vendor.vendor_id}`, {
    items: [
      // Signed, deposit not in yet: the next event, and "Deposit due".
      mockVendorBooking({
        booking_id: "signed",
        event_name: "Meera & Arjun",
        status: "approved",
        contract_token: "tok",
        signed_at: "2026-09-01T00:00:00Z",
        deposit_percent: 30,
        deposit_amount_cents: 75000,
        date_iso: isoInDays(12),
      }),
      // A marketplace request: a lead waiting on the vendor, not a booking.
      mockVendorBooking({ booking_id: "request", event_name: "Priya's Wedding", status: "pending", date_iso: isoInDays(40) }),
      // Happened, not paid off: stays under Over.
      mockVendorBooking({
        booking_id: "past",
        event_name: "Sana & Omar",
        status: "approved",
        date_iso: isoInDays(-6),
        payment_status: "unpaid",
      }),
    ],
    total: 3,
    limit: 100,
    offset: 0,
  });
  api.get("/leads", { items: [mockLead()], total: 1 });
  api.get("/conversations", [
    {
      conversation_id: "c1",
      name: "Meera Kapoor",
      unread_count: 2,
      last_message: { content: "Can we add a second shooter?", created_at: new Date().toISOString() },
    },
  ]);
  api.get("/conversations/unread-count", { unread_count: 2 });
  return vendor;
}

test.describe("vendor overview (/overview)", () => {
  test("summarises leads, the next event, bookings and the inbox", async ({ page, api }) => {
    await loginAs(page, api);
    mockOverview(api);

    await page.goto("overview/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Priya");
    await expect(page.getByRole("link", { name: "New contract" })).toHaveAttribute("href", /\/contracts\/new\/?$/);

    // The request and the informal lead are both open; both wait on a reply.
    await expect(page.getByText("2 need your reply")).toBeVisible();

    await expect(page.getByText("Next event")).toBeVisible();
    await expect(page.getByText("In 12 days")).toBeVisible();

    const bookings = page.getByRole("region", { name: "Bookings" });
    await expect(page.getByRole("tab", { name: /Deposit due/ })).toContainText("1");
    await expect(page.getByText("$750")).toBeVisible();
    // The request isn't a booking yet.
    await expect(bookings.getByText("Priya's Wedding")).toHaveCount(0);

    await page.getByRole("tab", { name: /Over/ }).click();
    await expect(bookings.getByText("Sana & Omar")).toBeVisible();
    await expect(bookings.getByText("Meera & Arjun")).toHaveCount(0);

    await expect(page.getByRole("link", { name: /Meera Kapoor/ })).toHaveAttribute("href", /conversation\/?\?id=c1/);
  });

  test("the sidebar lights Overview", async ({ page, api }) => {
    await loginAs(page, api);
    mockOverview(api);

    await page.goto("overview/");

    await expect(
      page.getByRole("navigation", { name: "Vendor" }).getByRole("link", { name: "Overview" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("an old ?view=leads link lands on /leads", async ({ page, api }) => {
    await loginAs(page, api);
    mockOverview(api);

    await page.goto("overview/?view=leads");

    await expect(page).toHaveURL(/\/leads\/?$/);
    await expect(page.getByRole("heading", { name: "Leads", level: 1 })).toBeVisible();
  });
});
