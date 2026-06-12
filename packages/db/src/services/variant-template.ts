import { and, asc, eq } from "drizzle-orm";

import { db } from "../index";
import {
  article,
  articleOption,
  articleOptionValue,
  articleVariantTemplate,
} from "../schema/app.schema";
import { loadVariantAxes } from "./article-variant-generator";
import {
  normalizeAxisName,
  normalizeAxisValue,
  parseVariantTemplateDefinition,
  type VariantTemplateDefinition,
} from "./variant-template-schema";

type VariantTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type VariantTemplateRecord = {
  templateId: string;
  slug: string;
  label: string;
  articleGroupId: string | null;
  definition: VariantTemplateDefinition;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date | null;
};

const templateSelection = {
  templateId: articleVariantTemplate.templateId,
  slug: articleVariantTemplate.slug,
  label: articleVariantTemplate.label,
  articleGroupId: articleVariantTemplate.articleGroupId,
  definition: articleVariantTemplate.definition,
  archived: articleVariantTemplate.archived,
  createdAt: articleVariantTemplate.createdAt,
  updatedAt: articleVariantTemplate.updatedAt,
};

function toTemplateRecord(row: {
  templateId: string;
  slug: string;
  label: string;
  articleGroupId: string | null;
  definition: unknown;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}): VariantTemplateRecord {
  return {
    ...row,
    definition: row.definition as VariantTemplateDefinition,
  };
}

export class VariantTemplateValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid variant template definition: ${errors.join("; ")}`);
    this.name = "VariantTemplateValidationError";
    this.errors = errors;
  }
}

function validateDefinition(definition: unknown): VariantTemplateDefinition {
  const parsed = parseVariantTemplateDefinition(definition);
  if (!parsed.ok) {
    throw new VariantTemplateValidationError(parsed.errors);
  }
  return parsed.definition;
}

export async function listVariantTemplates(
  tenantId: string,
  opts?: { includeArchived?: boolean },
): Promise<VariantTemplateRecord[]> {
  const conditions = [eq(articleVariantTemplate.tenantId, tenantId)];
  if (!opts?.includeArchived) {
    conditions.push(eq(articleVariantTemplate.archived, false));
  }

  const rows = await db
    .select(templateSelection)
    .from(articleVariantTemplate)
    .where(and(...conditions))
    .orderBy(asc(articleVariantTemplate.label), asc(articleVariantTemplate.templateId));

  return rows.map(toTemplateRecord);
}

export async function getVariantTemplate(
  tenantId: string,
  templateId: string,
): Promise<VariantTemplateRecord | null> {
  const [row] = await db
    .select(templateSelection)
    .from(articleVariantTemplate)
    .where(
      and(
        eq(articleVariantTemplate.tenantId, tenantId),
        eq(articleVariantTemplate.templateId, templateId),
      ),
    )
    .limit(1);

  return row ? toTemplateRecord(row) : null;
}

export async function createVariantTemplate(
  tenantId: string,
  input: {
    slug: string;
    label: string;
    articleGroupId?: string | null;
    definition: unknown;
  },
): Promise<VariantTemplateRecord> {
  const definition = validateDefinition(input.definition);

  const [row] = await db
    .insert(articleVariantTemplate)
    .values({
      tenantId,
      slug: input.slug.trim(),
      label: input.label.trim(),
      articleGroupId: input.articleGroupId ?? null,
      definition,
    })
    .returning(templateSelection);

  return toTemplateRecord(row);
}

export async function updateVariantTemplate(
  tenantId: string,
  templateId: string,
  patch: Partial<{
    slug: string;
    label: string;
    articleGroupId: string | null;
    definition: unknown;
    archived: boolean;
  }>,
): Promise<VariantTemplateRecord> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (patch.slug !== undefined) updates.slug = patch.slug.trim();
  if (patch.label !== undefined) updates.label = patch.label.trim();
  if (patch.articleGroupId !== undefined) updates.articleGroupId = patch.articleGroupId;
  if (patch.archived !== undefined) updates.archived = patch.archived;
  if (patch.definition !== undefined) updates.definition = validateDefinition(patch.definition);

  const [row] = await db
    .update(articleVariantTemplate)
    .set(updates)
    .where(
      and(
        eq(articleVariantTemplate.tenantId, tenantId),
        eq(articleVariantTemplate.templateId, templateId),
      ),
    )
    .returning(templateSelection);

  if (!row) {
    throw new Error("Variant template not found");
  }

  return toTemplateRecord(row);
}

export type ApplyAxesResult = {
  createdOptions: number;
  createdValues: number;
  matchedOptions: number;
  matchedValues: number;
};

type AxisInput = {
  name: string;
  sortOrder: number;
  values: Array<{ value: string; sortOrder: number }>;
};

async function assertArticleExists(tx: VariantTx, tenantId: string, articleId: string) {
  const [row] = await tx
    .select({ articleId: article.articleId })
    .from(article)
    .where(and(eq(article.tenantId, tenantId), eq(article.articleId, articleId)))
    .limit(1);

  if (!row) {
    throw new Error("Article not found");
  }
}

// Merge-only: existing options/values are matched (case-insensitive) and kept;
// nothing is ever deleted or archived here.
async function mergeAxesIntoArticle(
  tx: VariantTx,
  tenantId: string,
  articleId: string,
  axes: readonly AxisInput[],
): Promise<ApplyAxesResult> {
  const result: ApplyAxesResult = {
    createdOptions: 0,
    createdValues: 0,
    matchedOptions: 0,
    matchedValues: 0,
  };

  const existingOptions = await tx
    .select({
      optionId: articleOption.optionId,
      name: articleOption.name,
      sortOrder: articleOption.sortOrder,
    })
    .from(articleOption)
    .where(and(eq(articleOption.tenantId, tenantId), eq(articleOption.articleId, articleId)));

  const optionsByNormalizedName = new Map(
    existingOptions.map((option) => [normalizeAxisName(option.name), option]),
  );

  for (const axis of axes) {
    const normalizedName = normalizeAxisName(axis.name);
    let option = optionsByNormalizedName.get(normalizedName);

    if (option) {
      result.matchedOptions += 1;
      if (option.sortOrder !== axis.sortOrder) {
        await tx
          .update(articleOption)
          .set({ sortOrder: axis.sortOrder })
          .where(
            and(eq(articleOption.tenantId, tenantId), eq(articleOption.optionId, option.optionId)),
          );
      }
    } else {
      const [inserted] = await tx
        .insert(articleOption)
        .values({
          tenantId,
          articleId,
          name: axis.name.trim(),
          sortOrder: axis.sortOrder,
        })
        .onConflictDoNothing()
        .returning({
          optionId: articleOption.optionId,
          name: articleOption.name,
          sortOrder: articleOption.sortOrder,
        });

      if (inserted) {
        result.createdOptions += 1;
        option = inserted;
      } else {
        // Lost a race against a concurrent insert; re-read and treat as match.
        const [existing] = await tx
          .select({
            optionId: articleOption.optionId,
            name: articleOption.name,
            sortOrder: articleOption.sortOrder,
          })
          .from(articleOption)
          .where(
            and(
              eq(articleOption.tenantId, tenantId),
              eq(articleOption.articleId, articleId),
              eq(articleOption.name, axis.name.trim()),
            ),
          )
          .limit(1);
        if (!existing) continue;
        result.matchedOptions += 1;
        option = existing;
      }
      optionsByNormalizedName.set(normalizedName, option);
    }

    const existingValues = await tx
      .select({
        valueId: articleOptionValue.valueId,
        value: articleOptionValue.value,
        sortOrder: articleOptionValue.sortOrder,
      })
      .from(articleOptionValue)
      .where(
        and(
          eq(articleOptionValue.tenantId, tenantId),
          eq(articleOptionValue.optionId, option.optionId),
        ),
      );

    const valuesByNormalizedValue = new Map(
      existingValues.map((value) => [normalizeAxisValue(value.value), value]),
    );

    for (const axisValue of axis.values) {
      const normalizedValue = normalizeAxisValue(axisValue.value);
      const existingValue = valuesByNormalizedValue.get(normalizedValue);

      if (existingValue) {
        result.matchedValues += 1;
        if (existingValue.sortOrder !== axisValue.sortOrder) {
          await tx
            .update(articleOptionValue)
            .set({ sortOrder: axisValue.sortOrder })
            .where(
              and(
                eq(articleOptionValue.tenantId, tenantId),
                eq(articleOptionValue.valueId, existingValue.valueId),
              ),
            );
        }
        continue;
      }

      const [insertedValue] = await tx
        .insert(articleOptionValue)
        .values({
          tenantId,
          optionId: option.optionId,
          value: axisValue.value.trim(),
          sortOrder: axisValue.sortOrder,
        })
        .onConflictDoNothing()
        .returning({
          valueId: articleOptionValue.valueId,
          value: articleOptionValue.value,
          sortOrder: articleOptionValue.sortOrder,
        });

      if (insertedValue) {
        result.createdValues += 1;
        valuesByNormalizedValue.set(normalizedValue, insertedValue);
      } else {
        result.matchedValues += 1;
      }
    }
  }

  return result;
}

export async function applyVariantTemplateToArticle(
  tenantId: string,
  articleId: string,
  templateId: string,
): Promise<ApplyAxesResult> {
  const template = await getVariantTemplate(tenantId, templateId);
  if (!template) {
    throw new Error("Variant template not found");
  }
  if (template.archived) {
    throw new Error("Variant template is archived");
  }

  const definition = validateDefinition(template.definition);

  return await db.transaction(async (tx) => {
    await assertArticleExists(tx, tenantId, articleId);
    return await mergeAxesIntoArticle(tx, tenantId, articleId, definition.axes);
  });
}

export async function copyVariantAxesFromArticle(
  tenantId: string,
  targetArticleId: string,
  sourceArticleId: string,
): Promise<ApplyAxesResult> {
  if (targetArticleId === sourceArticleId) {
    throw new Error("Source and target article must differ");
  }

  return await db.transaction(async (tx) => {
    await assertArticleExists(tx, tenantId, targetArticleId);
    await assertArticleExists(tx, tenantId, sourceArticleId);

    const sourceAxes = await loadVariantAxes(tx, tenantId, sourceArticleId);
    const axes: AxisInput[] = sourceAxes.map((axis) => ({
      name: axis.optionName,
      sortOrder: axis.sortOrder,
      values: axis.values.map((value) => ({
        value: value.value,
        sortOrder: value.sortOrder,
      })),
    }));

    return await mergeAxesIntoArticle(tx, tenantId, targetArticleId, axes);
  });
}
