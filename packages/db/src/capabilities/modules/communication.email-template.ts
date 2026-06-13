import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { CapabilityError } from "../core/types";

// Read-only template surfaces backing the email-templates admin page and the
// render-log viewer. Templates/bindings are authored through dedicated flows;
// here we only expose the list/get reads the UI uses.

const looseRowSchema = z.looseObject({});

const listInputSchema = z.object({
  filters: z.record(z.string(), z.string()).default({}),
  search: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

const idInputSchema = z.object({ id: z.uuid() });

function readOnly(entityName: string, tableName: string, orderBy: string) {
  const list = defineCapability({
    module: "communication",
    entityName,
    operation: "list",
    kind: "read",
    summary: { en: `List ${entityName}`, de: `${entityName} auflisten` },
    input: listInputSchema,
    output: z.object({ items: z.array(looseRowSchema) }),
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const rows = await new DataService(ctx.tenantId).list(tableName, input.filters, {
        search: input.search,
        limit: input.limit,
        offset: input.offset,
        orderBy,
      });
      return { items: rows as z.output<typeof looseRowSchema>[] };
    },
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

  return [list, get];
}

export const emailTemplateCapabilities = [
  ...readOnly("emailTemplate", "emailTemplate", "updatedAt:desc"),
  ...readOnly("emailTemplateBinding", "emailTemplateBinding", "priority:asc"),
  ...readOnly("emailTemplateRenderLog", "emailTemplateRenderLog", "createdAt:desc"),
];
