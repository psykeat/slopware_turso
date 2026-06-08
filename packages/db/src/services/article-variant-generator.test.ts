import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import {
  article,
  articleOption,
  articleOptionValue,
  articleVariant,
  articleVariantOptionValue,
  inventoryItem,
  organization,
  tenant,
} from "../schema/app.schema";
import { generateArticleVariants } from "./article-variant-generator";
import { createArticleVariantOptionValueHash } from "./ecommerce-variant";

async function createVariantFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);

  const [org] = await db
    .insert(organization)
    .values({
      name: `Variant Test Org ${suffix}`,
      slug: `variant-test-org-${suffix}`,
    })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Variant Test Tenant ${suffix}`,
      slug: `variant-test-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const [articleRow] = await db
    .insert(article)
    .values({
      tenantId: tenantRow.tenantId,
      articleNo: `VAR-${suffix}`,
      name: `Variant Test Article ${suffix}`,
    })
    .returning({ articleId: article.articleId, articleNo: article.articleNo });

  const optionRows = await db
    .insert(articleOption)
    .values([
      {
        tenantId: tenantRow.tenantId,
        articleId: articleRow.articleId,
        name: "Size",
        sortOrder: 20,
      },
      {
        tenantId: tenantRow.tenantId,
        articleId: articleRow.articleId,
        name: "Color",
        sortOrder: 10,
      },
    ])
    .returning({
      optionId: articleOption.optionId,
      name: articleOption.name,
      sortOrder: articleOption.sortOrder,
    });

  const sizeOption = optionRows.find((row) => row.name === "Size");
  const colorOption = optionRows.find((row) => row.name === "Color");
  if (!sizeOption || !colorOption) {
    throw new Error("Failed to seed article options");
  }

  const valueRows = await db
    .insert(articleOptionValue)
    .values([
      {
        tenantId: tenantRow.tenantId,
        optionId: sizeOption.optionId,
        value: "S",
        sortOrder: 20,
      },
      {
        tenantId: tenantRow.tenantId,
        optionId: sizeOption.optionId,
        value: "M",
        sortOrder: 10,
      },
      {
        tenantId: tenantRow.tenantId,
        optionId: colorOption.optionId,
        value: "Red",
        sortOrder: 20,
      },
      {
        tenantId: tenantRow.tenantId,
        optionId: colorOption.optionId,
        value: "Blue",
        sortOrder: 10,
      },
    ])
    .returning({
      valueId: articleOptionValue.valueId,
      optionId: articleOptionValue.optionId,
      value: articleOptionValue.value,
      sortOrder: articleOptionValue.sortOrder,
    });

  const sizeSmall = valueRows.find(
    (row) => row.optionId === sizeOption.optionId && row.value === "S",
  );
  const sizeLarge = valueRows.find(
    (row) => row.optionId === sizeOption.optionId && row.value === "M",
  );
  const colorRed = valueRows.find(
    (row) => row.optionId === colorOption.optionId && row.value === "Red",
  );
  const colorBlue = valueRows.find(
    (row) => row.optionId === colorOption.optionId && row.value === "Blue",
  );
  if (!sizeSmall || !sizeLarge || !colorRed || !colorBlue) {
    throw new Error("Failed to seed article option values");
  }

  return {
    tenantId: tenantRow.tenantId,
    articleId: articleRow.articleId,
    articleNo: articleRow.articleNo,
    axes: {
      size: {
        optionId: sizeOption.optionId,
        optionName: sizeOption.name,
        values: [sizeSmall, sizeLarge],
      },
      color: {
        optionId: colorOption.optionId,
        optionName: colorOption.name,
        values: [colorRed, colorBlue],
      },
    },
  };
}

test("generateArticleVariants creates the cartesian product and is idempotent", async () => {
  const fixture = await createVariantFixture();

  const first = await generateArticleVariants(fixture.tenantId, fixture.articleId);
  assert.equal(first.combinations, 4);
  assert.equal(first.createdVariants, 4);
  assert.equal(first.createdInventoryItems, 4);
  assert.equal(first.skippedVariants, 0);

  const second = await generateArticleVariants(fixture.tenantId, fixture.articleId);
  assert.equal(second.combinations, 4);
  assert.equal(second.createdVariants, 0);
  assert.equal(second.createdInventoryItems, 0);
  assert.equal(second.skippedVariants, 4);

  const variantRows = await db
    .select({
      variantId: articleVariant.variantId,
      sku: articleVariant.sku,
      optionValueHash: articleVariant.optionValueHash,
    })
    .from(articleVariant)
    .where(
      and(
        eq(articleVariant.tenantId, fixture.tenantId),
        eq(articleVariant.articleId, fixture.articleId),
      ),
    );

  assert.equal(variantRows.length, 4);
  assert.equal(new Set(variantRows.map((row) => row.optionValueHash)).size, 4);

  const itemRows = await db
    .select({
      itemId: inventoryItem.itemId,
      variantId: inventoryItem.variantId,
      sku: inventoryItem.sku,
    })
    .from(inventoryItem)
    .where(eq(inventoryItem.tenantId, fixture.tenantId));

  assert.equal(itemRows.length, 4);

  const relationRows = await db
    .select({
      variantId: articleVariantOptionValue.variantId,
      valueId: articleVariantOptionValue.valueId,
    })
    .from(articleVariantOptionValue)
    .where(eq(articleVariantOptionValue.tenantId, fixture.tenantId));

  assert.equal(relationRows.length, 8);

  const expectedHashes = [
    createArticleVariantOptionValueHash([
      {
        optionName: fixture.axes.color.optionName,
        valueId: fixture.axes.color.values[0].valueId,
      },
      {
        optionName: fixture.axes.size.optionName,
        valueId: fixture.axes.size.values[0].valueId,
      },
    ]),
    createArticleVariantOptionValueHash([
      {
        optionName: fixture.axes.color.optionName,
        valueId: fixture.axes.color.values[0].valueId,
      },
      {
        optionName: fixture.axes.size.optionName,
        valueId: fixture.axes.size.values[1].valueId,
      },
    ]),
    createArticleVariantOptionValueHash([
      {
        optionName: fixture.axes.color.optionName,
        valueId: fixture.axes.color.values[1].valueId,
      },
      {
        optionName: fixture.axes.size.optionName,
        valueId: fixture.axes.size.values[0].valueId,
      },
    ]),
    createArticleVariantOptionValueHash([
      {
        optionName: fixture.axes.color.optionName,
        valueId: fixture.axes.color.values[1].valueId,
      },
      {
        optionName: fixture.axes.size.optionName,
        valueId: fixture.axes.size.values[1].valueId,
      },
    ]),
  ];

  assert.deepEqual(
    [...new Set(variantRows.map((row) => row.optionValueHash))].sort(),
    [...new Set(expectedHashes)].sort(),
  );

  const [firstVariantRow] = variantRows;
  assert.ok(firstVariantRow);

  await db
    .delete(inventoryItem)
    .where(
      and(
        eq(inventoryItem.tenantId, fixture.tenantId),
        eq(inventoryItem.variantId, firstVariantRow.variantId),
      ),
    );

  const repairRun = await generateArticleVariants(fixture.tenantId, fixture.articleId);
  assert.equal(repairRun.combinations, 4);
  assert.equal(repairRun.createdVariants, 0);
  assert.equal(repairRun.createdInventoryItems, 1);
  assert.equal(repairRun.skippedVariants, 4);

  const repairedInventoryRows = await db
    .select({
      itemId: inventoryItem.itemId,
      variantId: inventoryItem.variantId,
      sku: inventoryItem.sku,
    })
    .from(inventoryItem)
    .where(eq(inventoryItem.tenantId, fixture.tenantId));

  assert.equal(repairedInventoryRows.length, 4);
  assert.equal(
    repairedInventoryRows.filter((row) => row.variantId === firstVariantRow.variantId).length,
    1,
  );
});

test("generateArticleVariants is safe to call concurrently", async () => {
  const fixture = await createVariantFixture();

  const [first, second] = await Promise.all([
    generateArticleVariants(fixture.tenantId, fixture.articleId),
    generateArticleVariants(fixture.tenantId, fixture.articleId),
  ]);

  assert.equal(first.combinations, 4);
  assert.equal(second.combinations, 4);
  assert.equal(first.createdVariants + second.createdVariants, 4);
  assert.equal(first.skippedVariants + second.skippedVariants, 4);

  const variantRows = await db
    .select({
      variantId: articleVariant.variantId,
      optionValueHash: articleVariant.optionValueHash,
    })
    .from(articleVariant)
    .where(
      and(
        eq(articleVariant.tenantId, fixture.tenantId),
        eq(articleVariant.articleId, fixture.articleId),
      ),
    );

  assert.equal(variantRows.length, 4);
  assert.equal(new Set(variantRows.map((row) => row.optionValueHash)).size, 4);
});

after(async () => {
  await closeDb();
});
