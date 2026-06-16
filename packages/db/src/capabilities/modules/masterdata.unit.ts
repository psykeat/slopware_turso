import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../index";
import { unit } from "../../schema/app.schema";
import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { listControlsSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

const localizedTextSchema = z.record(z.string(), z.string());

const unitRecordSchema = z.object({
  unitId: z.uuid(),
  code: z.string(),
  name: localizedTextSchema,
  archived: z.boolean(),
  createdAt: z.date(),
  customAttributes: z.record(z.string(), z.unknown()).nullable(),
});

const unitWritableFields = z.object({
  name: localizedTextSchema.optional(),
  customAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
});

async function findUnitByCode(tenantId: string, code: string) {
  const [row] = await db
    .select({ unitId: unit.unitId, archived: unit.archived })
    .from(unit)
    .where(and(eq(unit.tenantId, tenantId), eq(unit.code, code)))
    .limit(1);
  return row ?? null;
}

export const unitList = defineCapability({
  module: "masterdata",
  entityName: "unit",
  operation: "list",
  kind: "read",
  summary: {
    en: "List units",
    de: "Einheiten auflisten",
  },
  input: z.object({ ...listControlsSchema }),
  output: z.object({ items: z.array(unitRecordSchema), total: z.number().int().optional() }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => runEntityList(ctx.tenantId, "unit", {}, input, "code:asc"),
});

export const unitGet = defineCapability({
  module: "masterdata",
  entityName: "unit",
  operation: "get",
  kind: "read",
  summary: {
    en: "Get a unit by id",
    de: "Einheit per ID lesen",
  },
  input: z.object({ unitId: z.uuid() }),
  output: unitRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("unit", input.unitId);
    if (!row) {
      throw new CapabilityError("not_found", "Unit not found");
    }
    return row;
  },
});

export const unitUpsert = defineCapability({
  module: "masterdata",
  entityName: "unit",
  operation: "upsert",
  kind: "update",
  summary: {
    en: "Create or update a unit by code",
    de: "Einheit per Code anlegen oder ändern",
  },
  description: {
    en: "Code is the natural key: an existing active unit is patched, otherwise a new one is created (name required). Safe to retry.",
    de: "Code ist der natürliche Schlüssel: eine vorhandene aktive Einheit wird gepatcht, sonst wird neu angelegt (Name erforderlich). Wiederholbar ohne Doppelanlage.",
  },
  input: z.object({
    code: z.string().trim().min(1),
    ...unitWritableFields.shape,
  }),
  output: z.object({
    unit: unitRecordSchema,
    created: z.boolean(),
  }),
  writesTables: ["unit"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const service = new DataService(ctx.tenantId);
    const existing = await findUnitByCode(ctx.tenantId, input.code);

    if (existing?.archived) {
      throw new CapabilityError(
        "conflict",
        `Unit "${input.code}" exists but is archived; unarchive it first`,
      );
    }

    if (existing) {
      const { code: _code, ...patch } = input;
      if (Object.keys(patch).length === 0) {
        const row = await service.get("unit", existing.unitId);
        return { unit: row, created: false };
      }
      const [updated] = await service.patch("unit", existing.unitId, patch);
      if (!updated) {
        throw new CapabilityError("not_found", "Unit not found");
      }
      return { unit: updated, created: false };
    }

    if (!input.name) {
      throw new CapabilityError("validation", "name is required when creating a new unit", [
        { path: "name", message: "Required when no unit with this code exists" },
      ]);
    }

    const [created] = await service.create("unit", input);
    return { unit: created, created: true };
  },
});

export const unitArchive = defineCapability({
  module: "masterdata",
  entityName: "unit",
  operation: "archive",
  kind: "archive",
  summary: {
    en: "Archive a unit",
    de: "Einheit archivieren",
  },
  description: {
    en: "Soft delete: the unit is archived, never hard-deleted.",
    de: "Soft Delete: die Einheit wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ unitId: z.uuid() }),
  output: z.object({ unitId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["unit"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("unit", input.unitId, {
      archived: true,
    });
    if (!updated) {
      throw new CapabilityError("not_found", "Unit not found");
    }
    return { unitId: input.unitId, archived: true as const };
  },
});

export const unitCapabilities = [unitList, unitGet, unitUpsert, unitArchive];
