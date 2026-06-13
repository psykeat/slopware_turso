import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { listInputSchema, listOutputSchema, looseRowSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

const idInputSchema = z.object({ id: z.uuid() });

const patchInputSchema = z.object({
  id: z.uuid(),
  patch: z
    .record(z.string(), z.unknown())
    .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
});

type SystemEntitySpec = {
  entityName: string;
  tableName: string;
  orderBy: string;
  archivable?: boolean;
};

function makeSystemEntityCapabilities(spec: SystemEntitySpec) {
  const list = defineCapability({
    module: "system",
    entityName: spec.entityName,
    operation: "list",
    kind: "read",
    summary: { en: `List ${spec.entityName}`, de: `${spec.entityName} auflisten` },
    input: listInputSchema,
    output: listOutputSchema,
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_admin",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) =>
      runEntityList(ctx.tenantId, spec.tableName, input.filters, input, spec.orderBy),
  });

  const get = defineCapability({
    module: "system",
    entityName: spec.entityName,
    operation: "get",
    kind: "read",
    summary: { en: `Get ${spec.entityName}`, de: `${spec.entityName} lesen` },
    input: idInputSchema,
    output: looseRowSchema,
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_admin",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const row = await new DataService(ctx.tenantId).get(spec.tableName, input.id);
      if (!row) throw new CapabilityError("not_found", `${spec.entityName} not found`);
      return row;
    },
  });

  const create = defineCapability({
    module: "system",
    entityName: spec.entityName,
    operation: "create",
    kind: "create",
    summary: { en: `Create ${spec.entityName}`, de: `${spec.entityName} anlegen` },
    input: z.record(z.string(), z.unknown()),
    output: looseRowSchema,
    writesTables: [spec.tableName],
    sideEffects: [],
    idempotent: false,
    supportsDryRun: false,
    minRole: "tenant_admin",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const [created] = await new DataService(ctx.tenantId).create(spec.tableName, input);
      return created;
    },
  });

  const update = defineCapability({
    module: "system",
    entityName: spec.entityName,
    operation: "update",
    kind: "update",
    summary: { en: `Update ${spec.entityName}`, de: `${spec.entityName} ändern` },
    input: patchInputSchema,
    output: looseRowSchema,
    writesTables: [spec.tableName],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_admin",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const [updated] = await new DataService(ctx.tenantId).patch(spec.tableName, input.id, input.patch);
      if (!updated) throw new CapabilityError("not_found", `${spec.entityName} not found`);
      return updated;
    },
  });

  const archive = spec.archivable
    ? [
        defineCapability({
          module: "system",
          entityName: spec.entityName,
          operation: "archive",
          kind: "archive",
          summary: { en: `Archive ${spec.entityName}`, de: `${spec.entityName} archivieren` },
          input: idInputSchema,
          output: z.object({ id: z.uuid(), archived: z.literal(true) }),
          writesTables: [spec.tableName],
          sideEffects: [],
          idempotent: true,
          supportsDryRun: false,
          minRole: "tenant_admin",
          exposure: { llm: "confirm", http: true },
          schemaVersion: 1,
          handler: async (ctx, input) => {
            const [updated] = await new DataService(ctx.tenantId).patch(spec.tableName, input.id, {
              archived: true,
            });
            if (!updated) throw new CapabilityError("not_found", `${spec.entityName} not found`);
            return { id: input.id, archived: true as const };
          },
        }),
      ]
    : [];

  return [list, get, create, update, ...archive];
}

export const organizationCapabilities = makeSystemEntityCapabilities({
  entityName: "organization",
  tableName: "organization",
  orderBy: "createdAt:desc",
  archivable: true,
});

export const tenantCapabilities = makeSystemEntityCapabilities({
  entityName: "tenant",
  tableName: "tenant",
  orderBy: "createdAt:desc",
  archivable: true,
});

export const companyCapabilities = makeSystemEntityCapabilities({
  entityName: "company",
  tableName: "company",
  orderBy: "companyNo:asc",
  archivable: true,
});

export const userTenantCapabilities = makeSystemEntityCapabilities({
  entityName: "userTenant",
  tableName: "userTenant",
  orderBy: "id:asc",
});

export const modulesCapabilities = makeSystemEntityCapabilities({
  entityName: "modules",
  tableName: "modules",
  orderBy: "slug:asc",
});

export const connectorDefinitionCapabilities = makeSystemEntityCapabilities({
  entityName: "connectorDefinition",
  tableName: "connectorDefinition",
  orderBy: "slug:asc",
});

export const systemSettingsCapabilities = makeSystemEntityCapabilities({
  entityName: "systemSettings",
  tableName: "systemSettings",
  orderBy: "key:asc",
});

export const tenantConnectorCapabilities = makeSystemEntityCapabilities({
  entityName: "tenantConnector",
  tableName: "tenantConnector",
  orderBy: "createdAt:desc",
  archivable: true,
});

export const tenantConnectorMappingCapabilities = makeSystemEntityCapabilities({
  entityName: "tenantConnectorMapping",
  tableName: "tenantConnectorMapping",
  orderBy: "sourceField:asc",
});

export const tenantFieldsCapabilities = makeSystemEntityCapabilities({
  entityName: "tenantFields",
  tableName: "tenantFields",
  orderBy: "entityName:asc",
  archivable: true,
});

export const tenantGroupsCapabilities = makeSystemEntityCapabilities({
  entityName: "tenantGroups",
  tableName: "tenantGroups",
  orderBy: "entityName:asc",
});

export const tenantLayoutsCapabilities = makeSystemEntityCapabilities({
  entityName: "tenantLayouts",
  tableName: "tenantLayouts",
  orderBy: "entityName:asc",
});

export const tenantRulesCapabilities = makeSystemEntityCapabilities({
  entityName: "tenantRules",
  tableName: "tenantRules",
  orderBy: "entityName:asc",
});

export const tenantLlmConfigCapabilities = makeSystemEntityCapabilities({
  entityName: "tenantLlmConfig",
  tableName: "tenantLlmConfig",
  orderBy: "createdAt:desc",
});

export const systemCapabilities = [
  ...organizationCapabilities,
  ...tenantCapabilities,
  ...companyCapabilities,
  ...userTenantCapabilities,
  ...modulesCapabilities,
  ...connectorDefinitionCapabilities,
  ...systemSettingsCapabilities,
  ...tenantConnectorCapabilities,
  ...tenantConnectorMappingCapabilities,
  ...tenantFieldsCapabilities,
  ...tenantGroupsCapabilities,
  ...tenantLayoutsCapabilities,
  ...tenantRulesCapabilities,
  ...tenantLlmConfigCapabilities,
];
