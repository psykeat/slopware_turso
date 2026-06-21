import { and, asc } from "drizzle-orm";
import { z } from "zod";

import { db, eq } from "../../index";
import { articleOptionValue, articleVariantOptionValue } from "../../schema/sqlite.schema";
import { defineCapability } from "../core/define";
import { CapabilityError } from "../core/types";

const variantOptionValueRecordSchema = z.looseObject({
  variantId: z.uuid(),
  valueId: z.uuid(),
  optionId: z.uuid(),
  value: z.string(),
});

const variantOptionValueFilterSchema = z.object({
  variantId: z.uuid().optional(),
  valueId: z.uuid().optional(),
  optionId: z.uuid().optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

async function loadVariantOptionValueRows(
  filters: z.output<typeof variantOptionValueFilterSchema>,
) {
  const conditions = [];
  if (filters.variantId)
    conditions.push(eq(articleVariantOptionValue.variantId, filters.variantId));
  if (filters.valueId) conditions.push(eq(articleVariantOptionValue.valueId, filters.valueId));
  if (filters.optionId) conditions.push(eq(articleOptionValue.optionId, filters.optionId));

  const rows = await db
    .select({
      variantId: articleVariantOptionValue.variantId,
      valueId: articleVariantOptionValue.valueId,
      optionId: articleOptionValue.optionId,
      value: articleOptionValue.value,
    })
    .from(articleVariantOptionValue)
    .innerJoin(
      articleOptionValue,
      eq(articleVariantOptionValue.valueId, articleOptionValue.valueId),
    )
    .where(and(...conditions))
    .orderBy(asc(articleVariantOptionValue.variantId), asc(articleOptionValue.sortOrder));

  if (filters.search?.trim()) {
    const term = filters.search.trim().toLowerCase();
    const filtered = rows.filter((row) =>
      [row.value, row.optionId].some((part) => String(part).toLowerCase().includes(term)),
    );
    const start = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    return filtered.slice(start, start + limit);
  }

  const start = filters.offset ?? 0;
  const limit = filters.limit ?? 50;
  return rows.slice(start, start + limit);
}

export const articleVariantOptionValueList = defineCapability({
  module: "masterdata",
  entityName: "articleVariantOptionValue",
  operation: "list",
  kind: "read",
  summary: { en: "List variant option assignments", de: "Varianten-Optionszuweisungen auflisten" },
  input: variantOptionValueFilterSchema,
  output: z.object({ items: z.array(variantOptionValueRecordSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (_ctx, input) => ({ items: await loadVariantOptionValueRows(input) }),
});

export const articleVariantOptionValueGet = defineCapability({
  module: "masterdata",
  entityName: "articleVariantOptionValue",
  operation: "get",
  kind: "read",
  summary: { en: "Get a variant option assignment", de: "Varianten-Optionszuweisung lesen" },
  input: z.object({
    variantId: z.uuid(),
    valueId: z.uuid(),
  }),
  output: variantOptionValueRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (_ctx, input) => {
    const rows = await loadVariantOptionValueRows({
      variantId: input.variantId,
      valueId: input.valueId,
      limit: 1,
      offset: 0,
    });
    const [row] = rows;
    if (!row) throw new CapabilityError("not_found", "Variant option assignment not found");
    return row;
  },
});

export const articleVariantOptionValueCreate = defineCapability({
  module: "masterdata",
  entityName: "articleVariantOptionValue",
  operation: "create",
  kind: "create",
  summary: { en: "Link an option value to a variant", de: "Optionswert einer Variante zuordnen" },
  input: z.object({
    variantId: z.uuid(),
    valueId: z.uuid(),
  }),
  output: variantOptionValueRecordSchema,
  writesTables: ["articleVariantOptionValue"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (_ctx, input) => {
    const [created] = await db
      .insert(articleVariantOptionValue)
      .values({
        variantId: input.variantId,
        valueId: input.valueId,
      })
      .returning({
        variantId: articleVariantOptionValue.variantId,
        valueId: articleVariantOptionValue.valueId,
      });

    if (!created) throw new Error("Failed to link variant option value");

    const rows = await loadVariantOptionValueRows({
      variantId: input.variantId,
      valueId: input.valueId,
      limit: 1,
      offset: 0,
    });
    const [row] = rows;
    if (!row) throw new Error("Failed to load linked variant option value");
    return row;
  },
});

export const articleVariantOptionValueDelete = defineCapability({
  module: "masterdata",
  entityName: "articleVariantOptionValue",
  operation: "delete",
  kind: "process",
  summary: { en: "Unlink an option value from a variant", de: "Optionswert von Variante lösen" },
  input: z.object({
    variantId: z.uuid(),
    valueId: z.uuid(),
  }),
  output: z.object({ deleted: z.literal(true) }),
  writesTables: ["articleVariantOptionValue"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (_ctx, input) => {
    const deleted = await db
      .delete(articleVariantOptionValue)
      .where(
        and(
          eq(articleVariantOptionValue.variantId, input.variantId),
          eq(articleVariantOptionValue.valueId, input.valueId),
        ),
      )
      .returning({ variantId: articleVariantOptionValue.variantId });

    if (deleted.length === 0)
      throw new CapabilityError("not_found", "Variant option assignment not found");
    return { deleted: true as const };
  },
});

export const articleVariantOptionValueCapabilities = [
  articleVariantOptionValueList,
  articleVariantOptionValueGet,
  articleVariantOptionValueCreate,
  articleVariantOptionValueDelete,
];
