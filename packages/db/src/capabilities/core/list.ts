import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "./define";
import type { CapabilityModule, CapabilityRole, LocalizedText } from "./types";

// Shared list contract for capability `list` ops. It mirrors what the legacy
// introspective `/api/data` route offered so sortable/paginated/filterable grids
// can run on the capability runtime: FK filters, free-text search, structured
// filterRules, dynamic orderBy and offset pagination. When `withTotal` is set
// the result carries the matching `total` (an extra COUNT query), so grids can
// render page counts. All of it delegates to DataService.list, which already
// implements these — no business logic added here.

export const looseRowSchema = z.looseObject({});

export const filterRuleSchema = z.object({
  col: z.string(),
  op: z.string(),
  val: z.string(),
});

// The pagination/sort/filter knobs every list cap accepts, on top of its own
// filter fields (wrapped `{ filters }` for factory caps, flat FK fields for
// hand-written ones).
export const listControlsSchema = {
  search: z.string().trim().min(1).optional(),
  orderBy: z.string().optional(),
  filterRules: z.array(filterRuleSchema).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
  withTotal: z.boolean().optional(),
} as const;

// Wrapped-filters input used by the CRUD factories (crud/makeCrud/
// makeSystemEntityCapabilities/readOnly).
export const listInputSchema = z.object({
  filters: z.record(z.string(), z.string()).default({}),
  ...listControlsSchema,
});

export const listOutputSchema = z.object({
  items: z.array(looseRowSchema),
  total: z.number().int().optional(),
});

export interface ListControls {
  search?: string;
  orderBy?: string;
  filterRules?: Array<{ col: string; op: string; val: string }>;
  limit?: number;
  offset?: number;
  withTotal?: boolean;
}

// Runs DataService.list with the shared controls. `defaultOrderBy` is the
// per-entity fallback sort applied when the caller doesn't request one.
export async function runEntityList(
  tenantId: string,
  tableName: string,
  filters: Record<string, string>,
  controls: ListControls,
  defaultOrderBy: string,
): Promise<{ items: unknown[]; total?: number }> {
  const result = await new DataService(tenantId).list(tableName, filters, {
    search: controls.search,
    limit: controls.limit,
    offset: controls.offset,
    orderBy: controls.orderBy ?? defaultOrderBy,
    filterRules: controls.filterRules,
    count: controls.withTotal,
  });
  if (controls.withTotal) {
    const { data, total } = result as { data: unknown[]; total: number };
    return { items: data, total };
  }
  return { items: result as unknown[] };
}

// Factory for the common flat-filter list capability shape: a handful of
// natural-key/FK filter fields plus the standard list controls, delegating
// straight to runEntityList. Covers every masterdata list capability that
// isn't using the wrapped-filters CRUD factory (crud() in
// masterdata.remaining.ts, which has a different input contract and is out
// of scope here).
export function defineListCapability<
  R extends z.ZodType,
  M extends CapabilityModule,
  E extends string,
  F extends z.ZodRawShape = Record<string, never>,
>(config: {
  module: M;
  entityName: E;
  /** Defaults to entityName. */
  tableName?: string;
  summary: LocalizedText;
  description?: LocalizedText;
  recordSchema: R;
  /** Flat natural-key/FK filter fields, merged before the standard list controls. */
  extraFilters?: F;
  defaultOrderBy: string;
  /** Overrides listControlsSchema's default of 50. */
  defaultLimit?: number;
  minRole?: CapabilityRole;
}) {
  const tableName = config.tableName ?? config.entityName;
  const filterKeys = Object.keys(config.extraFilters ?? {});

  return defineCapability({
    module: config.module,
    entityName: config.entityName,
    operation: "list",
    kind: "read",
    summary: config.summary,
    description: config.description,
    input: z.object({
      ...((config.extraFilters ?? {}) as F),
      ...listControlsSchema,
      ...(config.defaultLimit
        ? { limit: z.number().int().min(1).max(200).default(config.defaultLimit) }
        : {}),
    }),
    output: z.object({ items: z.array(config.recordSchema), total: z.number().int().optional() }),
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: config.minRole ?? "tenant_user",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const raw = input as Record<string, string | number | boolean | undefined | null>;
      const filters: Record<string, string> = {};
      for (const key of filterKeys) {
        const value = raw[key];
        if (value !== undefined && value !== null && value !== "") filters[key] = String(value);
      }
      return runEntityList(ctx.tenantId, tableName, filters, input as ListControls, config.defaultOrderBy);
    },
  });
}
