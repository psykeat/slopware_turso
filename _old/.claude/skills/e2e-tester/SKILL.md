---
name: e2e-tester
description: Write, run, and maintain End-to-End tests using Playwright. Instructs how to interact with our Generic UI and how to seed test data.
---

# E2E Tester Skill

You are responsible for writing, maintaining, and running End-to-End (E2E) tests for the `slopware` platform.

## 1. Testing Boundaries: E2E vs Integration

Before writing an E2E test, stop and ask yourself what is actually being tested.

- **Frontend / UI Flow**: If the goal is to test that a user can click a button, open a modal, trigger a search, or see a toast message, **Playwright (E2E)** is the right tool.
- **Backend Asynchronous Jobs / Workflows**: If the goal is to test that a background job (like an email sync queue, payment processing, or `@tanstack/workflow-core` integration) executes successfully and updates the database, **DO NOT use Playwright**. E2E tests are blind to silent background failures. These should be tested using **Backend Integration Tests** (e.g., using Vitest to programmatically enqueue the job and assert the database state).

## 2. Testing Stack

- **Framework**: `@playwright/test`
- **Location**: `apps/web/e2e/`
- **Configuration**: `apps/web/playwright.config.ts`

## 2. Authentication & Setup

Tests are run against the base tenant of the local development database.

- The `setup` project in Playwright automatically runs `e2e/setup/auth.setup.ts`.
- This setup script seeds the database with required fixtures (using Drizzle ORM upserts) and authenticates as the `E2E Tester` user (`e2e@slopware.test`), saving the session cookie to `e2e/.auth/user.json`.
- All your specs will run completely authenticated without needing to navigate to the login screen.

## 3. Database Seeding & Upserts

If a test requires specific data to exist (e.g., a specific Article or Customer), you MUST add it to `apps/web/e2e/setup/seed.ts` using **Drizzle ORM Upserts** (`onConflictDoUpdate`).

- **Do not use raw SQL `INSERT` statements** as they will fail on subsequent test runs due to unique constraints.
- Always use `tenantId` (and `companyId` if applicable) retrieved from the base tenant in the script.
- Example:
  ```typescript
  await db
    .insert(schema.article)
    .values({
      tenantId,
      articleNo: "MY-TEST-ART",
      name: "Test Article",
      type: "stock",
    })
    .onConflictDoUpdate({
      target: [schema.article.tenantId, schema.article.articleNo],
      set: { name: "Test Article" },
    });
  ```

## 4. UI Interaction & Selectors

Our UI uses Generic DataGrids and EntityMasks. Avoid brittle CSS selectors.

- **DataGrid Navigation**: To search for an item, use the global search `page.getByPlaceholder("Search...")`.
- **EntityMask (Forms)**: Form fields are strictly controlled. When filling forms, prefer `page.getByLabel('...')` or `page.getByRole('textbox', { name: '...' })`.
- **Form Validation (@tanstack/react-form)**: We use `@tanstack/react-form` heavily. When verifying validation errors, look for elements with the class `text-destructive` or specific error tooltips.
  - Example: `await expect(page.locator(".text-destructive")).toContainText("Required");`
- **Saving Records**: Use the `F10` hotkey or click the "Save" button to save forms. The `CommandProvider` handles keyboard shortcuts.
  - Example: `await page.keyboard.press("F10");`

## 5. Running Tests

To run tests during your work:

```bash
# Run all tests headlessly
pnpm --filter web dlx playwright test

# Run a specific test file
pnpm --filter web dlx playwright test apps/web/e2e/specs/my-test.spec.ts
```

## 6. Interpreting Failures

- If an element is not found, verify if it's inside a `DataGrid` (which might be loading) and ensure you await its visibility: `await expect(page.locator('...')).toBeVisible()`.
- If auth fails, ensure the database is running and `seed.ts` has executed correctly without constraint violations.
