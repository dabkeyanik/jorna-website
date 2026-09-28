import { test, expect } from "./support/fixtures";

// The three pages Home's long scroll was trimmed into (2026-09) — see
// docs/DECISIONS.md. Thin smoke coverage: each renders its headline and the
// nav actually reaches it, which is the one thing that changed behavior
// (they used to be #how/#vendors anchors on Home, not real routes).
test.describe("marketing pages (How it works / For clients / For vendors)", () => {
  test("SiteHeader's signed-out nav reaches all three real pages", async ({ page }) => {
    await page.goto("");

    // exact: true — "How it works" is also a substring of the "learn more"
    // card link's accessible name (title + body + "Learn more →" all in one
    // link), which would otherwise match too.
    await page.getByRole("link", { name: "How it works", exact: true }).click();
    await expect(page).toHaveURL(/\/how-it-works\/?$/);
    await expect(
      page.getByRole("heading", { name: "Plan your entire celebration in three steps." }),
    ).toBeVisible();

    await page.goto("");
    await page.getByRole("link", { name: "For clients", exact: true }).click();
    await expect(page).toHaveURL(/\/for-clients\/?$/);
    await expect(
      page.getByRole("heading", { name: "Clear terms before you pay." }),
    ).toBeVisible();

    await page.goto("");
    await page.getByRole("link", { name: "For vendors", exact: true }).click();
    await expect(page).toHaveURL(/\/for-vendors\/?$/);
    await expect(
      page.getByRole("heading", { name: "List your packages. Get booked. Get paid." }),
    ).toBeVisible();
  });

  test("Home's \"learn more\" cards link to the same three pages", async ({ page }) => {
    await page.goto("");
    await page.getByRole("link", { name: /Learn more/ }).first().click();
    await expect(page).toHaveURL(/\/how-it-works\/?$/);
  });
});
