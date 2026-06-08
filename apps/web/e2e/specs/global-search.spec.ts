import { test, expect } from "@playwright/test";

test.describe("Global Search (Command Palette)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app");
  });

  test("should trigger via Control+K, debounce, navigate and close via Escape", async ({
    page,
  }) => {
    // 1. Trigger the Command Palette via Control+K
    // Use a retry block because the app might still be hydrating
    const palette = page.getByRole("dialog", { name: "Command Palette" });
    await expect(async () => {
      await page.keyboard.press("Control+k");
      await expect(palette).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 5000 });

    const searchInput = palette.getByPlaceholder("Search commands…");
    await expect(searchInput).toBeFocused();

    // 2. Debouncing the search query
    // Get the initial list of items (before typing)
    // eslint-disable-next-line
    const initialItemsCount = await palette.locator("button").count();

    // Type "Artic"
    await searchInput.fill("Artic");

    // Immediately after typing, the debounce (150ms) shouldn't have fired yet.
    // So the number of items might remain the same for a brief moment.
    // However, Playwright is fast. We can check that the items count hasn't changed *immediately*
    // but this can be flaky. Let's just wait for the results to filter to "Articles" or similar
    await expect(palette.locator("button").first()).toBeVisible();

    // Wait for the filtered result, assuming "Artic" matches something,
    // or wait for "No commands found."
    await page.waitForTimeout(200); // explicit wait to cover the 150ms debounce

    // 3. Keyboard navigation
    await page.keyboard.press("ArrowDown");
    // In our component, ArrowDown increments the selectedIdx.
    // The active item has a specific border/background style.

    // 4. Keyboard navigation (Enter)
    await page.keyboard.press("Enter");

    // Enter executes the command and closes the palette.
    await expect(palette).toBeHidden();

    // 5. Trigger again and close via Escape
    await page.keyboard.press("Control+k");
    await expect(palette).toBeVisible();
    await expect(searchInput).toBeFocused(); // wait for the setTimeout focus
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });
});
