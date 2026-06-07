# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs/email-service.spec.ts >> Email Service Routes (Workflow Integration) >> should enqueue an email sync job via UI command palette
- Location: e2e/specs/email-service.spec.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=slopware.at@gmail.com')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=slopware.at@gmail.com')

```

```yaml
- link "Slopware":
    - /url: /
- heading "Welcome back to Slopware" [level=1]
- text: Email
- textbox "Email":
    - /placeholder: hello@example.com
- text: Password
- textbox "Password":
    - /placeholder: Enter password here
- button "Login"
- text: Don't have an account?
- link "Sign up":
    - /url: /signup
- region "Notifications alt+T"
- button "Open TanStack Devtools":
    - img "TanStack Devtools"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  |
  3  | test.describe('Email Service Routes (Workflow Integration)', () => {
  4  |   test('should enqueue an email sync job via UI command palette', async ({ page }) => {
  5  |     // 1. Navigate to the email app
  6  |     await page.goto('/app/email');
  7  |
  8  |     // Wait for the app to settle and the command palette to be registered
  9  |     // We expect the email to show up if it's connected
> 10 |     await expect(page.locator('text=slopware.at@gmail.com')).toBeVisible({ timeout: 10000 });
     |                                                              ^ Error: expect(locator).toBeVisible() failed
  11 |
  12 |     // 2. Open Command Palette
  13 |     const palette = page.getByRole('dialog', { name: 'Command Palette' });
  14 |     await expect(async () => {
  15 |       await page.keyboard.press('Control+k');
  16 |       await expect(palette).toBeVisible({ timeout: 500 });
  17 |     }).toPass({ timeout: 5000 });
  18 |
  19 |     // 3. Search and execute "Sync email account"
  20 |     const searchInput = palette.getByPlaceholder('Search commands…');
  21 |     await searchInput.fill('Sync email account');
  22 |
  23 |     // Wait for the command to be visible
  24 |     await expect(palette.locator('button:has-text("Sync email account")').first()).toBeVisible();
  25 |     await page.keyboard.press('Enter');
  26 |
  27 |     // 4. Assert the success toast from the API response
  28 |     // The "Email sync queued" toast indicates that the Workflow route was successfully hit and returned OK.
  29 |     const toast = page.locator('text=Email sync queued');
  30 |     await expect(toast).toBeVisible({ timeout: 5000 });
  31 |   });
  32 | });
  33 |
```
