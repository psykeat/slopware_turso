import { MetadataResolver } from "../services/metadata";

async function test() {
  const resolver = new MetadataResolver({ tenantId: "" });
  console.log("Introspecting addressCategory...");
  const fields = await resolver.getEffectiveFields("addressCategory");
  console.log(`Found ${fields.length} fields.`);
  console.log("Fields:", JSON.stringify(fields.slice(0, 3), null, 2));
}

test().catch(console.error);
