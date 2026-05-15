import "dotenv/config";
import { db } from "../index";
import * as schema from "../schema/app.schema";
import { user } from "../schema/auth.schema";
import { eq, and, sql } from "drizzle-orm";

const CANONICAL_DOC_TYPES: Array<{ movementType: string; name: string }> = [
  { movementType: "N", name: "Angebot" },
  { movementType: "A", name: "Auftrag" },
  { movementType: "L", name: "Lieferschein" },
  { movementType: "R", name: "Rechnung" },
  { movementType: "G", name: "Gutschrift" },
  { movementType: "b", name: "Bestellung" },
  { movementType: "l", name: "WE-Lieferschein" },
  { movementType: "r", name: "WE-Rechnung" },
  { movementType: "g", name: "WE-Gutschrift" },
  { movementType: "V", name: "Inventurbuchung" },
  { movementType: "Z", name: "Zubuchung" },
  { movementType: "E", name: "Entnahme" },
  { movementType: "U", name: "Umlagerung" },
];

async function seedCanonicalDocumentGroups(tenantId: string, companyId: string) {
  for (const dt of CANONICAL_DOC_TYPES) {
    await db
      .insert(schema.documentGroup)
      .values({
        tenantId,
        companyId,
        name: dt.name,
        documentType: dt.movementType,
        groupNumber: 0,
        requireSerialTracking: false,
        requireBatchTracking: false,
      })
      .onConflictDoUpdate({
        target: [schema.documentGroup.tenantId, schema.documentGroup.documentType, schema.documentGroup.groupNumber],
        set: { name: sql`excluded.name` },
      });
  }
}

async function seed() {
  // ── 1. Admin user ──────────────────────────────────────────────────────
  const [adminUser] = await db
    .select()
    .from(user)
    .where(eq(user.isSystemAdmin, true))
    .limit(1);

  if (!adminUser) {
    console.error("No system admin user found. Register a user first and set is_system_admin=true.");
    process.exit(1);
  }
  console.log(`Admin: ${adminUser.email} (${adminUser.id})`);

  // ── 2. Base organization ───────────────────────────────────────────────
  let baseOrg: typeof schema.organization.$inferSelect;
  const [existingOrg] = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.slug, "base"))
    .limit(1);

  if (existingOrg) {
    baseOrg = existingOrg;
    console.log(`Base org exists: ${baseOrg.organizationId}`);
  } else {
    [baseOrg] = await db
      .insert(schema.organization)
      .values({ name: "Slopware Base Org", slug: "base" })
      .returning();
    console.log(`Created base org: ${baseOrg.organizationId}`);
  }

  // ── 3. Base tenant ─────────────────────────────────────────────────────
  let baseTenant: typeof schema.tenant.$inferSelect;
  const [existingTenant] = await db
    .select()
    .from(schema.tenant)
    .where(eq(schema.tenant.isBase, true))
    .limit(1);

  if (existingTenant) {
    baseTenant = existingTenant;
    console.log(`Base tenant exists: ${baseTenant.tenantId}`);
  } else {
    [baseTenant] = await db
      .insert(schema.tenant)
      .values({
        organizationId: baseOrg.organizationId,
        name: "Slopware Base",
        slug: "base",
        isBase: true,
      })
      .returning();
    console.log(`Created base tenant: ${baseTenant.tenantId}`);
  }

  // ── 4. Company for base tenant ─────────────────────────────────────────
  let baseCompany: typeof schema.company.$inferSelect;
  const [existingCompany] = await db
    .select()
    .from(schema.company)
    .where(eq(schema.company.tenantId, baseTenant.tenantId))
    .limit(1);

  if (existingCompany) {
    baseCompany = existingCompany;
    console.log(`Base company exists: ${baseCompany.companyId}`);
  } else {
    [baseCompany] = await db
      .insert(schema.company)
      .values({
        tenantId: baseTenant.tenantId,
        companyNo: "1000",
        name: "Slopware GmbH",
        legalName: "Slopware GmbH",
        countryCode: "DE",
        currencyId: "EUR",
        city: "Berlin",
        postalCode: "10115",
        addressLine1: "Unter den Linden 1",
      })
      .returning();
    console.log(`Created base company: ${baseCompany.companyId}`);
  }

  // ── 4b. Default warehouse ──────────────────────────────────────────────
  let defaultWarehouse: typeof schema.warehouse.$inferSelect;
  const [existingWh] = await db
    .select()
    .from(schema.warehouse)
    .where(and(eq(schema.warehouse.tenantId, baseTenant.tenantId), eq(schema.warehouse.code, "MAIN")))
    .limit(1);

  if (existingWh) {
    defaultWarehouse = existingWh;
    console.log(`Default warehouse exists: ${defaultWarehouse.warehouseId}`);
  } else {
    [defaultWarehouse] = await db
      .insert(schema.warehouse)
      .values({
        tenantId: baseTenant.tenantId,
        companyId: baseCompany.companyId,
        code: "MAIN",
        name: "Hauptlager",
        isActive: true,
      })
      .returning();
    console.log(`Created default warehouse: ${defaultWarehouse.warehouseId}`);
  }

  // Link to company
  await db
    .update(schema.company)
    .set({ defaultWarehouseId: defaultWarehouse.warehouseId })
    .where(eq(schema.company.companyId, baseCompany.companyId));
  console.log("Linked default warehouse to base company.");

  // ── 5. Link admin user to base tenant ──────────────────────────────────
  const [existingLink] = await db
    .select()
    .from(schema.userTenant)
    .where(eq(schema.userTenant.userId, adminUser.id))
    .limit(1);

  if (!existingLink) {
    await db.insert(schema.userTenant).values({
      userId: adminUser.id,
      tenantId: baseTenant.tenantId,
      role: "owner",
    });
    console.log("Linked admin to base tenant.");
  } else {
    console.log("Admin already linked to tenant.");
  }

  // ── 6. Address categories ──────────────────────────────────────────────
  const cats = [
    { name: { en: "Customers", de: "Kunden" } },
    { name: { en: "Suppliers", de: "Lieferanten" } },
    { name: { en: "Prospects", de: "Interessenten" } },
    { name: { en: "Partners", de: "Partner" } },
  ];
  for (const cat of cats) {
    await db
      .insert(schema.addressCategory)
      .values({ tenantId: baseTenant.tenantId, name: cat.name })
      .onConflictDoNothing();
  }
  console.log("Address categories seeded.");

  // ── 7. Article groups ──────────────────────────────────────────────────
  const groups = [
    { code: "PRD", name: "Products" },
    { code: "SVC", name: "Services" },
    { code: "RAW", name: "Raw Materials" },
    { code: "PKG", name: "Packaging" },
  ];
  for (const g of groups) {
    await db
      .insert(schema.articleGroup)
      .values({ tenantId: baseTenant.tenantId, code: g.code, name: g.name })
      .onConflictDoNothing();
  }
  console.log("Article groups seeded.");

  // ── 8. Document types ──────────────────────────────────────────────────
  const docTypes = [
    { code: "N", name: "Angebot",         movementType: "N", sortOrder: 10  },
    { code: "A", name: "Auftrag",          movementType: "A", sortOrder: 20  },
    { code: "L", name: "Lieferschein",     movementType: "L", sortOrder: 30  },
    { code: "R", name: "Rechnung",         movementType: "R", sortOrder: 40  },
    { code: "G", name: "Gutschrift",       movementType: "G", sortOrder: 50  },
    { code: "b", name: "Bestellung",       movementType: "b", sortOrder: 60  },
    { code: "l", name: "WE-Lieferschein",  movementType: "l", sortOrder: 70  },
    { code: "r", name: "WE-Rechnung",      movementType: "r", sortOrder: 80  },
    { code: "g", name: "WE-Gutschrift",    movementType: "g", sortOrder: 90  },
    { code: "V", name: "Inventurbuchung",  movementType: "V", sortOrder: 100 },
    { code: "Z", name: "Zubuchung",        movementType: "Z", sortOrder: 110 },
    { code: "E", name: "Entnahme",         movementType: "E", sortOrder: 120 },
    { code: "U", name: "Umlagerung",       movementType: "U", sortOrder: 130 },
  ];
  const insertedDocTypes: Array<typeof schema.documentType.$inferSelect> = [];
  for (const dt of docTypes) {
    const [inserted] = await db
      .insert(schema.documentType)
      .values({ tenantId: baseTenant.tenantId, ...dt })
      .onConflictDoUpdate({
        target: [schema.documentType.tenantId, schema.documentType.code],
        set: { name: sql`excluded.name`, movementType: sql`excluded.movement_type`, sortOrder: sql`excluded.sort_order` },
      })
      .returning();
    if (inserted) insertedDocTypes.push(inserted);
  }
  console.log("Document types seeded.");

  // ── 9. Document groups — canonical groups (groupNumber=0, protected from delete) ──
  await seedCanonicalDocumentGroups(baseTenant.tenantId, baseCompany.companyId);
  console.log("Document groups seeded.");

  // ── 9b. Number sequences — one per movement type, linked to canonical groups ──
  const NUMBER_SEQUENCES: Array<{ movementType: string; prefix: string }> = [
    { movementType: "N", prefix: "ANG-" },
    { movementType: "A", prefix: "AUF-" },
    { movementType: "L", prefix: "LIS-" },
    { movementType: "R", prefix: "RE-"  },
    { movementType: "G", prefix: "GU-"  },
    { movementType: "b", prefix: "BES-" },
    { movementType: "l", prefix: "WEL-" },
    { movementType: "r", prefix: "WER-" },
    { movementType: "g", prefix: "WEG-" },
    { movementType: "V", prefix: "INV-" },
    { movementType: "Z", prefix: "ZUB-" },
    { movementType: "E", prefix: "ENT-" },
    { movementType: "U", prefix: "UMB-" },
  ];

  for (const seq of NUMBER_SEQUENCES) {
    // Upsert the number sequence (conflict on tenantId + companyId + prefix)
    const [inserted] = await db
      .insert(schema.numberSequence)
      .values({
        tenantId: baseTenant.tenantId,
        companyId: baseCompany.companyId,
        prefix: seq.prefix,
        nextValue: 1,
        padding: 6,
      })
      .onConflictDoUpdate({
        target: [
          schema.numberSequence.tenantId,
          schema.numberSequence.companyId,
          schema.numberSequence.prefix,
        ],
        set: { padding: 6 },
      })
      .returning();

    // Link the canonical document group (groupNumber=0) to this sequence
    await db
      .update(schema.documentGroup)
      .set({ numberSequenceId: inserted.numberSequenceId })
      .where(
        and(
          eq(schema.documentGroup.tenantId, baseTenant.tenantId),
          eq(schema.documentGroup.documentType, seq.movementType),
          eq(schema.documentGroup.groupNumber, 0),
        ),
      );
  }
  console.log("Number sequences seeded and linked to document groups.");

  // ── 10. Sample addresses ───────────────────────────────────────────────
  const [customerCat] = await db
    .select()
    .from(schema.addressCategory)
    .where(
      sql`tenant_id = ${baseTenant.tenantId} AND name->>'en' = 'Customers'`
    )
    .limit(1);

  const sampleAddresses = [
    {
      tenantId: baseTenant.tenantId,
      addressNo: "10000",
      addressType: "company",
      isCustomer: true,
      companyName: "Acme GmbH",
      addressLine1: "Hauptstraße 1",
      postalCode: "10115",
      city: "Berlin",
      countryCode: "DE",
      addressCategoryId: customerCat?.categoryId,
    },
    {
      tenantId: baseTenant.tenantId,
      addressNo: "10001",
      addressType: "company",
      isCustomer: true,
      companyName: "TechCorp AG",
      addressLine1: "Innovationspark 5",
      postalCode: "80339",
      city: "München",
      countryCode: "DE",
      addressCategoryId: customerCat?.categoryId,
    },
    {
      tenantId: baseTenant.tenantId,
      addressNo: "20000",
      addressType: "company",
      isSupplier: true,
      companyName: "Global Supplies GmbH",
      addressLine1: "Industrieweg 22",
      postalCode: "20095",
      city: "Hamburg",
      countryCode: "DE",
    },
  ];

  for (const addr of sampleAddresses) {
    await db.insert(schema.address).values(addr).onConflictDoNothing();
  }
  console.log("Sample addresses seeded.");

  // ── 11. Sample articles ────────────────────────────────────────────────
  const [prdGroup] = await db
    .select()
    .from(schema.articleGroup)
    .where(eq(schema.articleGroup.tenantId, baseTenant.tenantId))
    .limit(1);

  const sampleArticles = [
    {
      tenantId: baseTenant.tenantId,
      articleNo: "ART-001",
      name: "Enterprise Software License",
      description: "Annual license for enterprise software suite",
      baseUnit: "license",
      salesUnit: "license",
      articleGroupId: prdGroup?.articleGroupId,
    },
    {
      tenantId: baseTenant.tenantId,
      articleNo: "ART-002",
      name: "Professional Services Day",
      description: "One day of professional consulting services",
      baseUnit: "day",
      salesUnit: "day",
      articleGroupId: prdGroup?.articleGroupId,
    },
    {
      tenantId: baseTenant.tenantId,
      articleNo: "ART-003",
      name: "Hardware Module",
      description: "Industrial hardware expansion module",
      baseUnit: "pcs",
      salesUnit: "pcs",
      articleGroupId: prdGroup?.articleGroupId,
    },
  ];

  for (const art of sampleArticles) {
    await db.insert(schema.article).values(art).onConflictDoNothing();
  }
  console.log("Sample articles seeded.");

  // ── 12. Demo org + tenant ──────────────────────────────────────────────
  let demoOrg: typeof schema.organization.$inferSelect;
  const [existingDemoOrg] = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.slug, "demo"))
    .limit(1);

  if (existingDemoOrg) {
    demoOrg = existingDemoOrg;
    console.log(`Demo org exists: ${demoOrg.organizationId}`);
  } else {
    [demoOrg] = await db
      .insert(schema.organization)
      .values({ name: "Demo Organization", slug: "demo" })
      .returning();
    console.log(`Created demo org: ${demoOrg.organizationId}`);
  }

  const [existingDemoTenant] = await db
    .select()
    .from(schema.tenant)
    .where(eq(schema.tenant.slug, "demo"))
    .limit(1);

  if (!existingDemoTenant) {
    const [demoTenant] = await db
      .insert(schema.tenant)
      .values({
        organizationId: demoOrg.organizationId,
        name: "Demo Tenant",
        slug: "demo",
        isBase: false,
      })
      .returning();

    const [demoCompany] = await db
      .insert(schema.company)
      .values({
        tenantId: demoTenant.tenantId,
        companyNo: "1000",
        name: "Demo Company GmbH",
        countryCode: "DE",
        currencyId: "EUR",
      })
      .returning();

    // Seed minimal reference data for demo tenant
    await db
      .insert(schema.addressCategory)
      .values([
        { tenantId: demoTenant.tenantId, name: { en: "Customers", de: "Kunden" } },
        { tenantId: demoTenant.tenantId, name: { en: "Suppliers", de: "Lieferanten" } },
      ])
      .onConflictDoNothing();

    await db
      .insert(schema.articleGroup)
      .values({ tenantId: demoTenant.tenantId, code: "PRD", name: "Products" })
      .onConflictDoNothing();

    await db
      .insert(schema.documentType)
      .values({ tenantId: demoTenant.tenantId, code: "R", name: "Rechnung", movementType: "R", sortOrder: 40 })
      .onConflictDoNothing();

    await db
      .insert(schema.documentGroup)
      .values({
        tenantId: demoTenant.tenantId,
        companyId: demoCompany.companyId,
        name: "Standard Invoices",
        documentType: "L",
        groupNumber: 1,
        requireSerialTracking: false,
        requireBatchTracking: false,
      })
      .onConflictDoNothing();

    console.log(`Created demo tenant: ${demoTenant.tenantId}`);
  } else {
    console.log(`Demo tenant exists: ${existingDemoTenant.tenantId}`);
  }

  console.log("\nSeed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
