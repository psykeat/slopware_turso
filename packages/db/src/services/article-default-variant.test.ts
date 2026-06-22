import assert from "node:assert/strict";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import { articleVariant, inventoryItem } from "../schema/app.schema";
import { useTestTenant } from "../test-support/fixtures";
import { DataService } from "./data";
import { createArticleVariantOptionValueHash } from "./ecommerce-variant";

const createArticleFixture = () => useTestTenant();

test("article creation seeds one default variant and inventory item", async () => {
  const fixture = await createArticleFixture();
  const dataService = new DataService();
  const articleNo = `ART-${fixture.suffix}`;

  const created = await dataService.create("article", {
    articleNo,
    name: `Created Article ${fixture.suffix}`,
  });

  const createdArticleId = created[0]?.articleId;
  if (!createdArticleId) {
    throw new Error("Article was not created");
  }

  const variantRows = await db
    .select({
      variantId: articleVariant.variantId,
      sku: articleVariant.sku,
      optionValueHash: articleVariant.optionValueHash,
      isActive: articleVariant.isActive,
    })
    .from(articleVariant)
    .where(eq(articleVariant.articleId, createdArticleId));

  assert.equal(variantRows.length, 1);
  assert.equal(variantRows[0]?.optionValueHash, createArticleVariantOptionValueHash([]));
  assert.equal(variantRows[0]?.sku, `${articleNo}-${createArticleVariantOptionValueHash([])}`);
  assert.equal(variantRows[0]?.isActive, true);

  const inventoryRows = await db
    .select({
      itemId: inventoryItem.itemId,
      variantId: inventoryItem.variantId,
      sku: inventoryItem.sku,
    })
    .from(inventoryItem)
    .where(eq(inventoryItem.variantId, variantRows[0]!.variantId));

  assert.equal(inventoryRows.length, 1);
  assert.equal(inventoryRows[0]?.sku, variantRows[0]?.sku);
});

test("article name changes do not change the default variant SKU", async () => {
  const fixture = await createArticleFixture();
  const dataService = new DataService();
  const articleNo = `ART-NAME-${fixture.suffix}`;

  const created = await dataService.create("article", {
    articleNo,
    name: `Original Name ${fixture.suffix}`,
  });
  const createdArticleId = created[0]?.articleId;
  if (!createdArticleId) {
    throw new Error("Article was not created");
  }

  const beforeRows = await db
    .select({
      variantId: articleVariant.variantId,
      sku: articleVariant.sku,
    })
    .from(articleVariant)
    .where(eq(articleVariant.articleId, createdArticleId));
  assert.equal(beforeRows.length, 1);

  await dataService.patch("article", createdArticleId, {
    name: `Renamed Article ${fixture.suffix}`,
  });

  const afterRows = await db
    .select({
      variantId: articleVariant.variantId,
      sku: articleVariant.sku,
    })
    .from(articleVariant)
    .where(eq(articleVariant.articleId, createdArticleId));
  assert.equal(afterRows.length, 1);
  assert.equal(afterRows[0]?.sku, beforeRows[0]?.sku);
  assert.equal(afterRows[0]?.sku, `${articleNo}-${createArticleVariantOptionValueHash([])}`);
});

after(async () => {
  await closeDb();
});
