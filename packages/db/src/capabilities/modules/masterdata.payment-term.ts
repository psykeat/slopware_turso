import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { defineListCapability } from "../core/list";
import { CapabilityError } from "../core/types";

const localizedTextSchema = z.record(z.string(), z.string());

const paymentTermRecordSchema = z.object({
  paymentTermId: z.uuid(),
  name: localizedTextSchema,
  netDays: z.number().int(),
  discountDays: z.number().int().nullable(),
  discountPercentage: z.union([z.string(), z.number()]).nullable(),
  archived: z.boolean(),
  createdAt: z.date(),
  customAttributes: z.record(z.string(), z.unknown()).nullable(),
});

const paymentTermWritableFields = z.object({
  name: localizedTextSchema.optional(),
  netDays: z.number().int().min(0).optional(),
  discountDays: z.number().int().min(0).nullable().optional(),
  discountPercentage: z.union([z.string(), z.number()]).nullable().optional(),
  customAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const paymentTermList = defineListCapability({
  module: "masterdata",
  entityName: "paymentTerm",
  summary: { en: "List payment terms", de: "Zahlungsbedingungen auflisten" },
  recordSchema: paymentTermRecordSchema,
  defaultOrderBy: "createdAt:asc",
  defaultLimit: 200,
});

export const paymentTermGet = defineCapability({
  module: "masterdata",
  entityName: "paymentTerm",
  operation: "get",
  kind: "read",
  summary: { en: "Get a payment term by id", de: "Zahlungsbedingung per ID lesen" },
  input: z.object({ paymentTermId: z.uuid() }),
  output: paymentTermRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService().get("paymentTerm", input.paymentTermId);
    if (!row) throw new CapabilityError("not_found", "Payment term not found");
    return row;
  },
});

export const paymentTermCreate = defineCapability({
  module: "masterdata",
  entityName: "paymentTerm",
  operation: "create",
  kind: "create",
  summary: { en: "Create a payment term", de: "Zahlungsbedingung anlegen" },
  input: z.object({
    ...paymentTermWritableFields.shape,
    name: localizedTextSchema,
    netDays: z.number().int().min(0),
  }),
  output: paymentTermRecordSchema,
  writesTables: ["paymentTerm"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [created] = await new DataService().create("paymentTerm", input);
    return created;
  },
});

export const paymentTermUpdate = defineCapability({
  module: "masterdata",
  entityName: "paymentTerm",
  operation: "update",
  kind: "update",
  summary: { en: "Update a payment term", de: "Zahlungsbedingung ändern" },
  input: z.object({
    paymentTermId: z.uuid(),
    patch: paymentTermWritableFields
      .extend({ archived: z.boolean().optional() })
      .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
  }),
  output: paymentTermRecordSchema,
  writesTables: ["paymentTerm"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService().patch(
      "paymentTerm",
      input.paymentTermId,
      input.patch,
    );
    if (!updated) throw new CapabilityError("not_found", "Payment term not found");
    return updated;
  },
});

export const paymentTermArchive = defineCapability({
  module: "masterdata",
  entityName: "paymentTerm",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive a payment term", de: "Zahlungsbedingung archivieren" },
  description: {
    en: "Soft delete: the payment term is archived, never hard-deleted.",
    de: "Soft Delete: die Zahlungsbedingung wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ paymentTermId: z.uuid() }),
  output: z.object({ paymentTermId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["paymentTerm"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService().patch("paymentTerm", input.paymentTermId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Payment term not found");
    return { paymentTermId: input.paymentTermId, archived: true as const };
  },
});

export const paymentTermCapabilities = [
  paymentTermList,
  paymentTermGet,
  paymentTermCreate,
  paymentTermUpdate,
  paymentTermArchive,
];
