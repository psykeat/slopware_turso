import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { defineListCapability } from "../core/list";
import { CapabilityError } from "../core/types";

const deliveryAddressRecordSchema = z.looseObject({
  deliveryAddressId: z.uuid(),
  tenantId: z.uuid(),
  addressId: z.uuid(),
  name: z.string().nullable().optional(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable().optional(),
  postalCode: z.string(),
  city: z.string(),
  countryCode: z.string().min(2).max(2),
  defaultForShipping: z.boolean().nullable().optional(),
  archived: z.boolean(),
  customAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date().nullable().optional(),
});

const deliveryAddressCreateSchema = z.object({
  addressId: z.uuid(),
  name: z.string().nullable().optional(),
  addressLine1: z.string().trim().min(1),
  addressLine2: z.string().nullable().optional(),
  postalCode: z.string().trim().min(1),
  city: z.string().trim().min(1),
  countryCode: z.string().trim().min(2).max(2),
  defaultForShipping: z.boolean().optional(),
  customAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
});

const deliveryAddressPatchSchema = z.object({
  name: z.string().nullable().optional(),
  addressId: z.uuid().optional(),
  addressLine1: z.string().trim().min(1).optional(),
  addressLine2: z.string().nullable().optional(),
  postalCode: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  countryCode: z.string().trim().min(2).max(2).optional(),
  defaultForShipping: z.boolean().optional(),
  archived: z.boolean().optional(),
  customAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const deliveryAddressList = defineListCapability({
  module: "masterdata",
  entityName: "deliveryAddress",
  summary: { en: "List delivery addresses", de: "Lieferadressen auflisten" },
  recordSchema: deliveryAddressRecordSchema,
  extraFilters: { addressId: z.uuid().optional() },
  defaultOrderBy: "createdAt:desc",
});

export const deliveryAddressGet = defineCapability({
  module: "masterdata",
  entityName: "deliveryAddress",
  operation: "get",
  kind: "read",
  summary: { en: "Get a delivery address by id", de: "Lieferadresse per ID lesen" },
  input: z.object({ deliveryAddressId: z.uuid() }),
  output: deliveryAddressRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService().get("deliveryAddress", input.deliveryAddressId);
    if (!row) throw new CapabilityError("not_found", "Delivery address not found");
    return row;
  },
});

export const deliveryAddressCreate = defineCapability({
  module: "masterdata",
  entityName: "deliveryAddress",
  operation: "create",
  kind: "create",
  summary: { en: "Create a delivery address", de: "Lieferadresse anlegen" },
  input: deliveryAddressCreateSchema,
  output: deliveryAddressRecordSchema,
  writesTables: ["deliveryAddress"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [created] = await new DataService().create("deliveryAddress", input);
    return created;
  },
});

export const deliveryAddressUpdate = defineCapability({
  module: "masterdata",
  entityName: "deliveryAddress",
  operation: "update",
  kind: "update",
  summary: { en: "Update a delivery address", de: "Lieferadresse ändern" },
  input: z.object({
    deliveryAddressId: z.uuid(),
    patch: deliveryAddressPatchSchema.refine((patch) => Object.keys(patch).length > 0, {
      message: "patch must not be empty",
    }),
  }),
  output: deliveryAddressRecordSchema,
  writesTables: ["deliveryAddress"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService().patch(
      "deliveryAddress",
      input.deliveryAddressId,
      input.patch,
    );
    if (!updated) throw new CapabilityError("not_found", "Delivery address not found");
    return updated;
  },
});

export const deliveryAddressArchive = defineCapability({
  module: "masterdata",
  entityName: "deliveryAddress",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive a delivery address", de: "Lieferadresse archivieren" },
  description: {
    en: "Soft delete: the delivery address is archived, never hard-deleted.",
    de: "Soft Delete: die Lieferadresse wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ deliveryAddressId: z.uuid() }),
  output: z.object({ deliveryAddressId: z.uuid(), archived: z.boolean() }),
  writesTables: ["deliveryAddress"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService().patch("deliveryAddress", input.deliveryAddressId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Delivery address not found");
    return { deliveryAddressId: input.deliveryAddressId, archived: true };
  },
});

export const deliveryAddressCapabilities = [
  deliveryAddressList,
  deliveryAddressGet,
  deliveryAddressCreate,
  deliveryAddressUpdate,
  deliveryAddressArchive,
];
