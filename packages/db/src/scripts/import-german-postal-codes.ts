import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from apps/web/.env
dotenv.config({ path: path.resolve(__dirname, "../../../../apps/web/.env") });

import { db } from "../index";
import * as schema from "../schema/app.schema";
import data from "./german_postal_codes.json";

async function main() {
  console.log(`Starting import of ${data.length} German postal codes...`);

  // Split into chunks of 500 for batch insertion
  const chunkSize = 500;
  let importedCount = 0;

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);

    await db.insert(schema.postalCode).values(chunk).onConflictDoNothing();

    importedCount += chunk.length;
    console.log(`Imported ${importedCount}/${data.length} records...`);
  }

  console.log("German postal codes import completed successfully!");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error("Import failed:", message);
  process.exit(1);
});
