import "./load-env";
import { executeCapability } from "../capabilities/index";
import { getContextForTenant } from "../test-support/fixtures";
import { closeDb } from "../index";

async function main() {
  const args = process.argv.slice(2);
  // Support help flags
  if (args.includes("-h") || args.includes("--help") || args.length < 3) {
    console.error("Usage: pnpm db:execute <capabilityKey> <tenantSlugOrId> '<jsonInput>' [--dry-run]");
    console.error("\nExample:");
    console.error("  pnpm db:execute masterdata.article.upsert base '{\"articleNo\": \"A-001\", \"name\": \"New Item\"}'");
    process.exit(1);
  }

  const [capabilityKey, tenantSlugOrId, rawJsonInput] = args;
  const dryRun = args.includes("--dry-run");

  let parsedInput: unknown = {};
  try {
    parsedInput = JSON.parse(rawJsonInput);
  } catch (err: any) {
    console.error(`Invalid JSON input: ${err.message}`);
    process.exit(1);
  }

  try {
    const ctx = await getContextForTenant(tenantSlugOrId);
    if (dryRun) {
      ctx.dryRun = true;
    }

    const result = await executeCapability(capabilityKey, ctx, parsedInput);
    
    console.log(JSON.stringify(result, null, 2));
    
    await closeDb();
    
    if (!result.ok) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    await closeDb();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
