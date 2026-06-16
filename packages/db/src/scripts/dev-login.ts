import "./load-env";

import { CapabilityClient } from "../capabilities/http/capability-client";
import { closeDb } from "../index";
import { linkUserToBaseTenant } from "../test-support/fixtures";

// Reuses the dedicated E2E identity (apps/web/e2e/setup/auth.setup.ts) instead
// of inventing a new one. Unlike the E2E run, this script leaves the user
// bound to the base tenant afterwards, so a follow-up call just signs in.
const DEV_USER = {
  email: "e2e@slopware.test",
  password: "password123",
  name: "E2E Tester",
};

async function main() {
  const baseUrl =
    process.env.CAPABILITY_TEST_BASE_URL ?? process.env.VITE_BASE_URL ?? "http://localhost:3000";

  // Sign-up fails harmlessly if the user already exists — same as auth.setup.ts.
  await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify(DEV_USER),
  });

  await linkUserToBaseTenant(DEV_USER.email);

  const client = await CapabilityClient.login({ email: DEV_USER.email, password: DEV_USER.password });

  console.error(`Signed in as ${DEV_USER.email}, bound to the base tenant.`);
  console.error(`curl -H 'cookie: ${client.cookieHeader}' ${baseUrl}/api/me`);
  console.error("(Or paste the cookie below into your browser's devtools for manual UI testing.)");
  console.log(client.cookieHeader);

  await closeDb();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
