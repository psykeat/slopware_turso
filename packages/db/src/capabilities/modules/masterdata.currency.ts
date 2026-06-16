import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../index";
import { currency } from "../../schema/app.schema";
import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { defineListCapability } from "../core/list";
import { CapabilityError } from "../core/types";

const localizedTextSchema = z.record(z.string(), z.string());

const currencyRecordSchema = z.object({
  currencyId: z.uuid(),
  code: z.string().min(3).max(3),
  name: localizedTextSchema,
  symbol: z.string().max(5).nullable(),
  decimals: z.number().int(),
  archived: z.boolean(),
  createdAt: z.date(),
});

const currencyWritableFields = z.object({
  name: localizedTextSchema.optional(),
  symbol: z.string().max(5).nullable().optional(),
  decimals: z.number().int().min(0).max(6).optional(),
});

async function findCurrencyByCode(code: string) {
  const [row] = await db
    .select({ currencyId: currency.currencyId, archived: currency.archived })
    .from(currency)
    .where(eq(currency.code, code))
    .limit(1);
  return row ?? null;
}

export const currencyList = defineListCapability({
  module: "masterdata",
  entityName: "currency",
  summary: { en: "List currencies", de: "Währungen auflisten" },
  recordSchema: currencyRecordSchema,
  extraFilters: { code: z.string().optional() },
  defaultOrderBy: "code:asc",
  defaultLimit: 200,
});

export const currencyGet = defineCapability({
  module: "masterdata",
  entityName: "currency",
  operation: "get",
  kind: "read",
  summary: { en: "Get a currency by id", de: "Währung per ID lesen" },
  input: z.object({ currencyId: z.uuid() }),
  output: currencyRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("currency", input.currencyId);
    if (!row) throw new CapabilityError("not_found", "Currency not found");
    return row;
  },
});

export const currencyUpsert = defineCapability({
  module: "masterdata",
  entityName: "currency",
  operation: "upsert",
  kind: "update",
  summary: { en: "Create or update a currency by code", de: "Währung per Code anlegen oder ändern" },
  description: {
    en: "Code is the natural key: an existing currency is patched, otherwise a new one is created (name required).",
    de: "Der Code ist der natürliche Schlüssel: eine vorhandene Währung wird gepatcht, sonst wird neu angelegt (Name erforderlich).",
  },
  input: z.object({
    ...currencyWritableFields.shape,
    code: z.string().trim().min(3).max(3),
    name: localizedTextSchema,
  }),
  output: z.object({ currency: currencyRecordSchema, created: z.boolean() }),
  writesTables: ["currency"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const service = new DataService(ctx.tenantId);
    const existing = await findCurrencyByCode(input.code);

    if (existing?.archived) {
      throw new CapabilityError(
        "conflict",
        `Currency "${input.code}" exists but is archived; unarchive it first`,
      );
    }

    if (existing) {
      const { code: _code, ...patch } = input;
      if (Object.keys(patch).length === 0) {
        const row = await service.get("currency", existing.currencyId);
        return { currency: row, created: false };
      }
      const [updated] = await service.patch("currency", existing.currencyId, patch);
      if (!updated) throw new CapabilityError("not_found", "Currency not found");
      return { currency: updated, created: false };
    }

    const [created] = await service.create("currency", input);
    return { currency: created, created: true };
  },
});

export const currencyArchive = defineCapability({
  module: "masterdata",
  entityName: "currency",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive a currency", de: "Währung archivieren" },
  description: { en: "Soft delete: the currency is archived, never hard-deleted.", de: "Soft Delete: die Währung wird archiviert, nie hart gelöscht." },
  input: z.object({ currencyId: z.uuid() }),
  output: z.object({ currencyId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["currency"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("currency", input.currencyId, { archived: true });
    if (!updated) throw new CapabilityError("not_found", "Currency not found");
    return { currencyId: input.currencyId, archived: true as const };
  },
});

export const currencyCapabilities = [currencyList, currencyGet, currencyUpsert, currencyArchive];
