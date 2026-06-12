import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../index";
import { country } from "../../schema/app.schema";
import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { CapabilityError } from "../core/types";

const localizedTextSchema = z.record(z.string(), z.string());

const countryRecordSchema = z.object({
  countryId: z.uuid(),
  iso2Code: z.string().min(2).max(2),
  iso3Code: z.string().min(3).max(3),
  name: localizedTextSchema,
  isEu: z.boolean(),
  archived: z.boolean(),
  createdAt: z.date(),
});

const countryWritableFields = z.object({
  iso3Code: z.string().trim().min(3).max(3).optional(),
  name: localizedTextSchema.optional(),
  isEu: z.boolean().optional(),
});

async function findCountryByIso2Code(iso2Code: string) {
  const [row] = await db
    .select({ countryId: country.countryId, archived: country.archived })
    .from(country)
    .where(eq(country.iso2Code, iso2Code))
    .limit(1);
  return row ?? null;
}

export const countryList = defineCapability({
  module: "masterdata",
  entityName: "country",
  operation: "list",
  kind: "read",
  summary: { en: "List countries", de: "Länder auflisten" },
  input: z.object({
    search: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(200).default(200),
    offset: z.number().int().min(0).default(0),
  }),
  output: z.object({ items: z.array(countryRecordSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const rows = await new DataService(ctx.tenantId).list("country", {}, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
      orderBy: "iso2Code:asc",
    });
    return { items: rows as z.output<typeof countryRecordSchema>[] };
  },
});

export const countryGet = defineCapability({
  module: "masterdata",
  entityName: "country",
  operation: "get",
  kind: "read",
  summary: { en: "Get a country by id", de: "Land per ID lesen" },
  input: z.object({ countryId: z.uuid() }),
  output: countryRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("country", input.countryId);
    if (!row) throw new CapabilityError("not_found", "Country not found");
    return row;
  },
});

export const countryUpsert = defineCapability({
  module: "masterdata",
  entityName: "country",
  operation: "upsert",
  kind: "update",
  summary: { en: "Create or update a country by ISO2 code", de: "Land per ISO2-Code anlegen oder ändern" },
  description: {
    en: "ISO2 code is the natural key: an existing country is patched, otherwise a new one is created (ISO3, name required).",
    de: "Der ISO2-Code ist der natürliche Schlüssel: ein vorhandenes Land wird gepatcht, sonst wird neu angelegt (ISO3, Name erforderlich).",
  },
  input: z.object({
    ...countryWritableFields.shape,
    iso2Code: z.string().trim().min(2).max(2),
    iso3Code: z.string().trim().min(3).max(3),
    name: localizedTextSchema,
  }),
  output: z.object({ country: countryRecordSchema, created: z.boolean() }),
  writesTables: ["country"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const service = new DataService(ctx.tenantId);
    const existing = await findCountryByIso2Code(input.iso2Code);

    if (existing?.archived) {
      throw new CapabilityError(
        "conflict",
        `Country "${input.iso2Code}" exists but is archived; unarchive it first`,
      );
    }

    if (existing) {
      const { iso2Code: _iso2Code, ...patch } = input;
      if (Object.keys(patch).length === 0) {
        const row = await service.get("country", existing.countryId);
        return { country: row, created: false };
      }
      const [updated] = await service.patch("country", existing.countryId, patch);
      if (!updated) throw new CapabilityError("not_found", "Country not found");
      return { country: updated, created: false };
    }

    const [created] = await service.create("country", input);
    return { country: created, created: true };
  },
});

export const countryArchive = defineCapability({
  module: "masterdata",
  entityName: "country",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive a country", de: "Land archivieren" },
  description: { en: "Soft delete: the country is archived, never hard-deleted.", de: "Soft Delete: das Land wird archiviert, nie hart gelöscht." },
  input: z.object({ countryId: z.uuid() }),
  output: z.object({ countryId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["country"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("country", input.countryId, { archived: true });
    if (!updated) throw new CapabilityError("not_found", "Country not found");
    return { countryId: input.countryId, archived: true as const };
  },
});

export const countryCapabilities = [countryList, countryGet, countryUpsert, countryArchive];
