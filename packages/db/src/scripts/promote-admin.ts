import "dotenv/config";
import { db } from "../index";
import { user } from "../schema/auth.schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide an email address.");
    process.exit(1);
  }

  console.log(`Promoting user ${email} to system admin...`);

  const result = await db
    .update(user)
    .set({ isSystemAdmin: true })
    .where(eq(user.email, email))
    .returning();

  if (result.length === 0) {
    console.error("User not found.");
    process.exit(1);
  }

  console.log(`User ${email} promoted successfully.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
