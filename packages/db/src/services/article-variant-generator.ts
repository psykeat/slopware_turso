import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../index";
import {
  article,
  articleOption,
  articleOptionValue,
  articleVariant,
  articleVariantOptionValue,
  articleVariantTemplate,
  inventoryItem,
} from "../schema/app.schema";
import {
  createArticleVariantOptionValueHash,
  DEFAULT_VARIANT_OPTION_VALUE_HASH,
} from "./ecommerce-variant";
import {
  DEFAULT_SKU_PATTERN,
  normalizeAxisName,
  normalizeAxisValue,
  parseVariantTemplateDefinition,
  renderSkuPattern,
  type VariantTemplateExclusionRule,
} from "./variant-template-schema";

type VariantTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type VariantAxisValue = {
  optionName: string;
  valueId: string;
};

export type VariantAxis = {
  optionId: string;
  optionName: string;
  sortOrder: number;
  values: Array<{
    valueId: string;
    value: string;
    sortOrder: number;
  }>;
};

export type GenerateVariantOptions = {
  templateId?: string;
};

export type GenerateArticleVariantsResult = {
  articleId: string;
  combinations: number;
  createdVariants: number;
  createdInventoryItems: number;
  skippedVariants: number;
  excludedVariants: number;
};

export type VariantCombinationStatus = "create" | "exists" | "excluded";

export type VariantCombinationPlan = {
  optionValues: Array<{
    optionId: string;
    optionName: string;
    valueId: string;
    value: string;
  }>;
  optionValueHash: string;
  status: VariantCombinationStatus;
  excludedByRuleId?: string;
  excludedByRuleLabel?: string;
  sku?: string;
  price?: string | null;
  weight?: string | null;
};

export type PreviewArticleVariantsResult = {
  articleId: string;
  axes: Array<{
    optionId: string;
    optionName: string;
    values: Array<{ valueId: string; value: string }>;
  }>;
  combinations: VariantCombinationPlan[];
  counts: {
    total: number;
    create: number;
    exists: number;
    excluded: number;
  };
};

function cartesianProduct<T>(sets: readonly T[][]): T[][] {
  if (sets.length === 0) return [[]];

  return sets.reduce<T[][]>(
    (accumulator, set) => accumulator.flatMap((prefix) => set.map((value) => [...prefix, value])),
    [[]],
  );
}

export async function loadVariantAxes(
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
): Promise<{ itemId: string; sku: string; created: boolean } | null> {
  const existing = await findInventoryItemByVariantId(tx, tenantId, variantId);
  if (existing) return { ...existing, created: false };

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

  if (inserted) return { ...inserted, created: true };

  const row = await findInventoryItemByVariantId(tx, tenantId, variantId);
  return row ? { ...row, created: false } : null;
}

function findMatchingExclusion(
  optionValues: VariantCombinationPlan["optionValues"],
  exclusions: readonly VariantTemplateExclusionRule[],
): VariantTemplateExclusionRule | null {
  for (const rule of exclusions) {
    const whenAxis = normalizeAxisName(rule.when.axis);
    const whenValue = optionValues.find(
      (optionValue) => normalizeAxisName(optionValue.optionName) === whenAxis,
    );
    if (!whenValue || normalizeAxisValue(whenValue.value) !== normalizeAxisValue(rule.when.value)) {
      continue;
    }

    const excludeAxis = normalizeAxisName(rule.exclude.axis);
    const excludeValue = optionValues.find(
      (optionValue) => normalizeAxisName(optionValue.optionName) === excludeAxis,
    );
    if (!excludeValue) continue;

    const normalizedExcludeValue = normalizeAxisValue(excludeValue.value);
    if (rule.exclude.values.some((value) => normalizeAxisValue(value) === normalizedExcludeValue)) {
      return rule;
    }
  }

  return null;
}

export function computeVariantCombinations(args: {
  axes: readonly VariantAxis[];
  exclusions?: readonly VariantTemplateExclusionRule[];
  existingHashes: ReadonlySet<string>;
}): VariantCombinationPlan[] {
  const { axes, exclusions = [], existingHashes } = args;

  if (axes.length === 0 || axes.some((axis) => axis.values.length === 0)) {
    return [];
  }

  const combinations = cartesianProduct(
    axes.map((axis) =>
      axis.values.map((value) => ({
        optionId: axis.optionId,
        optionName: axis.optionName,
        valueId: value.valueId,
        value: value.value,
      })),
    ),
  );

  return combinations.map((optionValues) => {
    const matchedRule = findMatchingExclusion(optionValues, exclusions);
    const optionValueHash = createArticleVariantOptionValueHash(optionValues);

    if (matchedRule) {
      return {
        optionValues,
        optionValueHash,
        status: "excluded" as const,
        excludedByRuleId: matchedRule.id,
        excludedByRuleLabel: matchedRule.label,
      };
    }

    return {
      optionValues,
      optionValueHash,
      status: existingHashes.has(optionValueHash) ? ("exists" as const) : ("create" as const),
    };
  });
}

type VariantValueMeta = {
  skuCode?: string;
  priceSurcharge?: number;
  weightDelta?: number;
};

type VariantTemplateGenerationConfig = {
  exclusions: VariantTemplateExclusionRule[];
  skuPattern: string;
  valueMeta: Map<string, VariantValueMeta>;
  priceMode: "inherit" | "surchargeOnBase";
  weightMode: "inherit" | "deltaOnBase";
};

function valueMetaKey(axisName: string, value: string) {
  return `${normalizeAxisName(axisName)}|${normalizeAxisValue(value)}`;
}

async function loadTemplateGenerationConfig(
  tx: VariantTx,
  tenantId: string,
  templateId: string,
): Promise<VariantTemplateGenerationConfig> {
  const [templateRow] = await tx
    .select({
      templateId: articleVariantTemplate.templateId,
      definition: articleVariantTemplate.definition,
    })
    .from(articleVariantTemplate)
    .where(
      and(
        eq(articleVariantTemplate.tenantId, tenantId),
        eq(articleVariantTemplate.templateId, templateId),
      ),
    )
    .limit(1);

  if (!templateRow) {
    throw new Error("Variant template not found");
  }

  const parsed = parseVariantTemplateDefinition(templateRow.definition);
  if (!parsed.ok) {
    throw new Error(`Invalid variant template definition: ${parsed.errors.join("; ")}`);
  }

  const valueMeta = new Map<string, VariantValueMeta>();
  for (const axis of parsed.definition.axes) {
    for (const axisValue of axis.values) {
      valueMeta.set(valueMetaKey(axis.name, axisValue.value), {
        skuCode: axisValue.skuCode,
        priceSurcharge: axisValue.priceSurcharge,
        weightDelta: axisValue.weightDelta,
      });
    }
  }

  return {
    exclusions: parsed.definition.exclusions ?? [],
    skuPattern: parsed.definition.skuPattern ?? DEFAULT_SKU_PATTERN,
    valueMeta,
    priceMode: parsed.definition.defaults?.priceMode ?? "inherit",
    weightMode: parsed.definition.defaults?.weightMode ?? "inherit",
  };
}

type VariantPlanContext = {
  articleRow: { articleId: string; articleNo: string };
  axes: VariantAxis[];
  template: VariantTemplateGenerationConfig | null;
  existingHashes: Set<string>;
  basePrice: string | null;
  baseWeight: string | null;
};

async function loadVariantPlanContext(
  tx: VariantTx,
  tenantId: string,
  articleId: string,
  options?: GenerateVariantOptions,
): Promise<VariantPlanContext> {
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

  const template = options?.templateId
    ? await loadTemplateGenerationConfig(tx, tenantId, options.templateId)
    : null;

  const existingHashRows = await tx
    .select({ optionValueHash: articleVariant.optionValueHash })
    .from(articleVariant)
    .where(and(eq(articleVariant.tenantId, tenantId), eq(articleVariant.articleId, articleId)));

  const existingHashes = new Set(existingHashRows.map((row) => row.optionValueHash));

  let basePrice: string | null = null;
  let baseWeight: string | null = null;

  if (template) {
    const [defaultVariant] = await tx
      .select({
        price: articleVariant.price,
        weight: articleVariant.weight,
      })
      .from(articleVariant)
      .where(
        and(
          eq(articleVariant.tenantId, tenantId),
          eq(articleVariant.articleId, articleId),
          eq(articleVariant.optionValueHash, DEFAULT_VARIANT_OPTION_VALUE_HASH),
        ),
      )
      .limit(1);

    basePrice = defaultVariant?.price ?? null;
    baseWeight = defaultVariant?.weight ?? null;
  }

  return { articleRow, axes, template, existingHashes, basePrice, baseWeight };
}

function applyNumericDeltas(base: string | null, deltas: readonly number[]): string | null {
  if (base === null) return null;

  const baseNumber = Number(base);
  if (!Number.isFinite(baseNumber)) return null;

  const total = deltas.reduce((sum, delta) => sum + delta, baseNumber);
  return String(Math.round(total * 10000) / 10000);
}

async function resolveCreateSkus(
  tx: VariantTx,
  tenantId: string,
  plans: VariantCombinationPlan[],
  context: VariantPlanContext,
): Promise<void> {
  const createPlans = plans.filter((plan) => plan.status === "create");
  if (createPlans.length === 0) return;

  const { articleRow, template } = context;

  if (!template) {
    for (const plan of createPlans) {
      plan.sku = buildSku(articleRow.articleNo, plan.optionValueHash);
    }
    return;
  }

  const candidatesByHash = new Map<string, string[]>();
  const allCandidates: string[] = [];

  for (const plan of createPlans) {
    const baseSku = renderSkuPattern(template.skuPattern, {
      articleNo: articleRow.articleNo,
      hash: plan.optionValueHash,
      axisValues: plan.optionValues.map((optionValue) => ({
        axisName: optionValue.optionName,
        value: optionValue.value,
        skuCode: template.valueMeta.get(valueMetaKey(optionValue.optionName, optionValue.value))
          ?.skuCode,
      })),
    });

    const candidates = [
      baseSku,
      `${baseSku}-${plan.optionValueHash.slice(0, 8)}`,
      buildSku(articleRow.articleNo, plan.optionValueHash),
    ];
    candidatesByHash.set(plan.optionValueHash, candidates);
    allCandidates.push(...candidates);
  }

  // SKU uniqueness is tenant-wide (variants and inventory items), so rendered
  // patterns can collide with other articles. Check all candidates up front;
  // .onConflictDoNothing() in the insert path would silently swallow a
  // collision as a skipped variant otherwise.
  const taken = new Set<string>();

  const variantSkuRows = await tx
    .select({ sku: articleVariant.sku })
    .from(articleVariant)
    .where(and(eq(articleVariant.tenantId, tenantId), inArray(articleVariant.sku, allCandidates)));
  for (const row of variantSkuRows) taken.add(row.sku);

  const inventorySkuRows = await tx
    .select({ sku: inventoryItem.sku })
    .from(inventoryItem)
    .where(and(eq(inventoryItem.tenantId, tenantId), inArray(inventoryItem.sku, allCandidates)));
  for (const row of inventorySkuRows) taken.add(row.sku);

  for (const plan of createPlans) {
    const candidates = candidatesByHash.get(plan.optionValueHash) ?? [];
    const sku = candidates.find((candidate) => !taken.has(candidate)) ?? candidates.at(-1);
    if (!sku) continue;
    plan.sku = sku;
    taken.add(sku);
  }
}

function applyTemplatePricing(plans: VariantCombinationPlan[], context: VariantPlanContext): void {
  const { template } = context;
  if (!template) return;

  for (const plan of plans) {
    if (plan.status !== "create") continue;

    const metas = plan.optionValues.map(
      (optionValue) =>
        template.valueMeta.get(valueMetaKey(optionValue.optionName, optionValue.value)) ?? {},
    );

    if (template.priceMode === "surchargeOnBase") {
      plan.price = applyNumericDeltas(
        context.basePrice,
        metas.map((meta) => meta.priceSurcharge ?? 0),
      );
    }

    if (template.weightMode === "deltaOnBase") {
      plan.weight = applyNumericDeltas(
        context.baseWeight,
        metas.map((meta) => meta.weightDelta ?? 0),
      );
    }
  }
}

async function buildVariantCombinationPlans(
  tx: VariantTx,
  tenantId: string,
  context: VariantPlanContext,
): Promise<VariantCombinationPlan[]> {
  const plans = computeVariantCombinations({
    axes: context.axes,
    exclusions: context.template?.exclusions,
    existingHashes: context.existingHashes,
  });

  await resolveCreateSkus(tx, tenantId, plans, context);
  applyTemplatePricing(plans, context);

  return plans;
}

export async function generateArticleVariantsInTransaction(
  tx: VariantTx,
  tenantId: string,
  articleId: string,
  options?: GenerateVariantOptions,
): Promise<GenerateArticleVariantsResult> {
  const context = await loadVariantPlanContext(tx, tenantId, articleId, options);
  const plans = await buildVariantCombinationPlans(tx, tenantId, context);

  let createdVariants = 0;
  let createdInventoryItems = 0;
  let skippedVariants = 0;
  let excludedVariants = 0;

  for (const plan of plans) {
    if (plan.status === "excluded") {
      excludedVariants += 1;
      continue;
    }

    let variantId: string | null = null;
    let inventorySku = plan.sku ?? buildSku(context.articleRow.articleNo, plan.optionValueHash);

    if (plan.status === "create" && plan.sku) {
      const [insertedVariant] = await tx
        .insert(articleVariant)
        .values({
          tenantId,
          articleId,
          sku: plan.sku,
          optionValueHash: plan.optionValueHash,
          price: plan.price ?? null,
          weight: plan.weight ?? null,
          isActive: true,
        })
        .onConflictDoNothing()
        .returning({ variantId: articleVariant.variantId });

      variantId = insertedVariant?.variantId ?? null;
    }

    if (variantId) {
      createdVariants += 1;
    } else {
      const existingVariant = await findVariantByHash(
        tx,
        tenantId,
        articleId,
        plan.optionValueHash,
      );
      if (!existingVariant) {
        skippedVariants += 1;
        continue;
      }

      variantId = existingVariant.variantId;
      inventorySku = existingVariant.sku;
      skippedVariants += 1;
    }

    await createVariantOptionAssignments(tx, tenantId, variantId, plan.optionValues);
    const inventoryItemRow = await ensureInventoryItem(tx, tenantId, variantId, inventorySku);
    if (inventoryItemRow?.created) {
      createdInventoryItems += 1;
    }
  }

  return {
    articleId,
    combinations: plans.length,
    createdVariants,
    createdInventoryItems,
    skippedVariants,
    excludedVariants,
  };
}

export async function generateArticleVariants(
  tenantId: string,
  articleId: string,
  options?: GenerateVariantOptions,
): Promise<GenerateArticleVariantsResult> {
  return await db.transaction(async (tx) =>
    generateArticleVariantsInTransaction(tx, tenantId, articleId, options),
  );
}

export async function previewArticleVariants(
  tenantId: string,
  articleId: string,
  options?: GenerateVariantOptions,
): Promise<PreviewArticleVariantsResult> {
  return await db.transaction(async (tx) => {
    const context = await loadVariantPlanContext(tx, tenantId, articleId, options);
    const plans = await buildVariantCombinationPlans(tx, tenantId, context);

    return {
      articleId,
      axes: context.axes.map((axis) => ({
        optionId: axis.optionId,
        optionName: axis.optionName,
        values: axis.values.map((value) => ({ valueId: value.valueId, value: value.value })),
      })),
      combinations: plans,
      counts: {
        total: plans.length,
        create: plans.filter((plan) => plan.status === "create").length,
        exists: plans.filter((plan) => plan.status === "exists").length,
        excluded: plans.filter((plan) => plan.status === "excluded").length,
      },
    };
  });
}

export type ArchiveArticleVariantsResult = {
  archivedVariants: number;
};

export async function archiveArticleVariantsInTransaction(
  tx: VariantTx,
  tenantId: string,
  articleId: string,
  variantIds?: string[],
): Promise<ArchiveArticleVariantsResult> {
  const baseCondition = and(
    eq(articleVariant.tenantId, tenantId),
    eq(articleVariant.articleId, articleId),
  );

  const whereCondition =
    variantIds && variantIds.length > 0
      ? and(baseCondition, inArray(articleVariant.variantId, variantIds))
      : baseCondition;

  const updatedVariants = await tx
    .update(articleVariant)
    .set({ isActive: false })
    .where(whereCondition)
    .returning({ variantId: articleVariant.variantId });

  const updatedVariantIds = updatedVariants.map((v) => v.variantId);

  if (updatedVariantIds.length > 0) {
    await tx
      .update(inventoryItem)
      .set({ tracked: false })
      .where(
        and(
          eq(inventoryItem.tenantId, tenantId),
          inArray(inventoryItem.variantId, updatedVariantIds),
        ),
      );
  }

  return { archivedVariants: updatedVariants.length };
}

export async function archiveArticleVariants(
  tenantId: string,
  articleId: string,
  variantIds?: string[],
): Promise<ArchiveArticleVariantsResult> {
  return await db.transaction(async (tx) =>
    archiveArticleVariantsInTransaction(tx, tenantId, articleId, variantIds),
  );
}
