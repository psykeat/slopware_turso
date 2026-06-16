import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { listInputSchema, listOutputSchema, looseRowSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

// Capability surface backing the email-templates admin page. Templates and
// bindings are tenant-scoped configuration (not business data), so they get a
// full CRUD surface with archive-instead-of-delete. The render-log stays
// read-only — it is an audit trail written by the render service.

const idInputSchema = z.object({ id: z.uuid() });

// --- emailTemplate ---------------------------------------------------------

const templateWritableFields = z.object({
  category: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  subjectTemplate: z.string().optional(),
  bodyHtmlTemplate: z.string().optional(),
  bodyTextTemplate: z.string().nullable().optional(),
  language: z.string().trim().length(2).nullable().optional(),
});

const templateCreateInput = z.object({
  ...templateWritableFields.shape,
  category: z.string().trim().min(1).default("document"),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  subjectTemplate: z.string().min(1),
  bodyHtmlTemplate: z.string().min(1),
});

// --- emailTemplateBinding --------------------------------------------------

const bindingWritableFields = z.object({
  emailTemplateId: z.uuid().optional(),
  documentType: z.string().trim().length(1).nullable().optional(),
  companyId: z.uuid().nullable().optional(),
  language: z.string().trim().length(2).nullable().optional(),
  emailIdentityId: z.uuid().nullable().optional(),
  priority: z.number().int().min(0).optional(),
});

const bindingCreateInput = z.object({
  ...bindingWritableFields.shape,
  emailTemplateId: z.uuid(),
  priority: z.number().int().min(0).default(100),
});

function readOps(entityName: string, tableName: string, orderBy: string) {
  const list = defineCapability({
    module: "communication",
    entityName,
    operation: "list",
    kind: "read",
    summary: { en: `List ${entityName}`, de: `${entityName} auflisten` },
    input: listInputSchema,
    output: listOutputSchema,
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) =>
      runEntityList(ctx.tenantId, tableName, input.filters, input, orderBy),
  });

  const get = defineCapability({
    module: "communication",
    entityName,
    operation: "get",
    kind: "read",
    summary: { en: `Get ${entityName}`, de: `${entityName} lesen` },
    input: idInputSchema,
    output: looseRowSchema,
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const row = await new DataService(ctx.tenantId).get(tableName, input.id);
      if (!row) throw new CapabilityError("not_found", `${entityName} not found`);
      return row;
    },
  });

  return { list, get };
}

function writeOps(
  entityName: string,
  tableName: string,
  createInput: z.ZodType,
  patchFields: z.ZodObject<z.ZodRawShape>,
) {
  const create = defineCapability({
    module: "communication",
    entityName,
    operation: "create",
    kind: "create",
    summary: { en: `Create ${entityName}`, de: `${entityName} anlegen` },
    input: createInput,
    output: looseRowSchema,
    writesTables: [tableName],
    sideEffects: [],
    idempotent: false,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const [created] = await new DataService(ctx.tenantId).create(tableName, input);
      return created as z.output<typeof looseRowSchema>;
    },
  });

  const update = defineCapability({
    module: "communication",
    entityName,
    operation: "update",
    kind: "update",
    summary: { en: `Update ${entityName}`, de: `${entityName} ändern` },
    input: z.object({
      id: z.uuid(),
      patch: patchFields
        .extend({ archived: z.boolean().optional() })
        .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
    }),
    output: looseRowSchema,
    writesTables: [tableName],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const [updated] = await new DataService(ctx.tenantId).patch(tableName, input.id, input.patch);
      if (!updated) throw new CapabilityError("not_found", `${entityName} not found`);
      return updated as z.output<typeof looseRowSchema>;
    },
  });

  const archive = defineCapability({
    module: "communication",
    entityName,
    operation: "archive",
    kind: "archive",
    summary: { en: `Archive ${entityName}`, de: `${entityName} archivieren` },
    description: {
      en: "Soft delete: the record is archived, never hard-deleted.",
      de: "Soft Delete: der Datensatz wird archiviert, nie hart gelöscht.",
    },
    input: idInputSchema,
    output: z.object({ id: z.uuid(), archived: z.literal(true) }),
    writesTables: [tableName],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: { llm: "confirm", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const [updated] = await new DataService(ctx.tenantId).patch(tableName, input.id, {
        archived: true,
      });
      if (!updated) throw new CapabilityError("not_found", `${entityName} not found`);
      return { id: input.id, archived: true as const };
    },
  });

  return { create, update, archive };
}

const template = {
  ...readOps("emailTemplate", "emailTemplate", "updatedAt:desc"),
  ...writeOps("emailTemplate", "emailTemplate", templateCreateInput, templateWritableFields),
};

const binding = {
  ...readOps("emailTemplateBinding", "emailTemplateBinding", "priority:asc"),
  ...writeOps(
    "emailTemplateBinding",
    "emailTemplateBinding",
    bindingCreateInput,
    bindingWritableFields,
  ),
};

const renderLog = readOps("emailTemplateRenderLog", "emailTemplateRenderLog", "createdAt:desc");

export const emailTemplateCapabilities = [
  template.list,
  template.get,
  template.create,
  template.update,
  template.archive,
  binding.list,
  binding.get,
  binding.create,
  binding.update,
  binding.archive,
  renderLog.list,
  renderLog.get,
];
