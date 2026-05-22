import "dotenv/config";
import { eq } from "drizzle-orm";

import { db } from "../index";
import { user } from "../schema/auth.schema";

async function main() {
  const [existingAdmin] = await db.select().from(user).where(eq(user.isSystemAdmin, true)).limit(1);

  if (existingAdmin) {
    console.log(`System admin user already exists: ${existingAdmin.email}`);
    process.exit(0);
  }

  await db.insert(user).values({
    id: "admin-id",
    name: "System Admin",
    email: "admin@slopware.com",
    emailVerified: true,
    isSystemAdmin: true,
    isActive: true,
    locale: "de",
  });

  console.log("Successfully seeded system admin user.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
