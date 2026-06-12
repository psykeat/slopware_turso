import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../index";
import { priceList } from "../../schema/app.schema";
import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { CapabilityError } from "../core/types";

const priceListRecordSchema = z.object({
  priceListId: z.uuid(),
  tenantId: z.uuid(),
  name: z.string(),
  currencyId: z.string().min(3).max(3),
  isNet: z.boolean(),
  archived: z.boolean(),
  createdAt: z.date(),
});

const priceListWritableFields = z.object({
  currencyId: z.string().min(3).max(3).optional(),
  isNet: z.boolean().optional(),
});

async function findPriceListByName(tenantId: string, name: string) {
  const [row] = await db
    .select({ priceListId: priceList.priceListId, archived: priceList.archived })
    .from(priceList)
    .where(and(eq(priceList.tenantId, tenantId), eq(priceList.name, name)))
    .limit(1);
  return row ?? null;
}

export const priceListList = defineCapability({
  module: "masterdata",
  entityName: "priceList",
  operation: "list",
  kind: "read",
  summary: { en: "List price lists", de: "Preislisten auflisten" },
  input: z.object({
    search: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(200).default(200),
    offset: z.number().int().min(0).default(0),
  }),
  output: z.object({ items: z.array(priceListRecordSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const rows = await new DataService(ctx.tenantId).list("priceList", {}, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
      orderBy: "name:asc",
    });
    return { items: rows as z.output<typeof priceListRecordSchema>[] };
  },
});

export const priceListGet = defineCapability({
  module: "masterdata",
  entityName: "priceList",
  operation: "get",
  kind: "read",
  summary: { en: "Get a price list by id", de: "Preisliste per ID lesen" },
  input: z.object({ priceListId: z.uuid() }),
  output: priceListRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("priceList", input.priceListId);
    if (!row) throw new CapabilityError("not_found", "Price list not found");
    return row;
  },
});

export const priceListUpsert = defineCapability({
  module: "masterdata",
  entityName: "priceList",
  operation: "upsert",
  kind: "update",
  summary: { en: "Create or update a price list by name", de: "Preisliste per Name anlegen oder ändern" },
  description: {
    en: "Name is the natural key inside a tenant: an existing price list is patched, otherwise a new one is created (currencyId required).",
    de: "Der Name ist der natürliche Schlüssel im Tenant: eine vorhandene Preisliste wird gepatcht, sonst wird neu angelegt (currencyId erforderlich).",
  },
  input: z.object({
    name: z.string().trim().min(1),
    ...priceListWritableFields.shape,
  }),
  output: z.object({ priceList: priceListRecordSchema, created: z.boolean() }),
  writesTables: ["priceList"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const service = new DataService(ctx.tenantId);
    const existing = await findPriceListByName(ctx.tenantId, input.name);

    if (existing?.archived) {
      throw new CapabilityError(
        "conflict",
        `Price list "${input.name}" exists but is archived; unarchive it first`,
      );
    }

    if (existing) {
      const { name: _name, ...patch } = input;
      if (Object.keys(patch).length === 0) {
        const row = await service.get("priceList", existing.priceListId);
        return { priceList: row, created: false };
      }
      const [updated] = await service.patch("priceList", existing.priceListId, patch);
      if (!updated) throw new CapabilityError("not_found", "Price list not found");
      return { priceList: updated, created: false };
    }

    if (!input.currencyId) {
      throw new CapabilityError("validation", "currencyId is required when creating a new price list", [
        { path: "currencyId", message: "Required when no price list with this name exists" },
      ]);
    }

    const [created] = await service.create("priceList", input);
    return { priceList: created, created: true };
  },
});

export const priceListArchive = defineCapability({
  module: "masterdata",
  entityName: "priceList",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive a price list", de: "Preisliste archivieren" },
  description: {
    en: "Soft delete: the price list is archived, never hard-deleted.",
    de: "Soft Delete: die Preisliste wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ priceListId: z.uuid() }),
  output: z.object({ priceListId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["priceList"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("priceList", input.priceListId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Price list not found");
    return { priceListId: input.priceListId, archived: true as const };
  },
});

export const priceListCapabilities = [priceListList, priceListGet, priceListUpsert, priceListArchive];
