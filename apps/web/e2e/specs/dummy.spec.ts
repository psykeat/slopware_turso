import { test, expect } from "@playwright/test";

test("basic test to ensure E2E framework is running", async ({ page }) => {
  await page.goto("/");
  // Since we are authenticated as the E2E user, we should be redirected into the app or see some specific UI.
  // For now, just ensure the page loads.
  await expect(page).toHaveTitle(/slopware/i);
});
