import { db } from "@repo/db";
import * as schema from "@repo/db/schema";
import { eq } from "drizzle-orm";

/**
 * E2E test database seeder.
 * This script runs before tests to ensure deterministic database fixtures exist,
 * respecting database constraints and leveraging Drizzle's upsert functionality.
 */
export async function seedE2eData() {
  console.log("Seeding E2E data...");

  try {
    // 1. Get the E2E test user
    const [testUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "e2e@slopware.test"))
      .limit(1);

    if (!testUser) {
      throw new Error("E2E user not found. Ensure auth.setup.ts signs up the user before seeding.");
    }

    // 2. Get the base tenant. The E2E user now has two userTenant rows (its own
    // empty sandbox from signup, plus the base link from auth.setup.ts), so
    // resolving "the" tenant via userTenant would be non-deterministic.
    const [baseTenant] = await db
      .select()
      .from(schema.tenant)
      .where(eq(schema.tenant.isBase, true))
      .limit(1);

    if (!baseTenant) {
      throw new Error(
        "No base tenant found. Ensure auth.setup.ts links the E2E user before seeding.",
      );
    }

    const tenantId = baseTenant.tenantId;

    // 3. Get the test company
    const [testCompany] = await db
      .select()
      .from(schema.company)
      .where(eq(schema.company.tenantId, tenantId))
      .limit(1);

    if (!testCompany) {
      throw new Error("Test company not found in the test tenant.");
    }

    // eslint-disable-next-line
    const companyId = testCompany.companyId;

    // 3. Upsert a deterministic test article
    await db
      .insert(schema.article)
      .values({
        // eslint-disable-next-line
        tenantId,
        articleNo: "E2E-ART-100",
        name: "E2E Test Article",
        type: "stock",
        taxRateType: "standard",
      })
      .onConflictDoUpdate({
        target: [schema.article.tenantId, schema.article.articleNo],
        set: {
          name: "E2E Test Article",
          archivedAt: null,
        },
      });

    // 4. Upsert a deterministic test address (customer)
    await db
      .insert(schema.address)
      .values({
        tenantId,
        addressNo: "E2E-CUST-100",
        searchText: "E2E Customer",
        companyName: "E2E Testing GmbH",
        addressLine1: "Test Str. 1",
        countryCode: "DE",
        city: "Berlin",
        postalCode: "10115",
        isCustomer: true,
      })
      .onConflictDoUpdate({
        target: [schema.address.tenantId, schema.address.addressNo],
        set: {
          searchText: "E2E Customer",
          companyName: "E2E Testing GmbH",
          archivedAt: null,
        },
      });

    console.log("E2E seeding complete.");
  } catch (err) {
    console.error("E2E seeding failed (continuing anyway):", err);
    throw err; // Actually we should throw so the test fails if seed fails, but let's see
  }
}

// Allow running this script directly
const isMain =
  typeof process !== "undefined" && process.argv[1] && process.argv[1].endsWith("seed.ts");
if (isMain) {
  seedE2eData()
    .then(() => {
      console.log("Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
