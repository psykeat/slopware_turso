import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

import type { ExecutionContext } from "./index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Force turso provider
process.env.PERSISTENCE_PROVIDER = "turso";
const testDbFile = "local-test-tenant.db";
process.env.TURSO_DATABASE_URL = `file:${testDbFile}`;

const { closeDb } = await import("../index");
const { executeCapability } = await import("./index");
const { createClient } = await import("@libsql/client");
const { drizzle } = await import("drizzle-orm/libsql");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { sql } = await import("drizzle-orm");

const tenantId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";

before(async () => {
  // Clean up old test db if any
  if (existsSync(testDbFile)) {
    try {
      unlinkSync(testDbFile);
    } catch {}
  }

  // Run SQLite migrations programmatically on the test database
  const client = createClient({ url: `file:${testDbFile}` });
  const migrationDb = drizzle({ client });

  await migrate(migrationDb, {
    migrationsFolder: join(__dirname, "../../migrations-sqlite"),
  });

  // Seed parent records to satisfy foreign key constraints
  const articleId = "00000000-0000-4000-8000-000000000100";
  const variantId = "00000000-0000-4000-8000-000000000101";
  await migrationDb.run(
    sql`insert into article (article_id, article_no, name, bom_type, print_position_texts, created_at) values (${articleId}, 'ART-001', 'Test Article', 'none', 0, ${new Date().getTime()})`,
  );
  await migrationDb.run(
    sql`insert into article_variant (variant_id, article_id, sku, price, created_at) values (${variantId}, ${articleId}, 'SKU-001', 15.00, ${new Date().getTime()})`,
  );

  const companyId = "00000000-0000-4000-8000-000000000300";
  const documentGroupId = "00000000-0000-4000-8000-000000000200";

  await migrationDb.run(
    sql`insert into company (company_id, company_no, name, country_code, currency_id, archived, created_at) values (${companyId}, 'COMP-001', 'Test Company', 'DE', 'EUR', 0, ${new Date().getTime()})`,
  );
  await migrationDb.run(
    sql`insert into document_group (document_group_id, name, archived, require_serial_tracking, require_batch_tracking, document_type, group_number, company_id, created_at) values (${documentGroupId}, 'Test Group', 0, 0, 0, 'R', 1, ${companyId}, ${new Date().getTime()})`,
  );

  client.close();
});

test("turso: country capability slice execution on physical tenant sqlite db", async () => {
  const ctx: ExecutionContext = {
    tenantId,
    organizationId,
    userId: null,
    actorMode: "test",
    role: "system",
  };

  // 1. Create a country
  const upsertResult = await executeCapability("masterdata.country.upsert", ctx, {
    iso2Code: "TS",
    iso3Code: "TST",
    name: { en: "Test Country", de: "Testland" },
  });

  assert.equal(upsertResult.ok, true, `upsert failed: ${JSON.stringify(upsertResult)}`);
  const country = (upsertResult as any).data.country;
  assert.equal(country.iso2Code, "TS");
  assert.equal(country.name.en, "Test Country");

  // 2. Get the country by ID
  const getResult = await executeCapability("masterdata.country.get", ctx, {
    countryId: country.countryId,
  });
  assert.equal(getResult.ok, true, `get failed: ${JSON.stringify(getResult)}`);
  assert.equal((getResult as any).data.countryId, country.countryId);

  // 3. List countries
  const listResult = await executeCapability("masterdata.country.list", ctx, {});
  assert.equal(listResult.ok, true, `list failed: ${JSON.stringify(listResult)}`);
  const items = (listResult as any).data.items;
  assert.ok(Array.isArray(items));
  const found = items.find((c: any) => c.countryId === country.countryId);
  assert.ok(found, "Test country should be in the list");
});

test("turso: currency capability slice execution on physical tenant sqlite db", async () => {
  const ctx: ExecutionContext = {
    tenantId,
    organizationId,
    userId: null,
    actorMode: "test",
    role: "system",
  };

  // 1. Create a currency
  const upsertResult = await executeCapability("masterdata.currency.upsert", ctx, {
    code: "TSD",
    name: { en: "Test Dollar", de: "Testdollar" },
    symbol: "$T",
    decimals: 2,
  });

  assert.equal(upsertResult.ok, true, `upsert failed: ${JSON.stringify(upsertResult)}`);
  const currency = (upsertResult as any).data.currency;
  assert.equal(currency.code, "TSD");
  assert.equal(currency.name.en, "Test Dollar");

  // 2. Get the currency by ID
  const getResult = await executeCapability("masterdata.currency.get", ctx, {
    currencyId: currency.currencyId,
  });
  assert.equal(getResult.ok, true, `get failed: ${JSON.stringify(getResult)}`);
  assert.equal((getResult as any).data.currencyId, currency.currencyId);

  // 3. List currencies
  const listResult = await executeCapability("masterdata.currency.list", ctx, {});
  assert.equal(listResult.ok, true, `list failed: ${JSON.stringify(listResult)}`);
  const items = (listResult as any).data.items;
  assert.ok(Array.isArray(items));
  const found = items.find((c: any) => c.currencyId === currency.currencyId);
  assert.ok(found, "Test currency should be in the list");
});

test("turso: address capability slice execution on physical tenant sqlite db", async () => {
  const ctx: ExecutionContext = {
    tenantId,
    organizationId,
    userId: null,
    actorMode: "test",
    role: "system",
  };

  // 1. Create an address
  const upsertResult = await executeCapability("masterdata.address.upsert", ctx, {
    addressNo: "ADR-TST-001",
    isCustomer: true,
    companyName: "Test Company SQLite",
    addressLine1: "123 Test Lane",
    postalCode: "12345",
    city: "Test City",
    countryCode: "TS",
  });

  assert.equal(upsertResult.ok, true, `upsert failed: ${JSON.stringify(upsertResult)}`);
  const address = (upsertResult as any).data.address;
  assert.equal(address.addressNo, "ADR-TST-001");
  assert.equal(address.companyName, "Test Company SQLite");

  // 2. Get the address by ID
  const getResult = await executeCapability("masterdata.address.get", ctx, {
    addressId: address.addressId,
  });
  assert.equal(getResult.ok, true, `get failed: ${JSON.stringify(getResult)}`);
  assert.equal((getResult as any).data.addressId, address.addressId);

  // 3. List addresses
  const listResult = await executeCapability("masterdata.address.list", ctx, {});
  assert.equal(listResult.ok, true, `list failed: ${JSON.stringify(listResult)}`);
  const items = (listResult as any).data.items;
  assert.ok(Array.isArray(items));
  const found = items.find((a: any) => a.addressId === address.addressId);
  assert.ok(found, "Test address should be in the list");
});

test("turso: ledger posting and immutability smoke test", async () => {
  const ctx: ExecutionContext = {
    tenantId,
    organizationId,
    userId: "00000000-0000-4000-8000-000000000099",
    actorMode: "test",
    role: "system",
  };

  const variantId = "00000000-0000-4000-8000-000000000101";

  // 1. Create a draft document
  const createResult = await executeCapability("sales.document.create", ctx, {
    documentGroupId: "00000000-0000-4000-8000-000000000200",
    documentType: "R", // Invoice
    documentDirection: "OUTBOUND",
    documentDate: "2026-06-21",
    status: "draft",
    companyId: "00000000-0000-4000-8000-000000000300",
  });
  assert.equal(createResult.ok, true, `document.create failed: ${JSON.stringify(createResult)}`);
  const doc = (createResult as any).data;
  assert.equal(doc.status, "draft");

  // 2. Save document draft lines
  const saveDraftResult = await executeCapability("sales.document.saveDraft", ctx, {
    documentId: doc.documentId,
    documentType: doc.documentType,
    documentDirection: doc.documentDirection,
    documentDate: doc.documentDate,
    companyId: doc.companyId,
    lines: [
      {
        lineNo: 1,
        variantId: variantId,
        quantity: "10",
        netPrice: "15.00",
        lineType: "article",
      },
    ],
  });
  assert.equal(
    saveDraftResult.ok,
    true,
    `document.saveDraft failed: ${JSON.stringify(saveDraftResult)}`,
  );

  // 3. Post document
  const postResult = await executeCapability("sales.document.post", ctx, {
    documentId: doc.documentId,
  });
  assert.equal(postResult.ok, true, `document.post failed: ${JSON.stringify(postResult)}`);
  const postedDoc = (postResult as any).data.document;
  assert.equal(postedDoc.status, "posted");

  // 4. Verify posting batch & entries in the SQLite database
  const sqliteSchema = await import("../schema/sqlite.schema");
  const { activePersistence, eq, runInTenantScope } = await import("../index");
  const sqliteDb = activePersistence.db;

  await runInTenantScope(ctx, async () => {
    const batches = await sqliteDb
      .select()
      .from(sqliteSchema.postingBatch)
      .where(eq(sqliteSchema.postingBatch.documentId, doc.documentId));
    assert.equal(batches.length, 1, "Should have 1 posting batch");
    const batch = batches[0];
    assert.equal(batch.postedBy, ctx.userId);

    const entries = await sqliteDb
      .select()
      .from(sqliteSchema.postingEntry)
      .where(eq(sqliteSchema.postingEntry.batchId, batch.batchId));
    assert.equal(entries.length, 2, "Should have 2 posting entries (1 inventory, 1 accounting)");

    const invEntry = entries.find((e: any) => e.entryType === "inventory");
    assert.ok(invEntry);
    assert.equal(invEntry.variantId, variantId);
    assert.equal(invEntry.qtyDelta, -10, "Outbound invoice should have negative qtyDelta");

    const accEntry = entries.find((e: any) => e.entryType === "accounting");
    assert.ok(accEntry);
    assert.equal(accEntry.amountDelta, 150.0, "10 * 15 = 150");

    // 5. Test immutability via SQLite triggers (raise abort on update/delete)
    await assert.rejects(
      async () => {
        await sqliteDb
          .update(sqliteSchema.postingEntry)
          .set({ description: "unauthorized edit" })
          .where(eq(sqliteSchema.postingEntry.entryId, invEntry.entryId));
      },
      (err: any) => {
        const msg = err.message + " " + (err.cause?.message ?? "");
        return /Ledger entries are immutable/.test(msg);
      },
      "Update on postingEntry should be blocked by trigger",
    );

    await assert.rejects(
      async () => {
        await sqliteDb
          .delete(sqliteSchema.postingEntry)
          .where(eq(sqliteSchema.postingEntry.entryId, invEntry.entryId));
      },
      (err: any) => {
        const msg = err.message + " " + (err.cause?.message ?? "");
        return /Ledger entries are immutable/.test(msg);
      },
      "Delete on postingEntry should be blocked by trigger",
    );
  });

  // 6. Test reversal (Storno)
  const stornoResult = await executeCapability("sales.document.storno", ctx, {
    documentId: doc.documentId,
  });
  assert.equal(stornoResult.ok, true, `document.storno failed: ${JSON.stringify(stornoResult)}`);
  const stornoDocId = (stornoResult as any).data.stornoDocumentId;

  // Verify storno document details
  await runInTenantScope(ctx, async () => {
    const [stornoDoc] = await sqliteDb
      .select()
      .from(sqliteSchema.document)
      .where(eq(sqliteSchema.document.documentId, stornoDocId))
      .limit(1);
    assert.ok(stornoDoc);
    assert.equal(stornoDoc.documentType, "G", "Invoice (R) storno should result in Gutschrift (G)");
    assert.equal(stornoDoc.status, "posted", "Storno document should automatically be posted");

    // Verify counter-bookings
    const stornoBatches = await sqliteDb
      .select()
      .from(sqliteSchema.postingBatch)
      .where(eq(sqliteSchema.postingBatch.documentId, stornoDocId));
    assert.equal(stornoBatches.length, 1, "Should have 1 storno posting batch");
    const stornoBatch = stornoBatches[0];

    const stornoEntries = await sqliteDb
      .select()
      .from(sqliteSchema.postingEntry)
      .where(eq(sqliteSchema.postingEntry.batchId, stornoBatch.batchId));
    assert.equal(stornoEntries.length, 2, "Should have 2 counter-booking entries");

    const stornoInvEntry = stornoEntries.find((e: any) => e.entryType === "inventory");
    assert.ok(stornoInvEntry);
    assert.equal(
      stornoInvEntry.qtyDelta,
      10,
      "Counter-booking for Gutschrift (G) should have positive qtyDelta (returning items to inventory)",
    );

    const stornoAccEntry = stornoEntries.find((e: any) => e.entryType === "accounting");
    assert.ok(stornoAccEntry);
    assert.equal(
      stornoAccEntry.amountDelta,
      150.0,
      "Credit note amount value should match original",
    );
  });
});

after(async () => {
  await closeDb();
  if (existsSync(testDbFile)) {
    try {
      unlinkSync(testDbFile);
    } catch {}
  }
});
