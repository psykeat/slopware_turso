import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "../index";
import {
  article,
  articleOption,
  articleOptionValue,
  articleVariant,
  articleVariantOptionValue,
  inventoryItem,
} from "../schema/app.schema";
import { createArticleVariantOptionValueHash } from "./ecommerce-variant";

type VariantTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type VariantAxisValue = {
  optionName: string;
  valueId: string;
};

type VariantAxis = {
  optionId: string;
  optionName: string;
  sortOrder: number;
  values: Array<{
    valueId: string;
    value: string;
    sortOrder: number;
  }>;
};

export type GenerateArticleVariantsResult = {
  articleId: string;
  combinations: number;
  createdVariants: number;
  skippedVariants: number;
};

function cartesianProduct<T>(sets: readonly T[][]): T[][] {
  if (sets.length === 0) return [[]];

  return sets.reduce<T[][]>(
    (accumulator, set) => accumulator.flatMap((prefix) => set.map((value) => [...prefix, value])),
    [[]],
  );
}

async function loadVariantAxes(
  tx: VariantTx,
  tenantId: string,
  articleId: string,
): Promise<VariantAxis[]> {
  const options = await tx
    .select({
      optionId: articleOption.optionId,
      optionName: articleOption.name,
      sortOrder: articleOption.sortOrder,
    })
    .from(articleOption)
    .where(and(eq(articleOption.tenantId, tenantId), eq(articleOption.articleId, articleId)))
    .orderBy(asc(articleOption.sortOrder), asc(articleOption.name), asc(articleOption.optionId));

  if (options.length === 0) {
    return [] as VariantAxis[];
  }

  const values = await tx
    .select({
      optionId: articleOptionValue.optionId,
      valueId: articleOptionValue.valueId,
      value: articleOptionValue.value,
      sortOrder: articleOptionValue.sortOrder,
    })
    .from(articleOptionValue)
    .innerJoin(articleOption, eq(articleOption.optionId, articleOptionValue.optionId))
    .where(and(eq(articleOption.tenantId, tenantId), eq(articleOption.articleId, articleId)))
    .orderBy(
      asc(articleOption.sortOrder),
      asc(articleOption.name),
      asc(articleOption.optionId),
      asc(articleOptionValue.sortOrder),
      asc(articleOptionValue.value),
      asc(articleOptionValue.valueId),
    );

  const valuesByOptionId = new Map<string, VariantAxis["values"]>();
  for (const row of values) {
    const bucket = valuesByOptionId.get(row.optionId);
    if (bucket) {
      bucket.push({
        valueId: row.valueId,
        value: row.value,
        sortOrder: row.sortOrder,
      });
    } else {
      valuesByOptionId.set(row.optionId, [
        {
          valueId: row.valueId,
          value: row.value,
          sortOrder: row.sortOrder,
        },
      ]);
    }
  }

  return options.map((option) => ({
    ...option,
    values: valuesByOptionId.get(option.optionId) ?? [],
  }));
}

async function findVariantByHash(tx: VariantTx, tenantId: string, articleId: string, hash: string) {
  const [row] = await tx
    .select({
      variantId: articleVariant.variantId,
      sku: articleVariant.sku,
    })
    .from(articleVariant)
    .where(
      and(
        eq(articleVariant.tenantId, tenantId),
        eq(articleVariant.articleId, articleId),
        eq(articleVariant.optionValueHash, hash),
      ),
    )
    .limit(1);

  return row ?? null;
}

async function findInventoryItemByVariantId(tx: VariantTx, tenantId: string, variantId: string) {
  const [row] = await tx
    .select({
      itemId: inventoryItem.itemId,
      sku: inventoryItem.sku,
    })
    .from(inventoryItem)
    .where(and(eq(inventoryItem.tenantId, tenantId), eq(inventoryItem.variantId, variantId)))
    .limit(1);

  return row ?? null;
}

function buildSku(articleNo: string, hash: string) {
  return `${articleNo}-${hash}`;
}

async function createVariantOptionAssignments(
  tx: VariantTx,
  tenantId: string,
  variantId: string,
  optionValues: readonly VariantAxisValue[],
) {
  for (const optionValue of optionValues) {
    await tx
      .insert(articleVariantOptionValue)
      .values({
        tenantId,
        variantId,
        valueId: optionValue.valueId,
      })
      .onConflictDoNothing();
  }
}

async function ensureInventoryItem(
  tx: VariantTx,
  tenantId: string,
  variantId: string,
  sku: string,
) {
  const existing = await findInventoryItemByVariantId(tx, tenantId, variantId);
  if (existing) return existing;

  const [inserted] = await tx
    .insert(inventoryItem)
    .values({
      tenantId,
      variantId,
      sku,
      tracked: true,
    })
    .onConflictDoNothing()
    .returning({ itemId: inventoryItem.itemId, sku: inventoryItem.sku });

  if (inserted) return inserted;

  return await findInventoryItemByVariantId(tx, tenantId, variantId);
}

export async function generateArticleVariantsInTransaction(
  tx: VariantTx,
  tenantId: string,
  articleId: string,
): Promise<GenerateArticleVariantsResult> {
  const [articleRow] = await tx
    .select({
      articleId: article.articleId,
      articleNo: article.articleNo,
    })
    .from(article)
    .where(
      and(
        eq(article.tenantId, tenantId),
        eq(article.articleId, articleId),
        isNull(article.archivedAt),
      ),
    )
    .limit(1);

  if (!articleRow) {
    throw new Error("Article not found");
  }

  const axes = await loadVariantAxes(tx, tenantId, articleId);
  if (axes.length === 0 || axes.some((axis) => axis.values.length === 0)) {
    return {
      articleId,
      combinations: 0,
      createdVariants: 0,
      skippedVariants: 0,
    };
  }

  const combinations = cartesianProduct(axes.map((axis) => axis.values));
  let createdVariants = 0;
  let skippedVariants = 0;

  for (const combination of combinations) {
    const optionValues = combination.map((value, index) => ({
      optionName: axes[index]?.optionName ?? "",
      valueId: value.valueId,
    }));
    const optionValueHash = createArticleVariantOptionValueHash(optionValues);
    const sku = buildSku(articleRow.articleNo, optionValueHash);

    const [insertedVariant] = await tx
      .insert(articleVariant)
      .values({
        tenantId,
        articleId,
        sku,
        optionValueHash,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning({ variantId: articleVariant.variantId, sku: articleVariant.sku });

    let variantId = insertedVariant?.variantId ?? null;

    if (variantId) {
      createdVariants += 1;
    } else {
      const existingVariant = await findVariantByHash(tx, tenantId, articleId, optionValueHash);
      if (!existingVariant) {
        skippedVariants += 1;
        continue;
      }

      variantId = existingVariant.variantId;
      skippedVariants += 1;
    }

    await createVariantOptionAssignments(tx, tenantId, variantId, optionValues);
    await ensureInventoryItem(tx, tenantId, variantId, sku);
  }

  return {
    articleId,
    combinations: combinations.length,
    createdVariants,
    skippedVariants,
  };
}

export async function generateArticleVariants(
  tenantId: string,
  articleId: string,
): Promise<GenerateArticleVariantsResult> {
  return await db.transaction(async (tx) =>
    generateArticleVariantsInTransaction(tx, tenantId, articleId),
  );
}
