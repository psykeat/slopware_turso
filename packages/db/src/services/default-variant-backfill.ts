import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "../index";
import { article, articleVariant, inventoryItem } from "../schema/app.schema";
import { createArticleVariantOptionValueHash } from "./ecommerce-variant";

type BackfillTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CandidateArticle = {
  articleId: string;
  articleNo: string;
  tenantId: string;
};

export type DefaultVariantBackfillResult = {
  candidateArticles: number;
  createdVariants: number;
  createdInventoryItems: number;
  skippedArticles: number;
};

const DEFAULT_VARIANT_OPTION_VALUE_HASH = createArticleVariantOptionValueHash([]);

async function findInventoryItemByVariantId(tx: BackfillTx, tenantId: string, variantId: string) {
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

async function ensureInventoryItem(
  tx: BackfillTx,
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
    .returning({
      itemId: inventoryItem.itemId,
      sku: inventoryItem.sku,
    });

  if (inserted) return inserted;

  return await findInventoryItemByVariantId(tx, tenantId, variantId);
}

export async function ensureDefaultVariantForArticle(
  tx: BackfillTx,
  candidate: CandidateArticle,
) {
  const [existingVariant] = await tx
    .select({
      variantId: articleVariant.variantId,
    })
    .from(articleVariant)
    .where(
      and(
        eq(articleVariant.tenantId, candidate.tenantId),
        eq(articleVariant.articleId, candidate.articleId),
      ),
    )
    .limit(1);

  if (existingVariant) {
    return {
      createdVariant: false,
      createdInventoryItem: false,
    };
  }

  const sku = `${candidate.articleNo}-${DEFAULT_VARIANT_OPTION_VALUE_HASH}`;
  const [insertedVariant] = await tx
    .insert(articleVariant)
    .values({
      tenantId: candidate.tenantId,
      articleId: candidate.articleId,
      sku,
      optionValueHash: DEFAULT_VARIANT_OPTION_VALUE_HASH,
      isActive: true,
    })
    .onConflictDoNothing()
    .returning({
      variantId: articleVariant.variantId,
    });

  let variantId = insertedVariant?.variantId ?? null;
  let createdVariant = Boolean(insertedVariant);

  if (!variantId) {
    const [existingDefaultVariant] = await tx
      .select({
        variantId: articleVariant.variantId,
      })
      .from(articleVariant)
      .where(
        and(
          eq(articleVariant.tenantId, candidate.tenantId),
          eq(articleVariant.articleId, candidate.articleId),
          eq(articleVariant.optionValueHash, DEFAULT_VARIANT_OPTION_VALUE_HASH),
        ),
      )
      .limit(1);

    if (!existingDefaultVariant) {
      return {
        createdVariant: false,
        createdInventoryItem: false,
      };
    }

    variantId = existingDefaultVariant.variantId;
    createdVariant = false;
  }

  const existingInventoryItem = await findInventoryItemByVariantId(
    tx,
    candidate.tenantId,
    variantId,
  );
  const inventoryItemRow = await ensureInventoryItem(tx, candidate.tenantId, variantId, sku);

  return {
    createdVariant,
    createdInventoryItem: !existingInventoryItem && Boolean(inventoryItemRow),
  };
}

export async function ensureDefaultVariantForArticleRow(
  tx: BackfillTx,
  articleRow: CandidateArticle,
) {
  return await ensureDefaultVariantForArticle(tx, articleRow);
}

export async function backfillDefaultArticleVariants(
  tenantId?: string,
): Promise<DefaultVariantBackfillResult> {
  const candidates = tenantId
    ? await db
        .select({
          articleId: article.articleId,
          articleNo: article.articleNo,
          tenantId: article.tenantId,
        })
        .from(article)
        .leftJoin(
          articleVariant,
          and(
            eq(articleVariant.tenantId, article.tenantId),
            eq(articleVariant.articleId, article.articleId),
          ),
        )
        .where(and(isNull(articleVariant.variantId), eq(article.tenantId, tenantId)))
        .orderBy(asc(article.articleNo), asc(article.articleId))
    : await db
        .select({
          articleId: article.articleId,
          articleNo: article.articleNo,
          tenantId: article.tenantId,
        })
        .from(article)
        .leftJoin(
          articleVariant,
          and(
            eq(articleVariant.tenantId, article.tenantId),
            eq(articleVariant.articleId, article.articleId),
          ),
        )
        .where(isNull(articleVariant.variantId))
        .orderBy(asc(article.tenantId), asc(article.articleNo), asc(article.articleId));

  const result: DefaultVariantBackfillResult = {
    candidateArticles: candidates.length,
    createdVariants: 0,
    createdInventoryItems: 0,
    skippedArticles: 0,
  };

  for (const candidate of candidates) {
    const articleResult = await db.transaction(async (tx) =>
      ensureDefaultVariantForArticle(tx, candidate),
    );

    if (articleResult.createdVariant) {
      result.createdVariants += 1;
    }

    if (articleResult.createdInventoryItem) {
      result.createdInventoryItems += 1;
    }

    if (!articleResult.createdVariant && !articleResult.createdInventoryItem) {
      result.skippedArticles += 1;
    }
  }

  return result;
}
