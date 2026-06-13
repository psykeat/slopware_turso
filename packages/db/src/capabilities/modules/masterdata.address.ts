import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../index";
import { address } from "../../schema/app.schema";
import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { listControlsSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

const addressRecordSchema = z.looseObject({
  addressId: z.uuid(),
  addressNo: z.string(),
  tenantId: z.uuid(),
  isCustomer: z.boolean(),
  isSupplier: z.boolean(),
  companyName: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable().optional(),
  postalCode: z.string(),
  city: z.string(),
  stateProvince: z.string().nullable().optional(),
  countryCode: z.string().min(2).max(2),
  vatId: z.string().nullable().optional(),
  taxClassId: z.uuid().nullable().optional(),
  currencyId: z.string().min(3).max(3).nullable().optional(),
  paymentTermId: z.uuid().nullable().optional(),
  archivedAt: z.date().nullable().optional(),
  customAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date().nullable().optional(),
  defaultDeliveryAddressId: z.uuid().nullable().optional(),
  searchText: z.string().nullable().optional(),
  addressCategoryId: z.uuid().nullable().optional(),
});

const addressWritableFields = z.object({
  isCustomer: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  companyName: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  notiztext: z.string().nullable().optional(),
  langtext: z.string().nullable().optional(),
  warntext: z.string().nullable().optional(),
  addressLine1: z.string().trim().min(1).optional(),
  addressLine2: z.string().nullable().optional(),
  postalCode: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  stateProvince: z.string().nullable().optional(),
  countryCode: z.string().trim().min(2).max(2).optional(),
  vatId: z.string().nullable().optional(),
  taxClassId: z.uuid().nullable().optional(),
  currencyId: z.string().min(3).max(3).nullable().optional(),
  paymentTermId: z.uuid().nullable().optional(),
  customAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
  defaultDeliveryAddressId: z.uuid().nullable().optional(),
  addressCategoryId: z.uuid().nullable().optional(),
});

async function findAddressByNo(tenantId: string, addressNo: string) {
  const [row] = await db
    .select({ addressId: address.addressId, archivedAt: address.archivedAt })
    .from(address)
    .where(and(eq(address.tenantId, tenantId), eq(address.addressNo, addressNo)))
    .limit(1);
  return row ?? null;
}

export const addressList = defineCapability({
  module: "masterdata",
  entityName: "address",
  operation: "list",
  kind: "read",
  summary: { en: "List addresses", de: "Adressen auflisten" },
  input: z.object({ ...listControlsSchema }),
  output: z.object({ items: z.array(addressRecordSchema), total: z.number().int().optional() }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => runEntityList(ctx.tenantId, "address", {}, input, "addressNo:asc"),
});

export const addressGet = defineCapability({
  module: "masterdata",
  entityName: "address",
  operation: "get",
  kind: "read",
  summary: { en: "Get an address by id", de: "Adresse per ID lesen" },
  input: z.object({ addressId: z.uuid() }),
  output: addressRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: {
    llm: "safe",
    http: true,
    ai: {
      group: "catalog",
      activeByDefault: true,
      useWhen: ["You need the full detail of one address and already have its addressId."],
      requiredContext: ["addressId"],
      resultShape: "the full address record",
    },
  },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("address", input.addressId);
    if (!row) throw new CapabilityError("not_found", "Address not found");
    return row;
  },
});

export const addressUpsert = defineCapability({
  module: "masterdata",
  entityName: "address",
  operation: "upsert",
  kind: "update",
  summary: { en: "Create or update an address by address number", de: "Adresse per Adressnummer anlegen oder ändern" },
  description: {
    en: "Address number is the natural key inside a tenant: an existing address is patched, otherwise a new one is created (name and address lines required).",
    de: "Die Adressnummer ist der natürliche Schlüssel im Tenant: eine vorhandene Adresse wird gepatcht, sonst wird neu angelegt (Name und Adressdaten erforderlich).",
  },
  input: z.object({
    addressNo: z.string().trim().min(1),
    ...addressWritableFields.shape,
  }),
  output: z.object({ address: addressRecordSchema, created: z.boolean() }),
  writesTables: ["address"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: {
    llm: "safe",
    http: true,
    ai: {
      group: "catalog",
      activeByDefault: true,
      useWhen: [
        "The user wants to create a new customer/supplier address or update an existing one. addressNo is the natural key — pass the same number to update.",
      ],
      resultShape: "{ address, created }",
    },
  },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const service = new DataService(ctx.tenantId);
    const existing = await findAddressByNo(ctx.tenantId, input.addressNo);

    if (existing?.archivedAt) {
      throw new CapabilityError(
        "conflict",
        `Address "${input.addressNo}" exists but is archived; unarchive it first`,
      );
    }

    if (existing) {
      const { addressNo: _addressNo, ...patch } = input;
      if (Object.keys(patch).length === 0) {
        const row = await service.get("address", existing.addressId);
        return { address: row, created: false };
      }
      const [updated] = await service.patch("address", existing.addressId, patch);
      if (!updated) throw new CapabilityError("not_found", "Address not found");
      return { address: updated, created: false };
    }

    if (!input.companyName && !input.firstName && !input.lastName) {
      throw new CapabilityError(
        "validation",
        "companyName or a person name is required when creating a new address",
        [
          { path: "companyName", message: "Required unless firstName/lastName identify a person" },
        ],
      );
    }
    if (!input.addressLine1 || !input.postalCode || !input.city || !input.countryCode) {
      throw new CapabilityError("validation", "addressLine1, postalCode, city and countryCode are required when creating a new address");
    }

    const [created] = await service.create("address", input);
    return { address: created, created: true };
  },
});

export const addressArchive = defineCapability({
  module: "masterdata",
  entityName: "address",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive an address", de: "Adresse archivieren" },
  description: {
    en: "Soft delete: the address is archived via archivedAt, never hard-deleted.",
    de: "Soft Delete: die Adresse wird über archivedAt archiviert, nie hart gelöscht.",
  },
  input: z.object({ addressId: z.uuid() }),
  output: z.object({ addressId: z.uuid(), archivedAt: z.date().nullable() }),
  writesTables: ["address"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("address", input.addressId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Address not found");
    return { addressId: input.addressId, archivedAt: updated.archivedAt ?? new Date() };
  },
});

export const addressCapabilities = [addressList, addressGet, addressUpsert, addressArchive];
