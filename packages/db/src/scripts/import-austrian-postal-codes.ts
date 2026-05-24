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
import data from "./austrian_postal_codes.json";

export async function importAustrianPostalCodes() {
  console.log(`Starting import of ${data.length} Austrian postal codes...`);

  // Split into chunks of 100 for batch insertion
  const chunkSize = 100;
  let importedCount = 0;

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);

    await db.insert(schema.postalCode).values(chunk).onConflictDoNothing();

    importedCount += chunk.length;
    console.log(`Imported ${importedCount}/${data.length} records...`);
  }

  console.log("Austrian postal codes import completed successfully!");
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("import-austrian-postal-codes.ts") ||
    process.argv[1].endsWith("import-austrian-postal-codes"))
) {
  importAustrianPostalCodes().catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error("Import failed:", message);
    process.exit(1);
  });
}
