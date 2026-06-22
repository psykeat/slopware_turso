import assert from "node:assert/strict";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import { articleVariant, inventoryItem } from "../schema/app.schema";
import {
  cleanupEphemeralTenants,
  createEphemeralTenant,
  seedArticleRow,
  seedInventoryItemRow,
  seedVariantRow,
} from "../test-support/fixtures";
import { backfillDefaultArticleVariants } from "./default-variant-backfill";
import { createArticleVariantOptionValueHash } from "./ecommerce-variant";

async function createBackfillFixture() {
  const { tenantId, suffix } = await createEphemeralTenant("Backfill");
  const defaultVariantHash = createArticleVariantOptionValueHash([]);

  // Already has a (custom) variant + inventory → not a backfill candidate.
  const existingVariantArticle = await seedArticleRow(tenantId, {
    articleNo: `BF-EXIST-${suffix}`,
  });
  const existingVariant = await seedVariantRow(tenantId, {
    articleId: existingVariantArticle.articleId,
    sku: `CUSTOM-${suffix}`,
    optionValueHash: defaultVariantHash,
  });
  await seedInventoryItemRow(tenantId, {
    variantId: existingVariant.variantId,
    sku: existingVariant.sku,
  });

  // Legacy articles WITHOUT a default variant → the two backfill candidates.
  const missingVariantArticle = await seedArticleRow(tenantId, { articleNo: `BF-MISS-${suffix}` });
  const secondMissingVariantArticle = await seedArticleRow(tenantId, {
    articleNo: `BF-MISS-2-${suffix}`,
  });

  return {
    tenantId,
    existingVariantArticle,
    missingVariantArticle,
    secondMissingVariantArticle,
    defaultVariantHash,
  };
}

test("backfillDefaultArticleVariants creates one default variant per missing article and is idempotent", async () => {
  const fixture = await createBackfillFixture();

  const first = await backfillDefaultArticleVariants(fixture.tenantId);
  assert.equal(first.candidateArticles, 2);
  assert.equal(first.createdVariants, 2);
  assert.equal(first.createdInventoryItems, 2);
  assert.equal(first.skippedArticles, 0);

  const missingVariantRows = await db
    .select({
      variantId: articleVariant.variantId,
      sku: articleVariant.sku,
      optionValueHash: articleVariant.optionValueHash,
    })
    .from(articleVariant)
    .where(
      and(
        eq(articleVariant.tenantId, fixture.tenantId),
        eq(articleVariant.articleId, fixture.missingVariantArticle.articleId),
      ),
    );

  assert.equal(missingVariantRows.length, 1);
  assert.equal(missingVariantRows[0]?.optionValueHash, fixture.defaultVariantHash);
  assert.equal(
    missingVariantRows[0]?.sku,
    `${fixture.missingVariantArticle.articleNo}-${fixture.defaultVariantHash}`,
  );

  const secondMissingVariantRows = await db
    .select({
      variantId: articleVariant.variantId,
      sku: articleVariant.sku,
      optionValueHash: articleVariant.optionValueHash,
    })
    .from(articleVariant)
    .where(
      and(
        eq(articleVariant.tenantId, fixture.tenantId),
        eq(articleVariant.articleId, fixture.secondMissingVariantArticle.articleId),
      ),
    );

  assert.equal(secondMissingVariantRows.length, 1);
  assert.equal(secondMissingVariantRows[0]?.optionValueHash, fixture.defaultVariantHash);
  assert.equal(
    secondMissingVariantRows[0]?.sku,
    `${fixture.secondMissingVariantArticle.articleNo}-${fixture.defaultVariantHash}`,
  );

  const missingInventoryRows = await db
    .select({
      itemId: inventoryItem.itemId,
      variantId: inventoryItem.variantId,
      sku: inventoryItem.sku,
    })
    .from(inventoryItem)
    .where(eq(inventoryItem.tenantId, fixture.tenantId));

  assert.equal(missingInventoryRows.length, 3);
  assert.equal(
    missingInventoryRows.filter((row) => row.variantId === missingVariantRows[0]?.variantId).length,
    1,
  );
  assert.equal(
    missingInventoryRows.filter((row) => row.variantId === secondMissingVariantRows[0]?.variantId)
      .length,
    1,
  );

  const second = await backfillDefaultArticleVariants(fixture.tenantId);
  assert.equal(second.candidateArticles, 0);
  assert.equal(second.createdVariants, 0);
  assert.equal(second.createdInventoryItems, 0);
  assert.equal(second.skippedArticles, 0);

  const allVariantRows = await db
    .select({
      variantId: articleVariant.variantId,
      articleId: articleVariant.articleId,
    })
    .from(articleVariant)
    .where(eq(articleVariant.tenantId, fixture.tenantId));

  assert.equal(allVariantRows.length, 3);
});

after(async () => {
  await cleanupEphemeralTenants();
  await closeDb();
});
