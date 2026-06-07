import { test as setup } from "@playwright/test";

import { seedE2eData } from "./seed";

const E2E_USER = {
  email: "e2e@slopware.test",
  password: "password123",
  name: "E2E Tester",
};

setup("Authenticate E2E User", async ({ request, context }) => {
  // 1. Register the dedicated test user (this automatically creates their test tenant)
  await request.post("http://localhost:3000/api/auth/sign-up/email", {
    data: E2E_USER,
  });

  // 2. Seed database fixtures specifically into this new test tenant
  await seedE2eData();

  // 3. Sign in as the test user
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
