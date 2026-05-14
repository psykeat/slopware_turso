import { db } from "./packages/db/src/index";
import { tenantFields } from "./packages/db/src/schema/app.schema";

async function check() {
  const fields = await db.select().from(tenantFields);
  console.log(`Found ${fields.length} metadata fields.`);
  if (fields.length > 0) {
    console.log("First field:", JSON.stringify(fields[0], null, 2));
  }
}

check().catch(console.error);
