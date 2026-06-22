import "./load-env";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq, and } from "drizzle-orm";

import { executeCapability, type ExecutionContext } from "../capabilities/index";
import { db, closeDb } from "../index";
import * as schema from "../schema/app.schema";
import { user } from "../schema/auth.schema";
import { getContextForTenant } from "../test-support/fixtures";
import { isScriptEntry } from "./script-main";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("=========================================");
  console.log("Starting Full Feature Database Seeding...");
  console.log("=========================================");

  // 1. Run baseline seed scripts
  console.log("Running baseline seed.ts...");
  execSync("npx tsx " + path.resolve(__dirname, "seed.ts"), { stdio: "inherit" });

  console.log("Running SKR03 chart of accounts seed.ts...");
  execSync("npx tsx " + path.resolve(__dirname, "seed-skr03.ts"), { stdio: "inherit" });

  console.log("Running Austrian taxes seed.ts...");
  execSync("npx tsx " + path.resolve(__dirname, "seed-austrian-taxes.ts"), { stdio: "inherit" });

  console.log("Running Document Sequences & groups (incl. p + q)...");
  execSync("npx tsx " + path.resolve(__dirname, "seed-document-sequences.ts"), {
    stdio: "inherit",
  });

  console.log("Running Document Email Templates...");
  execSync("npx tsx " + path.resolve(__dirname, "seed-email-templates.ts"), { stdio: "inherit" });

  console.log("\nCore seeding finished. Enriched capability seeding starting...");

  // 2. Resolve base tenant and context, then enrich
  const ctx = await getContextForTenant("base");
  console.log(`Resolved base tenant: ${ctx.tenantId}`);

  await enrichTenant(ctx);

  console.log("=========================================");
  console.log("Full Feature Seeding Complete!");
  console.log("=========================================");
}

/**
 * Enrich one tenant with the full feature dataset on top of seedTenantStructure
 * and the sub-seed cores (taxes, document sequences, email templates, SKR03):
 * cost centers, agents, discount/price/shipping/payment data, a variant template
 * with T-Shirt variants + images, a serial/batch goods receipt, a BOM + production
 * order, a sales order & posted invoice, an email inbox, product categories and
 * e-commerce sync rows. Idempotent. Reused by the base seed (main above) and the
 * isolated test tenant reseed (seed-test-tenant.ts).
 *
 * Prerequisites for `ctx`'s tenant: seedTenantStructure + the four sub-seed
 * cores must already have run (units, PRD article group, company, doc groups
 * A/R/r, customer + supplier addresses, taxes, sequences).
 */
export async function enrichTenant(ctx: ExecutionContext): Promise<void> {
  // Resolve units
  const units = await db.select().from(schema.unit).where(eq(schema.unit.tenantId, ctx.tenantId));
  const unitMap = new Map(units.map((u) => [u.code, u.unitId]));

  // Resolve article groups
  const articleGroups = await db
    .select()
    .from(schema.articleGroup)
    .where(eq(schema.articleGroup.tenantId, ctx.tenantId));
  const prdGroup = articleGroups.find((g) => g.code === "PRD");
  console.log(`Resolved product article group: ${prdGroup?.articleGroupId}`);

  const baseCompany = await db
    .select()
    .from(schema.company)
    .where(eq(schema.company.tenantId, ctx.tenantId))
    .limit(1)
    .then((rows) => rows[0]);

  // 3. Seed Cost Centers
  console.log("Seeding Cost Centers...");
  await db
    .insert(schema.costCenter)
    .values([
      {
        tenantId: ctx.tenantId,
        companyId: baseCompany.companyId,
        code: "CC-ADMIN",
        name: "Administration",
      },
      {
        tenantId: ctx.tenantId,
        companyId: baseCompany.companyId,
        code: "CC-SALES",
        name: "Sales Department",
      },
    ])
    .onConflictDoNothing();

  // 4. Seed Agents
  console.log("Seeding Agents...");
  const [adminUser] = await db.select({ id: user.id }).from(user).limit(1);
  const adminUserId = adminUser?.id ?? null;
  if (!ctx.userId) {
    ctx.userId = adminUserId ?? "system";
  }
  await db
    .insert(schema.agent)
    .values({
      tenantId: ctx.tenantId,
      agentNo: "AG-001",
      name: "Agent Alice Smith",
      commissionRate: "5.00",
      userId: adminUserId,
    })
    .onConflictDoNothing();

  // 5. Seed Discount Groups
  console.log("Seeding Discount Groups...");
  await db
    .insert(schema.discountGroup)
    .values({
      tenantId: ctx.tenantId,
      name: "Standard 10% Discount",
      percentage: "10.00",
    })
    .onConflictDoNothing();

  // 6. Seed Industries
  console.log("Seeding Industries...");
  await db
    .insert(schema.industry)
    .values([
      {
        tenantId: ctx.tenantId,
        name: { en: "Technology", de: "Technologie" },
      },
      {
        tenantId: ctx.tenantId,
        name: { en: "Automotive", de: "Automobilindustrie" },
      },
    ])
    .onConflictDoNothing();

  // 7. Seed Price Lists
  console.log("Seeding Price Lists...");
  await db
    .insert(schema.priceList)
    .values({
      tenantId: ctx.tenantId,
      name: "Wholesale Prices",
      currencyId: "EUR",
      isNet: true,
    })
    .onConflictDoNothing();

  // 8. Seed Shipping Methods
  console.log("Seeding Shipping Methods...");
  await db
    .insert(schema.shippingMethod)
    .values([
      {
        tenantId: ctx.tenantId,
        name: { en: "DHL Standard", de: "DHL Standard" },
      },
      {
        tenantId: ctx.tenantId,
        name: { en: "Express Delivery", de: "Express-Lieferung" },
      },
    ])
    .onConflictDoNothing();

  // 9. Seed Payment Terms (Zahlungsbedingungen)
  console.log("Setting up Payment Terms...");
  const [net14] = await db
    .insert(schema.paymentTerm)
    .values({
      tenantId: ctx.tenantId,
      name: { en: "14 Days Net", de: "14 Tage netto" },
      netDays: 14,
    })
    .onConflictDoUpdate({
      target: [schema.paymentTerm.tenantId, schema.paymentTerm.name],
      set: { netDays: 14 },
    })
    .returning();
  const net14Id = net14.paymentTermId;

  const [net30skonto] = await db
    .insert(schema.paymentTerm)
    .values({
      tenantId: ctx.tenantId,
      name: { en: "30 Days Net, 2% Skonto in 10 Days", de: "30 Tage netto, 2% Skonto in 10 Tagen" },
      netDays: 30,
      discountDays: 10,
      discountPercentage: "2.00",
    })
    .onConflictDoUpdate({
      target: [schema.paymentTerm.tenantId, schema.paymentTerm.name],
      set: { netDays: 30, discountDays: 10, discountPercentage: "2.00" },
    })
    .returning();
  const net30skontoId = net30skonto.paymentTermId;
  console.log(`Payment terms resolved: net14=${net14Id}, net30skonto=${net30skontoId}`);

  // 10. Create CRM Contact Persons (Ansprechpartner)
  console.log("Creating Contact Persons...");
  const addresses = await db
    .select()
    .from(schema.address)
    .where(eq(schema.address.tenantId, ctx.tenantId));
  const acmeAddr = addresses.find((a) => a.companyName?.includes("Acme"));
  const techcorpAddr = addresses.find((a) => a.companyName?.includes("TechCorp"));

  if (acmeAddr) {
    const [existingContact] = await db
      .select()
      .from(schema.addressContact)
      .where(
        and(
          eq(schema.addressContact.tenantId, ctx.tenantId),
          eq(schema.addressContact.addressId, acmeAddr.addressId),
        ),
      )
      .limit(1);
    if (!existingContact) {
      await executeCapability("masterdata.addressContact.create", ctx, {
        addressId: acmeAddr.addressId,
        firstName: "Alice",
        lastName: "Smith",
        displayName: "Alice Smith (Acme)",
        email: "alice@acme.com",
        phoneMobile: "+491701111111",
        roleFunction: "Einkaufsleiterin / Procurement Manager",
        salutation: "Frau / Ms.",
        isPrimary: true,
      });
      console.log("Created contact Alice Smith for Acme GmbH.");
    }
  }

  if (techcorpAddr) {
    const [existingContact] = await db
      .select()
      .from(schema.addressContact)
      .where(
        and(
          eq(schema.addressContact.tenantId, ctx.tenantId),
          eq(schema.addressContact.addressId, techcorpAddr.addressId),
        ),
      )
      .limit(1);
    if (!existingContact) {
      await executeCapability("masterdata.addressContact.create", ctx, {
        addressId: techcorpAddr.addressId,
        firstName: "Bob",
        lastName: "Jones",
        displayName: "Bob Jones (TechCorp)",
        email: "bob@techcorp.com",
        phoneMobile: "+491702222222",
        roleFunction: "Technischer Leiter / CTO",
        salutation: "Herr / Mr.",
        isPrimary: true,
      });
      console.log("Created contact Bob Jones for TechCorp AG.");
    }
  }

  // 11. Create clothing variant template
  const existingTemplates = await db
    .select()
    .from(schema.articleVariantTemplate)
    .where(
      and(
        eq(schema.articleVariantTemplate.tenantId, ctx.tenantId),
        eq(schema.articleVariantTemplate.slug, "t-shirt"),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  let templateId = existingTemplates?.templateId;

  if (!templateId) {
    console.log("Creating variant template 'T-Shirt'...");
    const res = await executeCapability("masterdata.articleVariantTemplate.create", ctx, {
      slug: "t-shirt",
      label: "T-Shirt Vorlage",
      articleGroupId: prdGroup?.articleGroupId ?? null,
      definition: {
        version: 1,
        productTypeLabel: "T-Shirt",
        axes: [
          {
            name: "Color",
            sortOrder: 1,
            values: [
              { value: "Red", sortOrder: 1, skuCode: "RD" },
              { value: "Blue", sortOrder: 2, skuCode: "BL" },
              { value: "Green", sortOrder: 3, skuCode: "GR" },
            ],
          },
          {
            name: "Size",
            sortOrder: 2,
            values: [
              { value: "S", sortOrder: 1, skuCode: "S" },
              { value: "M", sortOrder: 2, skuCode: "M" },
              { value: "L", sortOrder: 3, skuCode: "L" },
            ],
          },
        ],
        skuPattern: "{articleNo}-{axis:Color}-{axis:Size}",
        defaults: {
          priceMode: "inherit",
          weightMode: "inherit",
        },
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to create variant template: ${JSON.stringify(res.error)}`);
    }
    templateId = res.data.templateId;
    console.log(`Created variant template: ${templateId}`);
  } else {
    console.log(`Variant template 'T-Shirt' already exists: ${templateId}`);
  }

  // 12. Create an article with variants
  console.log("Upserting article ART-TSHIRT...");
  const articleRes = await executeCapability("masterdata.article.upsert", ctx, {
    articleNo: "ART-TSHIRT",
    name: "Classic Slopware T-Shirt",
    description: "A premium 100% cotton T-Shirt with subtle antigravity patterns.",
    articleGroupId: prdGroup?.articleGroupId ?? null,
    baseUnitId: unitMap.get("pcs") ?? null,
    salesUnitId: unitMap.get("pcs") ?? null,
  });

  if (!articleRes.ok) {
    throw new Error(`Failed to upsert article ART-TSHIRT: ${JSON.stringify(articleRes.error)}`);
  }

  const articleId = articleRes.data.article.articleId;
  console.log(`Article ART-TSHIRT resolved: ${articleId}`);

  // Apply template
  console.log("Applying variant template to ART-TSHIRT...");
  const applyRes = await executeCapability(
    "masterdata.articleVariantTemplate.applyToArticle",
    ctx,
    {
      articleId,
      templateId,
    },
  );
  if (!applyRes.ok) {
    throw new Error(`Failed to apply variant template: ${JSON.stringify(applyRes.error)}`);
  }
  console.log("Applied variant template axes.");

  // Generate variants
  console.log("Generating variants for ART-TSHIRT...");
  const genRes = await executeCapability("masterdata.articleVariant.generateVariants", ctx, {
    articleId,
    templateId,
  });
  if (!genRes.ok) {
    throw new Error(`Failed to generate variants: ${JSON.stringify(genRes.error)}`);
  }
  console.log(`Generated variants. Created ${genRes.data.createdVariants} new variants.`);

  // Fetch generated variants
  const variants = await db
    .select()
    .from(schema.articleVariant)
    .where(
      and(
        eq(schema.articleVariant.tenantId, ctx.tenantId),
        eq(schema.articleVariant.articleId, articleId),
      ),
    );
  console.log(`Found ${variants.length} total variants for ART-TSHIRT in DB.`);

  // 12b. Seed Price List Items for T-Shirt variants
  console.log("Seeding Price List Items for ART-TSHIRT variants...");
  const [wholesalePl] = await db
    .select({ priceListId: schema.priceList.priceListId })
    .from(schema.priceList)
    .where(
      and(
        eq(schema.priceList.tenantId, ctx.tenantId),
        eq(schema.priceList.name, "Wholesale Prices"),
      ),
    )
    .limit(1);
  if (wholesalePl && variants.length > 0) {
    await db
      .insert(schema.priceListItem)
      .values(
        variants
          .filter(
            (v) =>
              !v.sku.endsWith("-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
          )
          .map((v) => ({
            tenantId: ctx.tenantId,
            priceListId: wholesalePl.priceListId,
            articleId: articleId,
            variantId: v.variantId,
            price: "18.50",
          })),
      )
      .onConflictDoNothing();
    console.log(`Seeded ${variants.length} price list items for Wholesale Prices.`);
  }

  // 12c. Seed article images for ART-TSHIRT (commerce media sync reads from article_image)
  console.log("Seeding article images for ART-TSHIRT...");
  // 1x1 transparent PNG — enough to exercise the full upload pipeline against Shopware.
  const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
    "base64",
  );
  const storageRoot = process.env.STORAGE_PATH || path.join(homedir(), "slopware/storage");
  const imageDir = path.join(storageRoot, `tenant-${ctx.tenantId}`, "articles", articleId);
  await mkdir(imageDir, { recursive: true });

  const imageSeeds = [
    {
      id: crypto.randomUUID(),
      file: "tshirt-cover.png",
      alt: "T-Shirt Hauptbild",
      cover: true,
      sortOrder: 0,
    },
    {
      id: crypto.randomUUID(),
      file: "tshirt-gallery.png",
      alt: "T-Shirt Detailbild",
      cover: false,
      sortOrder: 1,
    },
  ];

  for (const img of imageSeeds) {
    const safeFileName = `${img.id}-${img.file}`;
    const storageKey = `tenant-${ctx.tenantId}/articles/${articleId}/${safeFileName}`;
    await writeFile(path.join(storageRoot, storageKey), PNG_1X1);

    const [inserted] = await db
      .insert(schema.articleImage)
      .values({
        articleImageId: img.id,
        tenantId: ctx.tenantId,
        articleId,
        storageKey,
        fileName: img.file,
        mimeType: "image/png",
        fileSize: PNG_1X1.length,
        width: 1,
        height: 1,
        altText: img.alt,
        sortOrder: img.sortOrder,
      })
      .onConflictDoNothing()
      .returning({ articleImageId: schema.articleImage.articleImageId });

    // The cover image becomes the article's primaryImageId (→ Shopware coverId).
    if (inserted && img.cover) {
      await db
        .update(schema.article)
        .set({ primaryImageId: inserted.articleImageId })
        .where(
          and(eq(schema.article.tenantId, ctx.tenantId), eq(schema.article.articleId, articleId)),
        );
    }
  }
  console.log(`Seeded ${imageSeeds.length} article images for ART-TSHIRT.`);

  // 13. Seed Serial and Batch Tracked Articles + Goods Receipt (WE-Rechnung)
  console.log("Creating Serial and Batch Tracked Articles...");

  // Serial Article
  const serialArticleRes = await executeCapability("masterdata.article.upsert", ctx, {
    articleNo: "ART-SERIAL",
    name: "Antigravity Power Generator",
    description: "High-value power generator with built-in serial number tracking.",
    articleGroupId: prdGroup?.articleGroupId ?? null,
    baseUnitId: unitMap.get("pcs") ?? null,
    salesUnitId: unitMap.get("pcs") ?? null,
    trackingMode: "serial",
  });
  if (!serialArticleRes.ok) {
    throw new Error(`Failed to create serial article: ${JSON.stringify(serialArticleRes.error)}`);
  }
  const serialArticleId = serialArticleRes.data.article.articleId;
  const [serialVariant] = await db
    .select()
    .from(schema.articleVariant)
    .where(eq(schema.articleVariant.articleId, serialArticleId))
    .limit(1);

  // Batch Article
  const batchArticleRes = await executeCapability("masterdata.article.upsert", ctx, {
    articleNo: "ART-BATCH",
    name: "Specialized Adhesive Fluid",
    description: "Industrial grade bonding fluid tracked by production batches.",
    articleGroupId: prdGroup?.articleGroupId ?? null,
    baseUnitId: unitMap.get("pcs") ?? null,
    salesUnitId: unitMap.get("pcs") ?? null,
    trackingMode: "batch",
  });
  if (!batchArticleRes.ok) {
    throw new Error(`Failed to create batch article: ${JSON.stringify(batchArticleRes.error)}`);
  }
  const batchArticleId = batchArticleRes.data.article.articleId;
  const [batchVariant] = await db
    .select()
    .from(schema.articleVariant)
    .where(eq(schema.articleVariant.articleId, batchArticleId))
    .limit(1);

  // Resolve Inbound Invoice document group ("r" = WE-Rechnung)
  const docGroups = await db
    .select()
    .from(schema.documentGroup)
    .where(eq(schema.documentGroup.tenantId, ctx.tenantId));
  const inboundGroup = docGroups.find((dg) => dg.documentType === "r");
  if (!inboundGroup) {
    throw new Error("Could not find Inbound Invoice (WE-Rechnung) document group.");
  }

  // Resolve supplier
  const suppliers = await db
    .select()
    .from(schema.address)
    .where(and(eq(schema.address.tenantId, ctx.tenantId), eq(schema.address.isSupplier, true)))
    .limit(1);
  if (suppliers.length === 0) {
    throw new Error("No suppliers found.");
  }
  const supplier = suppliers[0];

  console.log(
    `Creating Goods Receipt / Inbound Invoice from Supplier: ${supplier.companyName} (${supplier.addressId})`,
  );
  const inboundCreateRes = await executeCapability("sales.document.create", ctx, {
    documentGroupId: inboundGroup.documentGroupId,
    documentType: "r",
    documentDirection: "INBOUND",
    documentDate: new Date().toISOString().slice(0, 10),
    customerId: supplier.addressId,
    paymentTermId: net14Id,
  });
  if (!inboundCreateRes.ok) {
    throw new Error(
      `Failed to create inbound invoice document: ${JSON.stringify(inboundCreateRes.error)}`,
    );
  }
  const inboundId = inboundCreateRes.data.documentId;

  console.log("Saving draft Inbound Invoice lines...");
  const inboundSaveRes = await executeCapability("sales.document.saveDraft", ctx, {
    documentId: inboundId,
    documentGroupId: inboundGroup.documentGroupId,
    documentType: "r",
    documentDirection: "INBOUND",
    documentDate: new Date().toISOString().slice(0, 10),
    customerId: supplier.addressId,
    paymentTermId: net14Id,
    lines: [
      {
        lineNo: 1,
        variantId: serialVariant.variantId,
        quantity: 3,
        netPrice: 450.0,
        lineType: "article",
      },
      {
        lineNo: 2,
        variantId: batchVariant.variantId,
        quantity: 150,
        netPrice: 5.5,
        lineType: "article",
      },
    ],
  });
  if (!inboundSaveRes.ok) {
    throw new Error(
      `Failed to save draft inbound invoice lines: ${JSON.stringify(inboundSaveRes.error)}`,
    );
  }

  // Fetch document lines to apply tracking
  const inboundLines = await db
    .select()
    .from(schema.documentLine)
    .where(eq(schema.documentLine.documentId, inboundId));
  const serialLine = inboundLines.find((l) => l.variantId === serialVariant.variantId);
  const batchLine = inboundLines.find((l) => l.variantId === batchVariant.variantId);

  if (serialLine && batchLine) {
    console.log("Registering Serial and Batch tracking on lines...");
    // 3 serial tracking rows
    await executeCapability("sales.documentLineTracking.create", ctx, {
      documentLineId: serialLine.documentLineId,
      serialNo: "SN-GEN-001",
      qty: 1,
    });
    await executeCapability("sales.documentLineTracking.create", ctx, {
      documentLineId: serialLine.documentLineId,
      serialNo: "SN-GEN-002",
      qty: 1,
    });
    await executeCapability("sales.documentLineTracking.create", ctx, {
      documentLineId: serialLine.documentLineId,
      serialNo: "SN-GEN-003",
      qty: 1,
    });

    // 1 batch tracking row
    await executeCapability("sales.documentLineTracking.create", ctx, {
      documentLineId: batchLine.documentLineId,
      batchNo: "BATCH-2026-X",
      qty: 150,
    });
  }

  // Post the inbound invoice (WE-Rechnung) -> Registers serial numbers and updates inventory
  console.log(`Posting Inbound Invoice ${inboundSaveRes.data.documentNo}...`);
  const inboundPostRes = await executeCapability("sales.document.post", ctx, {
    documentId: inboundId,
  });
  if (!inboundPostRes.ok) {
    throw new Error(`Failed to post inbound invoice: ${JSON.stringify(inboundPostRes.error)}`);
  }
  console.log(
    "Inbound Invoice posted successfully. Serial numbers SN-GEN-001..003 are now 'in_stock'!",
  );

  // 14. Create BOM (Stücklistenartikel) and Production Order (Produktionsauftrag)
  console.log("Creating BOM Components and Assemblies...");

  // Component 1 (Fabric)
  const fabricRes = await executeCapability("masterdata.article.upsert", ctx, {
    articleNo: "ART-COMP-FABRIC",
    name: "T-Shirt Base Fabric",
    description: "Raw material fabric rolls for t-shirt manufacturing.",
    articleGroupId: prdGroup?.articleGroupId ?? null,
    baseUnitId: unitMap.get("pcs") ?? null,
    salesUnitId: unitMap.get("pcs") ?? null,
  });
  if (!fabricRes.ok) throw new Error("Failed to create fabric component");
  const fabricId = fabricRes.data.article.articleId;

  // Component 2 (Ink)
  const inkRes = await executeCapability("masterdata.article.upsert", ctx, {
    articleNo: "ART-COMP-INK",
    name: "Dye Ink",
    description: "Premium ink for printing designs on base fabric.",
    articleGroupId: prdGroup?.articleGroupId ?? null,
    baseUnitId: unitMap.get("pcs") ?? null,
    salesUnitId: unitMap.get("pcs") ?? null,
  });
  if (!inkRes.ok) throw new Error("Failed to create ink component");
  const inkId = inkRes.data.article.articleId;

  // BOM Assembly Header
  const bomShirtRes = await executeCapability("masterdata.article.upsert", ctx, {
    articleNo: "ART-BOM-SHIRT",
    name: "Printed Slopware T-Shirt (Assembled)",
    description: "Printed T-Shirt compiled from base fabric and dye ink.",
    articleGroupId: prdGroup?.articleGroupId ?? null,
    baseUnitId: unitMap.get("pcs") ?? null,
    salesUnitId: unitMap.get("pcs") ?? null,
    bomType: "production",
  });
  if (!bomShirtRes.ok) throw new Error("Failed to create BOM shirt header");
  const bomShirtId = bomShirtRes.data.article.articleId;

  // Create BOM lines (idempotently)
  console.log("Linking components in BOM...");
  const [existingBom1] = await db
    .select()
    .from(schema.articleBom)
    .where(
      and(
        eq(schema.articleBom.tenantId, ctx.tenantId),
        eq(schema.articleBom.headerArticleId, bomShirtId),
        eq(schema.articleBom.componentArticleId, fabricId),
      ),
    );
  if (!existingBom1) {
    await executeCapability("masterdata.articleBom.create", ctx, {
      headerArticleId: bomShirtId,
      componentArticleId: fabricId,
      quantity: 1,
      scrapPercentage: 0,
      sortOrder: 1,
    });
  }

  const [existingBom2] = await db
    .select()
    .from(schema.articleBom)
    .where(
      and(
        eq(schema.articleBom.tenantId, ctx.tenantId),
        eq(schema.articleBom.headerArticleId, bomShirtId),
        eq(schema.articleBom.componentArticleId, inkId),
      ),
    );
  if (!existingBom2) {
    await executeCapability("masterdata.articleBom.create", ctx, {
      headerArticleId: bomShirtId,
      componentArticleId: inkId,
      quantity: "0.15",
      scrapPercentage: 5, // 5% scrap
      sortOrder: 2,
    });
  }

  // Create Production Order (Produktionsauftrag) (idempotently)
  console.log("Seeding Production Order...");
  const [existingProdOrder] = await db
    .select()
    .from(schema.productionOrder)
    .where(
      and(
        eq(schema.productionOrder.tenantId, ctx.tenantId),
        eq(schema.productionOrder.orderNo, "PO-000001"),
      ),
    );
  if (!existingProdOrder) {
    const prodOrderRes = await executeCapability("masterdata.productionOrder.create", ctx, {
      companyId: baseCompany.companyId,
      orderNo: "PO-000001",
      articleId: bomShirtId,
      quantity: 50,
      status: "planned",
      plannedStartDate: new Date().toISOString().slice(0, 10),
      plannedEndDate: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    });
    if (!prodOrderRes.ok) {
      throw new Error(`Failed to create production order: ${JSON.stringify(prodOrderRes.error)}`);
    }
    console.log(`Production Order created: ${prodOrderRes.data.orderNo} for 50 pieces.`);
  } else {
    console.log("Production Order PO-000001 already exists.");
  }

  // 15. Create Sales Orders / Invoices workflow (with Net30 Payment Term)
  const orderGroup = docGroups.find((dg) => dg.documentType === "A");
  const invoiceGroup = docGroups.find((dg) => dg.documentType === "R");

  if (!orderGroup || !invoiceGroup) {
    throw new Error("Could not find order or invoice document group for base tenant.");
  }

  const customers = await db
    .select()
    .from(schema.address)
    .where(and(eq(schema.address.tenantId, ctx.tenantId), eq(schema.address.isCustomer, true)))
    .limit(1);

  if (customers.length === 0) {
    throw new Error("No sample customers found.");
  }
  const customer = customers[0];
  console.log(`Resolved customer: ${customer.companyName} (${customer.addressId})`);

  // Draft Sales Order
  console.log("Creating draft Sales Order...");
  const orderCreateRes = await executeCapability("sales.document.create", ctx, {
    documentGroupId: orderGroup.documentGroupId,
    documentType: "A",
    documentDirection: "OUTBOUND",
    documentDate: new Date().toISOString().slice(0, 10),
    customerId: customer.addressId,
    paymentTermId: net30skontoId,
  });
  if (!orderCreateRes.ok) {
    throw new Error(`Failed to create order document: ${JSON.stringify(orderCreateRes.error)}`);
  }
  const orderId = orderCreateRes.data.documentId;

  console.log("Saving draft Sales Order lines...");
  const orderSaveRes = await executeCapability("sales.document.saveDraft", ctx, {
    documentId: orderId,
    documentGroupId: orderGroup.documentGroupId,
    documentType: "A",
    documentDirection: "OUTBOUND",
    documentDate: new Date().toISOString().slice(0, 10),
    customerId: customer.addressId,
    paymentTermId: net30skontoId,
    lines: [
      {
        lineNo: 1,
        variantId: variants[0].variantId,
        quantity: 5,
        netPrice: 24.99,
        lineType: "article",
      },
      {
        lineNo: 2,
        variantId: variants[1].variantId,
        quantity: 10,
        netPrice: 24.99,
        lineType: "article",
      },
    ],
  });
  if (!orderSaveRes.ok) {
    throw new Error(`Failed to save draft order lines: ${JSON.stringify(orderSaveRes.error)}`);
  }
  console.log(`Created draft Sales Order: ${orderSaveRes.data.documentNo}`);

  // Draft Invoice to be posted
  console.log("Creating draft Invoice...");
  const invoiceCreateRes = await executeCapability("sales.document.create", ctx, {
    documentGroupId: invoiceGroup.documentGroupId,
    documentType: "R",
    documentDirection: "OUTBOUND",
    documentDate: new Date().toISOString().slice(0, 10),
    customerId: customer.addressId,
    paymentTermId: net30skontoId,
  });
  if (!invoiceCreateRes.ok) {
    throw new Error(`Failed to create invoice document: ${JSON.stringify(invoiceCreateRes.error)}`);
  }
  const invoiceId = invoiceCreateRes.data.documentId;

  console.log("Saving draft Invoice lines...");
  const invoiceSaveRes = await executeCapability("sales.document.saveDraft", ctx, {
    documentId: invoiceId,
    documentGroupId: invoiceGroup.documentGroupId,
    documentType: "R",
    documentDirection: "OUTBOUND",
    documentDate: new Date().toISOString().slice(0, 10),
    customerId: customer.addressId,
    paymentTermId: net30skontoId,
    lines: [
      {
        lineNo: 1,
        variantId: variants[2].variantId,
        quantity: 2,
        netPrice: 29.99,
        lineType: "article",
      },
    ],
  });
  if (!invoiceSaveRes.ok) {
    throw new Error(`Failed to save draft invoice lines: ${JSON.stringify(invoiceSaveRes.error)}`);
  }

  // Post the invoice
  console.log(`Posting Invoice ${invoiceSaveRes.data.documentNo}...`);
  const invoicePostRes = await executeCapability("sales.document.post", ctx, {
    documentId: invoiceId,
  });
  if (!invoicePostRes.ok) {
    throw new Error(`Failed to post invoice: ${JSON.stringify(invoicePostRes.error)}`);
  }
  console.log(
    `Successfully posted Invoice! Financial bookings & warehouse output movements generated.`,
  );

  // 16. Seed Email Sync tables (idempotently)
  const [existingEmailAcc] = await db
    .select()
    .from(schema.emailAccount)
    .where(
      and(
        eq(schema.emailAccount.tenantId, ctx.tenantId),
        eq(schema.emailAccount.primaryEmail, "info@slopware.dev"),
      ),
    )
    .limit(1);

  if (!existingEmailAcc) {
    console.log("Seeding Email Accounts and sync messages...");
    const [emailAcc] = await db
      .insert(schema.emailAccount)
      .values({
        emailAccountId: crypto.randomUUID(),
        tenantId: ctx.tenantId,
        provider: "microsoft",
        providerAccountId: "sw-base-inbox",
        displayName: "Slopware Support Inbox",
        primaryEmail: "info@slopware.dev",
        status: "connected",
        credentialsEncrypted: "MOCK_ENCRYPTED_CREDS",
        scopes: ["offline_access", "Mail.ReadWrite"],
        lastSyncStatus: "idle",
        activityTier: "cold",
        syncPriority: "normal",
        archived: false,
      })
      .returning();

    if (emailAcc) {
      if (adminUserId) {
        await db.insert(schema.emailAccountUserGrant).values({
          tenantId: ctx.tenantId,
          emailAccountId: emailAcc.emailAccountId,
          userId: adminUserId,
          canRead: true,
          canSend: true,
          canManage: true,
        });
      }

      await db.insert(schema.emailIdentity).values({
        tenantId: ctx.tenantId,
        emailAccountId: emailAcc.emailAccountId,
        email: "info@slopware.dev",
        displayName: "Slopware Support",
        archived: false,
      });

      const [thread] = await db
        .insert(schema.emailThread)
        .values({
          tenantId: ctx.tenantId,
          emailAccountId: emailAcc.emailAccountId,
          providerThreadId: "th-mock-1",
          subject: "Frage zu Classic Slopware T-Shirt",
          snippet: "Hallo, habt ihr das T-Shirt auch in XL?",
          isRead: false,
          isStarred: false,
          messageCount: 1,
          relatedAddressId: customer.addressId,
          archived: false,
          inTrash: false,
        })
        .returning();

      await db.insert(schema.emailMessage).values({
        tenantId: ctx.tenantId,
        emailAccountId: emailAcc.emailAccountId,
        emailThreadId: thread.emailThreadId,
        providerMessageId: "msg-mock-1",
        direction: "inbound",
        fromJson: { email: "customer@example.com", name: "Kunde Berlin" },
        toJson: [{ email: "info@slopware.dev", name: "Slopware Support" }],
        subject: "Frage zu Classic Slopware T-Shirt",
        snippet: "Hallo, habt ihr das T-Shirt auch in XL?",
        bodyText:
          "Hallo,\n\nhabt ihr das Classic Slopware T-Shirt auch in der Größe XL auf Lager?\n\nViele Grüße,\nEin Kunde",
        isRead: false,
        hasAttachments: false,
        receivedAt: new Date(),
      });
      console.log("Email inbox seeded with mock conversation threads.");
    }
  } else {
    console.log("Email account info@slopware.dev already exists.");
  }

  // 17. Seed Product Categories (hierarchical)
  console.log("Seeding Product Categories...");
  const [existingCat] = await db
    .select()
    .from(schema.category)
    .where(and(eq(schema.category.tenantId, ctx.tenantId), eq(schema.category.code, "ROOT")))
    .limit(1);

  if (!existingCat) {
    const [rootCat] = await db
      .insert(schema.category)
      .values({
        tenantId: ctx.tenantId,
        code: "ROOT",
        name: "Alle Produkte",
        slug: "alle-produkte",
        description: "Stammkategorie fuer alle Produkte",
        sortOrder: 0,
      })
      .returning();

    const [softwareCat, hardwareCat, textilCat] = await db
      .insert(schema.category)
      .values([
        {
          tenantId: ctx.tenantId,
          parentCategoryId: rootCat.categoryId,
          code: "SW",
          name: "Software & Lizenzen",
          slug: "software-lizenzen",
          description: "Software-Produkte und Lizenzmodelle",
          sortOrder: 1,
        },
        {
          tenantId: ctx.tenantId,
          parentCategoryId: rootCat.categoryId,
          code: "HW",
          name: "Hardware & Technik",
          slug: "hardware-technik",
          description: "Hardware-Module und technische Produkte",
          sortOrder: 2,
        },
        {
          tenantId: ctx.tenantId,
          parentCategoryId: rootCat.categoryId,
          code: "TXT",
          name: "Textilien & Merchandise",
          slug: "textilien-merchandise",
          description: "T-Shirts, Kleidung und Merchandise",
          sortOrder: 3,
        },
      ])
      .returning();

    const [dienstleistungCat] = await db
      .insert(schema.category)
      .values({
        tenantId: ctx.tenantId,
        parentCategoryId: softwareCat.categoryId,
        code: "SVC",
        name: "Dienstleistungen",
        slug: "dienstleistungen",
        description: "Beratung und professionelle Dienstleistungen",
        sortOrder: 1,
      })
      .returning();

    // Resolve existing articles by articleNo for category assignment
    const existingArticles = await db
      .select({ articleId: schema.article.articleId, articleNo: schema.article.articleNo })
      .from(schema.article)
      .where(eq(schema.article.tenantId, ctx.tenantId));
    const artByNo = new Map(existingArticles.map((a) => [a.articleNo, a.articleId]));

    const categoryAssignments: Array<{ articleNo: string; categoryId: string }> = [
      { articleNo: "ART-001", categoryId: softwareCat.categoryId },
      { articleNo: "ART-002", categoryId: dienstleistungCat.categoryId },
      { articleNo: "ART-003", categoryId: hardwareCat.categoryId },
      { articleNo: "ART-SERIAL", categoryId: hardwareCat.categoryId },
      { articleNo: "ART-TSHIRT", categoryId: textilCat.categoryId },
      { articleNo: "ART-BOM-SHIRT", categoryId: textilCat.categoryId },
    ];

    const validAssignments = categoryAssignments
      .filter((a) => artByNo.has(a.articleNo))
      .map((a) => ({
        tenantId: ctx.tenantId,
        articleId: artByNo.get(a.articleNo)!,
        categoryId: a.categoryId,
      }));

    if (validAssignments.length > 0) {
      await db.insert(schema.articleCategory).values(validAssignments).onConflictDoNothing();
    }
    console.log(`Seeded ${5} categories + ${validAssignments.length} article-category links.`);
  } else {
    console.log("Categories already seeded.");
  }

  // 18. Seed E-Commerce Sync tables (idempotently)
  const [existingChannel] = await db
    .select()
    .from(schema.salesChannel)
    .where(
      and(
        eq(schema.salesChannel.tenantId, ctx.tenantId),
        eq(schema.salesChannel.name, "Shopware 6 Hauptshop"),
      ),
    )
    .limit(1);

  if (!existingChannel) {
    console.log("Seeding E-Commerce Sync data...");
    const [channel] = await db
      .insert(schema.salesChannel)
      .values({
        tenantId: ctx.tenantId,
        name: "Shopware 6 Hauptshop",
        platform: "shopware6",
        apiUrl: "https://shop.slopware.dev/api",
        credentials: { apiKey: "mock-key" },
        isActive: true,
      })
      .returning();

    if (channel) {
      const [syncRun] = await db
        .insert(schema.commerceSyncRun)
        .values({
          tenantId: ctx.tenantId,
          salesChannelId: channel.salesChannelId,
          direction: "pull",
          mode: "full",
          status: "success",
          requestedEntities: ["articles", "article_variants"],
          totalItems: 10,
          succeededItems: 10,
          failedItems: 0,
          startedAt: new Date(Date.now() - 3600000),
          completedAt: new Date(),
        })
        .returning();

      await db.insert(schema.commerceSyncRunStep).values({
        runId: syncRun.runId,
        tenantId: ctx.tenantId,
        salesChannelId: channel.salesChannelId,
        entityType: "article",
        phase: "pull",
        status: "success",
        sequence: 1,
        batchNo: 1,
        plannedItems: 10,
        succeededItems: 10,
        failedItems: 0,
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(),
      });

      await db.insert(schema.externalSyncMapping).values({
        tenantId: ctx.tenantId,
        salesChannelId: channel.salesChannelId,
        sourceSystem: "sales_channel",
        entityType: "article",
        internalId: articleId,
        externalId: "sw-prod-classic-tshirt",
        syncDirection: "bidirectional",
        syncStatus: "success",
        lastSyncAt: new Date(),
      });
      console.log("Shopware e-commerce sync channels & mappings seeded successfully.");
    }
  } else {
    console.log("Sales channel 'Shopware 6 Hauptshop' already exists.");
  }
}

if (isScriptEntry(import.meta.url)) {
  main()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Full Feature Seeding Failed:", err);
      await closeDb();
      process.exit(1);
    });
}
