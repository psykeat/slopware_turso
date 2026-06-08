import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import { article, articleVariant, inventoryItem, organization, tenant } from "../schema/app.schema";
import { backfillDefaultArticleVariants } from "./default-variant-backfill";
import { createArticleVariantOptionValueHash } from "./ecommerce-variant";

async function createBackfillFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);

  const [org] = await db
    .insert(organization)
    .values({
      name: `Backfill Test Org ${suffix}`,
      slug: `backfill-test-org-${suffix}`,
    })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Backfill Test Tenant ${suffix}`,
      slug: `backfill-test-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const [existingVariantArticle] = await db
    .insert(article)
    .values({
      tenantId: tenantRow.tenantId,
      articleNo: `BF-EXIST-${suffix}`,
      name: `Backfill Existing Variant Article ${suffix}`,
    })
    .returning({
      articleId: article.articleId,
      articleNo: article.articleNo,
    });

  const [missingVariantArticle] = await db
    .insert(article)
    .values({
      tenantId: tenantRow.tenantId,
      articleNo: `BF-MISS-${suffix}`,
      name: `Backfill Missing Variant Article ${suffix}`,
    })
    .returning({
      articleId: article.articleId,
      articleNo: article.articleNo,
    });

  const [secondMissingVariantArticle] = await db
    .insert(article)
    .values({
      tenantId: tenantRow.tenantId,
      articleNo: `BF-MISS-2-${suffix}`,
      name: `Backfill Second Missing Variant Article ${suffix}`,
    })
    .returning({
      articleId: article.articleId,
      articleNo: article.articleNo,
    });

  const defaultVariantHash = createArticleVariantOptionValueHash([]);

  const [existingVariant] = await db
    .insert(articleVariant)
    .values({
      tenantId: tenantRow.tenantId,
      articleId: existingVariantArticle.articleId,
      sku: `CUSTOM-${suffix}`,
      optionValueHash: defaultVariantHash,
      isActive: true,
    })
    .returning({
      variantId: articleVariant.variantId,
      sku: articleVariant.sku,
    });

  await db.insert(inventoryItem).values({
    tenantId: tenantRow.tenantId,
    variantId: existingVariant.variantId,
    sku: existingVariant.sku,
    tracked: true,
  });

  return {
    tenantId: tenantRow.tenantId,
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
  await closeDb();
});
