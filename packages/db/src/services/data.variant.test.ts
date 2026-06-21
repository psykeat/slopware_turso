import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import {
  article,
  articleOption,
  articleOptionValue,
  articleVariant,
  articleVariantOptionValue,
  company,
  inventoryBalance,
  inventoryItem,
  inventoryLevel,
  organization,
  tenant,
  warehouse,
} from "../schema/app.schema";
import { DataService } from "./data";

async function createVariantProjectionFixture(withOptionSummary = false) {
  const suffix = crypto.randomUUID().slice(0, 8);

  const [org] = await db
    .insert(organization)
    .values({
      name: `Projection Org ${suffix}`,
      slug: `projection-org-${suffix}`,
    })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Projection Tenant ${suffix}`,
      slug: `projection-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  await db.insert(company).values({
    tenantId: tenantRow.tenantId,
    companyNo: `P-${suffix}`,
    name: `Projection Company ${suffix}`,
    countryCode: "DE",
    currencyId: "EUR",
  });

  const [warehouseRow] = await db
    .insert(warehouse)
    .values({
      tenantId: tenantRow.tenantId,
      code: `WH-P-${suffix}`,
      name: `Projection Warehouse ${suffix}`,
    })
    .returning({ warehouseId: warehouse.warehouseId });

  const [catalogArticle] = await db
    .insert(article)
    .values({
      tenantId: tenantRow.tenantId,
      articleNo: `PROJ-${suffix}`,
      name: `Projection Article ${suffix}`,
    })
    .returning({ articleId: article.articleId });

  const variantSku = `PROJ-SKU-${suffix}`;
  const [variantRow] = await db
    .insert(articleVariant)
    .values({
      tenantId: tenantRow.tenantId,
      articleId: catalogArticle.articleId,
      sku: variantSku,
      optionValueHash: `hash-${suffix}`,
      isActive: true,
    })
    .returning({
      variantId: articleVariant.variantId,
      sku: articleVariant.sku,
    });

  if (withOptionSummary) {
    const [optionRow] = await db
      .insert(articleOption)
      .values({
        tenantId: tenantRow.tenantId,
        articleId: catalogArticle.articleId,
        name: "Color",
        sortOrder: 0,
      })
      .returning({ optionId: articleOption.optionId });

    const [valueRow] = await db
      .insert(articleOptionValue)
      .values({
        tenantId: tenantRow.tenantId,
        optionId: optionRow.optionId,
        value: "Red",
        sortOrder: 0,
      })
      .returning({ valueId: articleOptionValue.valueId });

    await db.insert(articleVariantOptionValue).values({
      tenantId: tenantRow.tenantId,
      variantId: variantRow.variantId,
      valueId: valueRow.valueId,
    });
  }

  const [inventoryRow] = await db
    .insert(inventoryItem)
    .values({
      tenantId: tenantRow.tenantId,
      variantId: variantRow.variantId,
      sku: variantSku,
      tracked: true,
    })
    .returning({ itemId: inventoryItem.itemId });

  await db.insert(inventoryLevel).values({
    tenantId: tenantRow.tenantId,
    itemId: inventoryRow.itemId,
    locationId: warehouseRow.warehouseId,
    quantity: "13",
  });

  await db.insert(inventoryBalance).values({
    tenantId: tenantRow.tenantId,
    warehouseId: warehouseRow.warehouseId,
    inventoryItemId: inventoryRow.itemId,
    articleId: catalogArticle.articleId,
    onHandQty: "13",
    reservedQty: "0",
    availableQty: "13",
    expectedPurchaseQty: "0",
  });

  return {
    tenantId: tenantRow.tenantId,
    articleId: catalogArticle.articleId,
    variantId: variantRow.variantId,
    variantSku,
  };
}

test("articleVariant lookup projects availability from inventory_level", async () => {
  const fixture = await createVariantProjectionFixture();
  const dataService = new DataService();

  const rows = (await dataService.list("articleVariant", {
    articleId: fixture.articleId,
  })) as Array<{
    variantId: string;
    availableQty: string;
  }>;

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.variantId, fixture.variantId);
  assert.equal(rows[0]?.availableQty, "13");
});

test("articleVariant lookupLabel combines SKU, option summary, and availability", async () => {
  const fixture = await createVariantProjectionFixture(true);
  const dataService = new DataService();

  const rows = (await dataService.list("articleVariant", {
    articleId: fixture.articleId,
  })) as Array<{
    lookupLabel: string;
  }>;

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.lookupLabel, `${fixture.variantSku} · Color: Red · 13 available`);
});

after(async () => {
  await closeDb();
});
