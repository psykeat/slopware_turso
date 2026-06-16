import { test as setup } from "@playwright/test";
import { linkUserToBaseTenant } from "@repo/db/test-support/fixtures";

import { seedE2eData } from "./seed";

const E2E_USER = {
  email: "e2e@slopware.test",
  password: "password123",
  name: "E2E Tester",
};

setup("Authenticate E2E User", async ({ request, context }) => {
  // 1. Register the dedicated test user. Signup always creates its own empty
  // sandbox tenant (initializeDefaultTenant) — ignored below in favor of...
  await request.post("http://localhost:3000/api/auth/sign-up/email", {
    data: E2E_USER,
  });

  // 2. ...a link to the base tenant, so E2E runs against real, db:seed:full
  // data instead of an empty sandbox. getTenantContext() prefers isBase
  // tenants, so this becomes the user's active tenant automatically.
  await linkUserToBaseTenant(E2E_USER.email);

  // 3. Seed deterministic fixtures into the base tenant
  await seedE2eData();

  // 4. Sign in as the test user
  const signInRes = await request.post("http://localhost:3000/api/auth/sign-in/email", {
    data: {
      email: E2E_USER.email,
      password: E2E_USER.password,
    },
  });

  if (!signInRes.ok()) {
    throw new Error(
      `Failed to authenticate E2E user: ${signInRes.statusText()} ${await signInRes.text()}`,
    );
  }

  // Save the state
  await context.storageState({ path: "e2e/.auth/user.json" });
});
