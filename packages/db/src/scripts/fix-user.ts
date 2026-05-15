import { db } from "../index";
import { user } from "../schema/auth.schema";
import { userTenant, tenant } from "../schema/app.schema";
import { eq } from "drizzle-orm";
import { initializeDefaultTenant } from "../services/tenant";

async function fix() {
  const email = "admin@slopware.dev";
  console.log(`Fixing user: ${email}`);
  
  const [u] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!u) {
    console.log("User not found.");
    return;
  }

  const existing = await db.select().from(userTenant).where(eq(userTenant.userId, u.id)).limit(1);
  if (existing.length > 0) {
    console.log("User already has a tenant.");
    return;
  }

  console.log("Initializing tenant for user...");
  await initializeDefaultTenant(u.id, u.name);
  console.log("Done.");
}

fix().catch(console.error);
