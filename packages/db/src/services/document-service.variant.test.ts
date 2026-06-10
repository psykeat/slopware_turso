import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import { sql } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import {
  article,
  articleVariant,
  company,
  document,
  documentGroup,
  documentLine,
  organization,
  tenant,
  warehouse,
} from "../schema/app.schema";
import { DocumentService } from "./document-service";

async function createVariantDocumentFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);

  const [org] = await db
    .insert(organization)
    .values({
      name: `Document Variant Org ${suffix}`,
      slug: `document-variant-org-${suffix}`,
    })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Document Variant Tenant ${suffix}`,
      slug: `document-variant-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const [companyRow] = await db
    .insert(company)
    .values({
      tenantId: tenantRow.tenantId,
      companyNo: `DVT-${suffix}`,
      name: `Document Variant Company ${suffix}`,
      countryCode: "DE",
      currencyId: "EUR",
    })
    .returning({ companyId: company.companyId });

  const [warehouseRow] = await db
    .insert(warehouse)
    .values({
      tenantId: tenantRow.tenantId,
      companyId: companyRow.companyId,
      code: `WH-${suffix}`,
      name: `Document Variant Warehouse ${suffix}`,
    })
    .returning({ warehouseId: warehouse.warehouseId });

  const [groupRow] = await db
    .insert(documentGroup)
    .values({
      tenantId: tenantRow.tenantId,
      companyId: companyRow.companyId,
      name: `Document Variant Group ${suffix}`,
      documentType: "L",
      groupNumber: 1,
      direction: "OUTBOUND",
      defaultWarehouseId: warehouseRow.warehouseId,
      requireSerialTracking: false,
      requireBatchTracking: false,
    })
    .returning({ documentGroupId: documentGroup.documentGroupId });

  const [catalogArticle] = await db
    .insert(article)
    .values({
      tenantId: tenantRow.tenantId,
      articleNo: `CAT-${suffix}`,
      name: `Catalog Article ${suffix}`,
    })
    .returning({ articleId: article.articleId });

  const [variantRow] = await db
    .insert(articleVariant)
    .values({
      tenantId: tenantRow.tenantId,
      articleId: catalogArticle.articleId,
      sku: `SKU-${suffix}`,
      optionValueHash: `hash-${suffix}`,
      isActive: true,
    })
    .returning({
      variantId: articleVariant.variantId,
      articleId: articleVariant.articleId,
    });

  return {
    tenantId: tenantRow.tenantId,
    companyId: companyRow.companyId,
    warehouseId: warehouseRow.warehouseId,
    documentGroupId: groupRow.documentGroupId,
    catalogArticleId: catalogArticle.articleId,
    variantId: variantRow.variantId,
  };
}

test("saveDocumentDraft rejects catalog lines without variantId", async () => {
  const fixture = await createVariantDocumentFixture();
  const service = new DocumentService();

  await assert.rejects(
    service.saveDocumentDraft(fixture.tenantId, "variant-test-user", {
      documentGroupId: fixture.documentGroupId,
      documentType: "L",
      documentDirection: "OUTBOUND",
      lines: [
        {
          lineNo: 1,
          articleId: fixture.catalogArticleId,
          quantity: 1,
          netPrice: 12.5,
          lineType: "article",
        },
      ],
    }),
    /requires variantId/,
  );
});

test("postDocument resolves article truth from variantId, not the stored articleId", async () => {
  const fixture = await createVariantDocumentFixture();
  const service = new DocumentService();

  const documentRow = {
    documentId: crypto.randomUUID(),
  };

  await db.insert(document).values({
    documentId: documentRow.documentId,
    tenantId: fixture.tenantId,
    companyId: fixture.companyId,
    documentType: "L",
    documentDirection: "OUTBOUND",
    documentNo: `DOC-${crypto.randomUUID().slice(0, 8)}`,
    status: "draft",
    documentDate: new Date().toISOString().slice(0, 10),
    documentGroupId: fixture.documentGroupId,
    warehouseId: fixture.warehouseId,
    transactionId: crypto.randomUUID(),
  });

  const lineRow = {
    documentLineId: crypto.randomUUID(),
  };

  await db.insert(documentLine).values({
    documentLineId: lineRow.documentLineId,
    tenantId: fixture.tenantId,
    documentId: documentRow.documentId,
    lineNo: 1,
    variantId: fixture.variantId,
    quantity: "2",
    netPrice: "15",
    warehouseId: fixture.warehouseId,
    movementType: "L",
    lineType: "article",
    transactionId: crypto.randomUUID(),
  });

  const result = await service.postDocument(
    documentRow.documentId,
    "variant-test-user",
    fixture.tenantId,
  );
  assert.equal(result.success, true);

  const movementRows = (await db.execute(sql`
    select
      variant_id as "variantId",
      inventory_item_id as "inventoryItemId",
      source_document_line_id as "sourceDocumentLineId"
    from inventory_movement
    where source_document_line_id = ${lineRow.documentLineId}
    limit 1
  `)) as Array<{
    variantId: string | null;
    inventoryItemId: string | null;
    sourceDocumentLineId: string | null;
  }>;
  const [movement] = movementRows;

  const balanceRows = (await db.execute(sql`
    select
      article_id as "articleId",
      on_hand_qty as "onHandQty"
    from inventory_balance
    where warehouse_id = ${fixture.warehouseId} and article_id = ${fixture.catalogArticleId}
    limit 1
  `)) as Array<{
    articleId: string | null;
    onHandQty: string | null;
  }>;
  const [balance] = balanceRows;

  const inventoryItemRows = (await db.execute(sql`
    select
      item_id as "itemId",
      variant_id as "variantId"
    from inventory_item
    where tenant_id = ${fixture.tenantId} and variant_id = ${fixture.variantId}
    limit 1
  `)) as Array<{
    itemId: string | null;
    variantId: string | null;
  }>;
  const [inventoryItemRow] = inventoryItemRows;

  assert.equal(movement?.sourceDocumentLineId, lineRow.documentLineId);
  assert.equal(movement?.variantId, fixture.variantId);
  assert.ok(movement?.inventoryItemId);
  assert.equal(balance?.articleId, fixture.catalogArticleId);
  assert.equal(inventoryItemRow?.variantId, fixture.variantId);
  assert.ok(inventoryItemRow?.itemId);
});

after(async () => {
  await closeDb();
});
